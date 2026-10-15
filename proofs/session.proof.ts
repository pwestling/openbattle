import { test, expect, type Browser, type Page } from "@playwright/test";

// The session, driven from real browsers through a local relay (design/surfaces/session.html).
// Each person is their own browser context, as on separate machines.

async function person(browser: Browser): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/proofs/pages/session.html");
  await page.waitForFunction(() => document.body.dataset.ready === "yes");
  return page;
}

type Now = {
  link: string;
  who: { player: string; host: boolean } | { watching: true };
  connection: string;
  disagreement: boolean;
  badSignatures: number[];
  table: { players: Record<string, { name: string }>; models: Record<string, { position: { x: number; y: number }; path: { x: number; y: number }[] }>; rolls: { result: number[]; tampered: boolean }[] };
  log: { entries: unknown[] };
};

const now = (page: Page) => page.evaluate(() => (window as any).proof.now as Now);
const act = (page: Page, action: unknown) => page.evaluate((a) => (window as any).proof.session.act(a), action);

const army = {
  kind: "add to army",
  units: [{ id: "scouts", name: "Scouts" }],
  models: [
    {
      id: "scout-1",
      unit: "scouts",
      name: "Scout",
      base: { shape: "round", width: 25, depth: 25 },
      height: 1.2,
      position: { x: 10, y: 5 },
      facing: 0,
      floor: null,
    },
  ],
  groups: [],
};

test("proof 1: two browsers, one model moved, both see it", async ({ browser }) => {
  const ana = await person(browser);
  const ben = await person(browser);

  const link = await ana.evaluate(() => (window as any).proof.open({ width: 60, depth: 44 }, { name: "Ana", colour: "#d1453b" }));
  expect(link).toMatch(/\?game=[A-Za-z0-9_-]{8}-[A-Za-z0-9_-]{22}$/);
  await act(ana, army);

  await ben.evaluate((link) => (window as any).proof.enter(link, { name: "Ben", colour: "#2f6fd6" }), link);
  await expect.poll(async () => (await now(ben)).connection).toBe("playing");
  await expect.poll(async () => Object.values((await now(ana)).table.players).map((p) => p.name).sort()).toEqual(["Ana", "Ben"]);
  expect((await now(ben)).table.models["scout-1"]!.position).toEqual({ x: 10, y: 5 });

  // Ana moves her scout around a corner; Ben sees where it went and the path it took.
  await act(ana, { kind: "move", moves: [{ model: "scout-1", position: { x: 16, y: 9 }, facing: 90, floor: null, path: [{ x: 10, y: 9 }] }] });
  await expect.poll(async () => (await now(ben)).table.models["scout-1"]!.position).toEqual({ x: 16, y: 9 });
  expect((await now(ben)).table.models["scout-1"]!.path).toEqual([{ x: 10, y: 9 }]);
  expect((await now(ben)).disagreement).toBe(false);
});

test("a player who is not the host acts through the host, and a spectator follows but can't act", async ({ browser }) => {
  const ana = await person(browser);
  const ben = await person(browser);
  const cy = await person(browser);
  const link = await ana.evaluate(() => (window as any).proof.open({ width: 60, depth: 44 }, { name: "Ana", colour: "#d1453b" }));
  await ben.evaluate((link) => (window as any).proof.enter(link, { name: "Ben", colour: "#2f6fd6" }), link);
  await cy.evaluate((link) => (window as any).proof.enter(link, "watch"), link);

  await act(ben, { ...army, units: [{ id: "bens", name: "Ben's scouts" }], models: [{ ...army.models[0], id: "b-1", unit: "bens" }] });
  await expect.poll(async () => Object.keys((await now(ana)).table.models)).toEqual(["b-1"]);
  await expect.poll(async () => Object.keys((await now(cy)).table.models)).toEqual(["b-1"]);
  expect((await now(cy)).who).toEqual({ watching: true });

  const refused = await cy.evaluate(() => (window as any).proof.session.act({ kind: "phase", phase: { round: 1, turn: null, name: "Deploy" } }).then(() => "accepted", (e: Error) => e.message));
  expect(refused).toMatch(/Spectators/);
  // A problem the record finds is refused with nothing logged.
  const before = (await now(ana)).log.entries.length;
  const problem = await ben.evaluate(() => (window as any).proof.session.act({ kind: "set aside", models: ["nobody"] }).then(() => "accepted", (e: Error) => e.message));
  expect(problem).toMatch(/nobody/);
  expect((await now(ana)).log.entries.length).toBe(before);
});

test("a roll uses the sealed exchange: both browsers see the same signed result", async ({ browser }) => {
  const ana = await person(browser);
  const ben = await person(browser);
  const link = await ana.evaluate(() => (window as any).proof.open({ width: 60, depth: 44 }, { name: "Ana", colour: "#d1453b" }));
  await ben.evaluate((link) => (window as any).proof.enter(link, { name: "Ben", colour: "#2f6fd6" }), link);

  const bens = await ben.evaluate(() => (window as any).proof.session.roll(10, 6, "to hit") as Promise<number[]>);
  const anas = await ana.evaluate(() => (window as any).proof.session.roll(3, 6) as Promise<number[]>);
  expect(bens).toHaveLength(10);
  expect(anas).toHaveLength(3);
  for (const d of [...bens, ...anas]) expect(d).toBeGreaterThanOrEqual(1), expect(d).toBeLessThanOrEqual(6);
  await expect.poll(async () => (await now(ana)).table.rolls.map((r) => r.result)).toEqual([bens, anas]);
  await expect.poll(async () => (await now(ben)).table.rolls.map((r) => r.result)).toEqual([bens, anas]);
  for (const p of [ana, ben]) {
    await expect.poll(async () => (await now(p)).badSignatures).toEqual([]);
    expect((await now(p)).table.rolls.every((r) => !r.tampered)).toBe(true);
  }
});

test("the host leaves and comes back: the game pauses, then resumes from the host's log", async ({ browser }) => {
  const anaContext = await browser.newContext();
  let ana = await anaContext.newPage();
  await ana.goto("/proofs/pages/session.html");
  await ana.waitForFunction(() => document.body.dataset.ready === "yes");
  const ben = await person(browser);
  const link = await ana.evaluate(() => (window as any).proof.open({ width: 60, depth: 44 }, { name: "Ana", colour: "#d1453b" }));
  await ben.evaluate((link) => (window as any).proof.enter(link, { name: "Ben", colour: "#2f6fd6" }), link);
  await act(ana, army);
  await expect.poll(async () => Object.keys((await now(ben)).table.models)).toEqual(["scout-1"]);

  await ana.close();
  await expect.poll(async () => (await now(ben)).connection, { timeout: 20_000 }).toBe("host away");
  const paused = await ben.evaluate(() => (window as any).proof.session.act({ kind: "phase", phase: { round: 1, turn: null, name: "Deploy" } }).then(() => "accepted", (e: Error) => e.message));
  expect(paused).toMatch(/host is away/);

  // The same browser opens the link again and is the host again, with the game it saved.
  ana = await anaContext.newPage();
  await ana.goto("/proofs/pages/session.html");
  await ana.waitForFunction(() => document.body.dataset.ready === "yes");
  await ana.evaluate((link) => (window as any).proof.enter(link, { name: "Ana", colour: "#d1453b" }), link);
  expect((await now(ana)).who).toEqual({ player: expect.any(String), host: true });
  await expect.poll(async () => (await now(ben)).connection, { timeout: 20_000 }).toBe("playing");
  await act(ben, { kind: "phase", phase: { round: 1, turn: null, name: "Deploy" } });
  await expect.poll(async () => (await now(ana)).log.entries.length).toBe((await now(ben)).log.entries.length);
});
