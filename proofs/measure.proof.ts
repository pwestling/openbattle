import { test, expect, type Page } from "@playwright/test";
import * as nodeMeasure from "../src/measure/index.ts";
import * as nodeRecord from "../src/record/index.ts";

// The Measure module, driven through its public face in real Chromium (ADR-018).
// There is no screen yet, so a proof page loads the module and these proofs call it as the screen will.

type MeasureModule = typeof nodeMeasure;

/** Runs a scenario against the Measure module as loaded in the browser page, with an argument. */
async function inBrowser<A, T>(page: Page, scenario: (m: MeasureModule, arg: A) => T, arg: A): Promise<T> {
  return page.evaluate(`(${scenario.toString()})(window.measure, ${JSON.stringify(arg)})`) as Promise<T>;
}

test.beforeEach(async ({ page }) => {
  await page.goto("/proofs/pages/measure.html");
  await expect(page.locator("body[data-ready=yes]")).toBeAttached();
});

type Base = { shape: "round" | "oval" | "rect"; width: number; depth: number };
const model = (unit: string, x: number, y: number, base: Base, facing = 0, floor: { terrain: string; floor: number } | null = null) => ({
  unit,
  base,
  position: { x, y },
  facing,
  floor,
  aside: false,
});
const round32 = { shape: "round" as const, width: 32, depth: 32 };
const round25 = { shape: "round" as const, width: 25, depth: 25 };
const rect = { shape: "rect" as const, width: 25, depth: 50 };
const oval = { shape: "oval" as const, width: 60, depth: 35 };

const square = [{ x: -2, y: -2 }, { x: 2, y: -2 }, { x: 2, y: 2 }, { x: -2, y: 2 }];
const table = {
  models: {
    a: model("ua", 0, 0, round32),
    b: model("ub", 6, 0, round32),
    r0: model("ur", 20, 10, rect),
    r90: model("ur90", 40, 10, rect, 90),
    o0: model("uo", 0, 20, oval),
    o90: model("uo90", 20, 20, oval, 90),
    s: model("us", 20, 0, round25),
    // A unit of two, the second nearer the right.
    u1: model("pair", 30, 0, round32),
    u2: model("pair", 34, 0, round32),
    high: model("uh", 50, 30, round25, 0, { terrain: "ruin", floor: 1 }),
    low: model("ul", 50, 25, round25),
    gone: { ...model("ug", 1, 1, round25), aside: true },
  },
  terrain: {
    ruin: { position: { x: 50, y: 30 }, facing: 0, floors: [{ height: 0.25, outline: square }, { height: 3, outline: square }] },
  },
};

test("distances are base edge to base edge, for every shape of base, rounded to a hundredth of an inch", async ({ page }) => {
  const seen = await inBrowser(
    page,
    (m, t) => ({
      roundToRound: m.distance(t, { model: "a" }, { model: "b" }),
      pointToPoint: m.distance(t, { x: 0, y: 0 }, { x: 3, y: 4 }),
      roundToRect: m.distance(t, { model: "s" }, { model: "r0" }),
      // Turned a quarter, the long side faces sideways, so its front edge is nearer.
      roundToTurnedRect: m.distance(t, { model: "r90" }, { x: 40, y: 0 }),
      ovalAlongItsLength: m.distance(t, { model: "o0" }, { x: 10, y: 20 }),
      ovalTurned: m.distance(t, { model: "o90" }, { x: 30, y: 20 }),
      touching: m.distance(t, { model: "a" }, { x: 0.3, y: 0.3 }),
      unitClosest: m.distance(t, { unit: "pair" }, { x: 44, y: 0 }),
      unitToUnit: m.distance(t, { unit: "pair" }, { unit: "ub" }),
    }),
    table,
  );
  // Centres 6" apart, less two 16 mm radii.
  expect(seen.roundToRound).toEqual({ across: 4.74, up: 0 });
  expect(seen.pointToPoint).toEqual({ across: 5, up: 0 });
  // 10" between centres, less 25 mm of the rect's half depth and 12.5 mm of the round's radius.
  expect(seen.roundToRect).toEqual({ across: 8.52, up: 0 });
  expect(seen.roundToTurnedRect).toEqual({ across: 9.51, up: 0 });
  expect(seen.ovalAlongItsLength).toEqual({ across: 8.82, up: 0 });
  expect(seen.ovalTurned).toEqual({ across: 9.31, up: 0 });
  expect(seen.touching).toEqual({ across: 0, up: 0 });
  // The unit's nearer model is 10" from the point, less its radius.
  expect(seen.unitClosest).toEqual({ across: 9.37, up: 0 });
  expect(seen.unitToUnit).toEqual({ across: 22.74, up: 0 });
});

test("a path through waypoints is measured from the base edges at its two ends, with the height between them", async ({ page }) => {
  const seen = await inBrowser(
    page,
    (m, t) => ({
      around: m.distance(t, { model: "a" }, { x: 5, y: 0 }, [{ x: 0, y: 5 }, { x: 5, y: 5 }]),
      unitAround: m.distance(t, { x: 30, y: 10 }, { unit: "pair" }, [{ x: 30, y: 5 }]),
      upToTheRoof: m.distance(t, { model: "low" }, { model: "high" }),
      downFromTheRoof: m.distance(t, { model: "high" }, { model: "low" }),
      pointToRoof: m.distance(t, { x: 50, y: 40 }, { model: "high" }),
    }),
    table,
  );
  // 5" up, less the base's radius, then 5" across and 5" down.
  expect(seen.around).toEqual({ across: 14.37, up: 0 });
  // 5" to the waypoint, then 5" to the centre of the pair's nearer model, less its radius.
  expect(seen.unitAround).toEqual({ across: 9.37, up: 0 });
  expect(seen.upToTheRoof).toEqual({ across: 4.02, up: 3 });
  expect(seen.downFromTheRoof).toEqual({ across: 4.02, up: -3 });
  expect(seen.pointToRoof).toEqual({ across: 9.51, up: 3 });
});

test("measuring a model that is set aside or missing fails, saying which", async ({ page }) => {
  const seen = await inBrowser(
    page,
    (m, t) => {
      const fails = (f: () => unknown) => {
        try {
          f();
          return null;
        } catch (e) {
          return (e as Error).message;
        }
      };
      return {
        aside: fails(() => m.distance(t, { model: "gone" }, { x: 0, y: 0 })),
        missing: fails(() => m.distance(t, { x: 0, y: 0 }, { model: "nobody" })),
        allAside: fails(() => m.distance(t, { unit: "ug" }, { x: 0, y: 0 })),
        noUnit: fails(() => m.distance(t, { unit: "nobody" }, { x: 0, y: 0 })),
      };
    },
    table,
  );
  expect(seen).toEqual({
    aside: 'Model "gone" is set aside.',
    missing: 'There is no model "nobody".',
    allAside: 'Every model of unit "ug" is set aside.',
    noUnit: 'There is no unit "nobody" with models.',
  });
});

test("the same question gets the same answer in the browser and out of it, and a record table goes straight in", async ({ page }) => {
  // Bases of every shape at awkward positions and facings, measured against each other.
  const bases = [round25, round32, rect, oval, { shape: "oval" as const, width: 105, depth: 70 }];
  const models: Record<string, ReturnType<typeof model>> = {};
  for (let i = 0; i < 40; i++) {
    models[`m${i}`] = model(`u${i % 7}`, (i * 7.31) % 44, (i * 3.77) % 30, bases[i % bases.length]!, (i * 37.5) % 360);
  }
  const many = { models, terrain: {} };
  const ask = (m: MeasureModule, t: typeof many) =>
    Object.keys(t.models).flatMap((a) => Object.keys(t.models).map((b) => m.distance(t, { model: a }, { model: b }).across));
  const there = await inBrowser(page, ask, many);
  expect(there).toEqual(ask(nodeMeasure, many));

  let log = nodeRecord.newLog({ width: 44, depth: 30 });
  log = nodeRecord.append(log, { kind: "join", name: "Ann", colour: "#c33" }, "ann");
  log = nodeRecord.append(
    log,
    {
      kind: "add to army",
      units: [{ id: "u", name: "Pair" }],
      models: [
        { id: "x", unit: "u", name: "X", base: round32, height: 1, position: { x: 0, y: 0 }, facing: 0, floor: null },
        { id: "y", unit: "u", name: "Y", base: round32, height: 1, position: { x: 6, y: 0 }, facing: 0, floor: null },
      ],
      groups: [],
    },
    "ann",
  );
  const recorded: nodeMeasure.TableShape = nodeRecord.tableAt(log);
  expect(await inBrowser(page, (m, t) => m.distance(t, { model: "x" }, { model: "y" }), recorded)).toEqual({ across: 4.74, up: 0 });
});
