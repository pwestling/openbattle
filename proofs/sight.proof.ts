import { test, expect, type Page } from "@playwright/test";
import * as nodeMeasure from "../src/measure/index.ts";

// Line of sight (ADR-028), asked of the Measure module through its public face in real Chromium,
// as the screen and rules packages ask it.

type MeasureModule = typeof nodeMeasure;

async function inBrowser<A, T>(page: Page, scenario: (m: MeasureModule, arg: A) => T, arg: A): Promise<T> {
  return page.evaluate(`(${scenario.toString()})(window.measure, ${JSON.stringify(arg)})`) as Promise<T>;
}

test.beforeEach(async ({ page }) => {
  await page.goto("/proofs/pages/measure.html");
  await expect(page.locator("body[data-ready=yes]")).toBeAttached();
});

const round25 = { shape: "round" as const, width: 25, depth: 25 };
const model = (x: number, y: number, more: { height?: number; mesh?: string; floor?: { terrain: string; floor: number }; facing?: number } = {}) => ({
  unit: "u",
  base: round25,
  position: { x, y },
  facing: more.facing ?? 0,
  floor: more.floor ?? null,
  aside: false,
  height: more.height ?? 1.2,
  ...(more.mesh ? { mesh: more.mesh } : {}),
});
/** A wall across the line from (0, 0) to (10, 0), halfway along: 6" long, half an inch thick. */
const wall = (height: number, x = 5) => ({
  position: { x, y: 0 },
  facing: 90,
  floors: [],
  shape: { kind: "box" as const, width: 6, depth: 0.5, height },
});
/** A box's corners in a mesh's own units, +y up, as three.js reads a file. */
const box = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): number[] => {
  const c = [
    [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0],
    [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1],
  ];
  const faces = [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]];
  return faces.flatMap(([a, b, e, f]) => [...c[a!]!, ...c[b!]!, ...c[e!]!, ...c[a!]!, ...c[e!]!, ...c[f!]!]);
};

const scenes = {
  open: { models: { a: model(0, 0), b: model(10, 0) }, terrain: {} },
  tallWall: { models: { a: model(0, 0), b: model(10, 0) }, terrain: { wall: wall(3) } },
  lowWall: { models: { a: model(0, 0), b: model(10, 0) }, terrain: { wall: wall(0.8) } },
  between: { models: { a: model(0, 0), b: model(10, 0), c: model(5, 0) }, terrain: {} },
  // A is on the 4" roof of a tower, so it sees over the 2" wall in part; B on the ground behind it.
  tower: {
    models: { a: model(0, 0, { floor: { terrain: "tower", floor: 0 } }), b: model(10, 0) },
    terrain: {
      wall: wall(2, 8),
      tower: { position: { x: 0, y: 0 }, facing: 0, floors: [{ height: 4, outline: [{ x: -1, y: -1 }, { x: 1, y: -1 }, { x: 1, y: 1 }, { x: -1, y: 1 }] }], shape: { kind: "box" as const, width: 2, depth: 2, height: 4 } },
    },
  },
};

test("a model sees another across open ground, not through a tall wall, and over a low one in part", async ({ page }) => {
  const seen = await inBrowser(
    page,
    (m, s) => ({
      open: m.sight(s.open, {}, { model: "a" }, { model: "b" }),
      tallWall: m.sight(s.tallWall, {}, { model: "a" }, { model: "b" }),
      lowWall: m.sight(s.lowWall, {}, { model: "a" }, { model: "b" }),
      tower: m.sight(s.tower, {}, { model: "a" }, { model: "b" }),
      towerBack: m.sight(s.tower, {}, { model: "b" }, { model: "a" }),
      // The same two on the ground: the 2" wall hides the 1.32" model completely.
      ground: m.sight({ ...s.tower, models: { ...s.tower.models, a: { ...s.tower.models.a, floor: null } } }, {}, { model: "a" }, { model: "b" }, ["tower"]),
    }),
    scenes,
  );
  expect(seen.open.seen).toBe(1);
  expect(seen.open.hiddenBy).toEqual([]);
  // The line drawn runs from the looker's body to the target's, both above their bases.
  const [from, to] = seen.open.line!;
  expect(Math.hypot(from.x, from.y)).toBeLessThan(0.5);
  expect(Math.hypot(to.x - 10, to.y)).toBeLessThan(0.5);
  expect(from.z).toBeGreaterThanOrEqual(0.12);
  expect(to.z).toBeGreaterThanOrEqual(0.12);

  expect(seen.tallWall).toEqual({ seen: 0, hiddenBy: ["wall"], line: null });

  // The wall stands 0.8" high; the models' bodies stand 1.32" high on their bases. The tops show.
  expect(seen.lowWall.seen).toBeGreaterThan(0);
  expect(seen.lowWall.seen).toBeLessThan(1);
  expect(seen.lowWall.hiddenBy).toEqual(["wall"]);
  // A line seen over the low wall passes above it there.
  const [a, b] = seen.lowWall.line!;
  const k = (5 - a.x) / (b.x - a.x);
  expect(a.z + k * (b.z - a.z)).toBeGreaterThan(0.8);

  expect(seen.ground.seen).toBe(0);
  // From the roof, the wall hides only part of the model behind it, and the model sees the roof back.
  expect(seen.tower.seen).toBeGreaterThan(0);
  expect(seen.tower.seen).toBeLessThan(1);
  expect(seen.towerBack.seen).toBeGreaterThan(0);
});

test("whoever asks can say which pieces don't count as in the way; other models count by default", async ({ page }) => {
  const seen = await inBrowser(
    page,
    (m, s) => ({
      wallIgnored: m.sight(s.tallWall, {}, { model: "a" }, { model: "b" }, ["wall"]),
      modelBetween: m.sight(s.between, {}, { model: "a" }, { model: "b" }),
      modelIgnored: m.sight(s.between, {}, { model: "a" }, { model: "b" }, ["c"]),
    }),
    scenes,
  );
  expect(seen.wallIgnored.seen).toBe(1);
  expect(seen.wallIgnored.hiddenBy).toEqual([]);
  // A model of the same size standing exactly between them hides the one behind it.
  expect(seen.modelBetween.hiddenBy).toEqual(["c"]);
  expect(seen.modelBetween.seen).toBeLessThan(1);
  expect(seen.modelIgnored).toMatchObject({ seen: 1, hiddenBy: [] });
});

test("if one model sees another, the other sees it", async ({ page }) => {
  // A crowd of models of different sizes among walls at odd angles: every pair, both ways round.
  const models: Record<string, ReturnType<typeof model>> = {};
  for (let i = 0; i < 10; i++) models[`m${i}`] = model((i * 7.31) % 30, (i * 3.77) % 20, { height: 0.6 + (i % 4) * 0.5, facing: i * 33 });
  const terrain: Record<string, ReturnType<typeof wall>> = {};
  for (let i = 0; i < 6; i++) terrain[`w${i}`] = { ...wall(0.4 + (i % 3) * 0.6), position: { x: (i * 11.3) % 30, y: (i * 5.9) % 20 }, facing: i * 47 };
  const crowd = { models, terrain };
  const ask = (m: MeasureModule, t: typeof crowd) => {
    const ids = Object.keys(t.models);
    return ids.flatMap((a) => ids.filter((b) => b !== a).map((b) => [a, b, m.sight(t, {}, { model: a }, { model: b }).seen > 0]));
  };
  const answers = (await inBrowser(page, ask, crowd)) as [string, string, boolean][];
  const sees = new Map(answers.map(([a, b, s]) => [`${a} ${b}`, s]));
  for (const [a, b, s] of answers) expect(sees.get(`${b} ${a}`), `${a} and ${b}`).toBe(s);
  // Some pairs see each other and some don't, so the check means something.
  expect(answers.some(([, , s]) => s)).toBe(true);
  expect(answers.some(([, , s]) => !s)).toBe(true);
  // The same answers out of the browser, to the hundredth.
  const full = (m: MeasureModule, t: typeof crowd) => {
    const ids = Object.keys(t.models);
    return ids.flatMap((a) => ids.filter((b) => b !== a).map((b) => m.sight(t, {}, { model: a }, { model: b })));
  };
  expect(full(nodeMeasure, crowd)).toEqual(await inBrowser(page, full, crowd));
});

test("a point can be looked at too, at a height above the table", async ({ page }) => {
  const seen = await inBrowser(
    page,
    (m, s) => ({
      behind: m.sight(s.tallWall, {}, { model: "a" }, { x: 10, y: 0 }),
      highAbove: m.sight(s.tallWall, {}, { model: "a" }, { x: 10, y: 0, z: 9 }),
      open: m.sight(s.open, {}, { model: "a" }, { x: 10, y: 0 }),
    }),
    scenes,
  );
  expect(seen.behind).toEqual({ seen: 0, hiddenBy: ["wall"], line: null });
  expect(seen.highAbove.seen).toBe(1);
  expect(seen.highAbove.line![1]).toEqual({ x: 10, y: 0, z: 9 });
  expect(seen.open.seen).toBe(1);
});

test("mesh bodies are their true shape: a model's mesh, scaled to its height, and a terrain mesh stretched to its size", async ({ page }) => {
  const arg = {
    // A model that is a thin pole, 1 mm across and 10 mm tall: scaled to 3" high, it is only 0.3" wide.
    pole: box(-0.5, 0.5, 0, 10, -0.5, 0.5),
    // A terrain mesh: a wall 100 units long, 10 high and 2 thick, stretched to 6" × 3" × 0.5".
    wallMesh: box(-50, 50, 0, 10, -1, 1),
    a: model(0, 0),
    b: model(10, 0),
    pole1: model(5, 0, { height: 3, mesh: "pole" }),
  };
  const seen = await inBrowser(
    page,
    (m, x) => {
      const mesh = (corners: number[]) => ({ positions: new Float32Array(corners) });
      const fails = (f: () => unknown) => {
        try {
          f();
          return "no error";
        } catch (e) {
          return (e as Error).message;
        }
      };
      const poleTable = { models: { a: x.a, b: x.b, pole: x.pole1 }, terrain: {} };
      const wallTable = {
        models: { a: x.a, b: x.b },
        terrain: { wall: { position: { x: 5, y: 0 }, facing: 90, floors: [], shape: { kind: "mesh" as const, width: 6, depth: 0.5, height: 3 } } },
      };
      return {
        pole: m.sight(poleTable, { pole: mesh(x.pole) }, { model: "a" }, { model: "b" }),
        wall: m.sight(wallTable, { wall: mesh(x.wallMesh) }, { model: "a" }, { model: "b" }),
        poleMissing: fails(() => m.sight(poleTable, {}, { model: "a" }, { model: "b" })),
        // Every mesh must be here, even an ignored one, so every browser gives the same answer.
        wallMissing: fails(() => m.sight(wallTable, {}, { model: "a" }, { model: "b" }, ["wall"])),
        nobody: fails(() => m.sight(poleTable, {}, { model: "a" }, { model: "nobody" })),
        aside: fails(() => m.sight({ ...poleTable, models: { ...poleTable.models, b: { ...x.b, aside: true } } }, { pole: mesh(x.pole) }, { model: "a" }, { model: "b" })),
      };
    },
    arg,
  );
  // The thin pole hides only a sliver of the model behind it.
  expect(seen.pole.seen).toBeGreaterThan(0.6);
  expect(seen.pole.seen).toBeLessThan(1);
  expect(seen.pole.hiddenBy).toEqual(["pole"]);
  // The wall mesh, stretched 3" high, hides the 1.32" model completely.
  expect(seen.wall).toEqual({ seen: 0, hiddenBy: ["wall"], line: null });
  expect(seen.poleMissing).toBe('The mesh of model "pole" has not been read.');
  expect(seen.wallMissing).toBe('The mesh of terrain "wall" has not been read.');
  expect(seen.nobody).toBe('There is no model "nobody".');
  expect(seen.aside).toBe('Model "b" is not on the table.');
});
