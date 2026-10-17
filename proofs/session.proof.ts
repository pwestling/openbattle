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
  expect((await now(ben)).table.models["scout-1"]!.place).toEqual({ in: "table", position: { x: 10, y: 5 }, facing: 0, floor: null });

  // Ana moves her scout around a corner; Ben sees where it went and the path it took.
  await act(ana, { kind: "move", moves: [{ model: "scout-1", position: { x: 16, y: 9 }, facing: 90, floor: null, path: [{ x: 10, y: 9 }] }] });
  await expect.poll(async () => (await now(ben)).table.models["scout-1"]!.place).toEqual({ in: "table", position: { x: 16, y: 9 }, facing: 90, floor: null });
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

type Alone = { rolls: { alone: boolean }[] };
const rolls = async (page: Page) => ((await now(page)).table as unknown as Alone).rolls.map((r) => r.alone);
const fairness = (page: Page) =>
  page.evaluate(() => {
    const n = (window as any).proof.now;
    return { aloneWhileHere: n.aloneWhileHere as number[], unusedValues: n.unusedValues as unknown[] };
  });

test("with nobody else connected, the host rolls alone, and everyone sees it marked so", async ({ browser }) => {
  const ana = await person(browser);
  const link = await ana.evaluate(() => (window as any).proof.open({ width: 60, depth: 44 }, { name: "Ana", colour: "#d1453b" }));
  const alone = await ana.evaluate(() => (window as any).proof.session.roll(4, 6) as Promise<number[]>);
  expect(alone).toHaveLength(4);
  expect(await rolls(ana)).toEqual([true]);

  // Ben arrives later: he sees the roll marked as rolled alone, but it was not taken while he was here.
  const ben = await person(browser);
  await ben.evaluate((link) => (window as any).proof.enter(link, { name: "Ben", colour: "#2f6fd6" }), link);
  await expect.poll(() => rolls(ben)).toEqual([true]);
  expect(await fairness(ben)).toEqual({ aloneWhileHere: [], unusedValues: [] });
  expect((await now(ben)).badSignatures).toEqual([]);

  // With Ben connected, Ana's next roll uses the sealed exchange.
  await ana.evaluate(() => (window as any).proof.session.roll(2, 6));
  await expect.poll(() => rolls(ben)).toEqual([true, false]);
  expect(await fairness(ben)).toEqual({ aloneWhileHere: [], unusedValues: [] });
});

async function rogueHost(browser: Browser): Promise<{ rogue: Page; link: string }> {
  const rogue = await (await browser.newContext()).newPage();
  await rogue.goto("/proofs/pages/rogue-host.html");
  await rogue.waitForFunction(() => document.body.dataset.ready === "yes");
  return { rogue, link: await rogue.evaluate(() => (window as any).rogue.start()) };
}

test("a player's browser flags a roll the host took alone while they were connected", async ({ browser }) => {
  const { rogue, link } = await rogueHost(browser);
  const ben = await person(browser);
  await ben.evaluate((link) => (window as any).proof.enter(link, { name: "Ben", colour: "#2f6fd6" }), link);
  await expect.poll(async () => Object.keys((await now(ben)).table.players).length).toBe(2);

  await rogue.evaluate(() => (window as any).rogue.rollAlone());
  await expect.poll(() => rolls(ben)).toEqual([true]);
  const n = (await now(ben)).log.entries.length;
  expect(await fairness(ben)).toEqual({ aloneWhileHere: [n], unusedValues: [] });
});

test("a player is told when the host never logged the value they signed", async ({ browser }) => {
  const { rogue, link } = await rogueHost(browser);
  const ben = await person(browser);
  await ben.evaluate((link) => (window as any).proof.enter(link, { name: "Ben", colour: "#2f6fd6" }), link);
  await expect.poll(async () => Object.keys((await now(ben)).table.players).length).toBe(2);
  const benId = ((await now(ben)).who as { player: string }).player;

  // The host asks Ben for two values, then logs only the second, as if fishing for a better roll.
  await rogue.evaluate((to) => (window as any).rogue.askValue(to, 1), benId);
  await rogue.evaluate((to) => (window as any).rogue.askValue(to, 2), benId);
  await rogue.waitForFunction(() => (window as any).rogue.values.length === 2);
  expect(await fairness(ben)).toEqual({ aloneWhileHere: [], unusedValues: [] });
  await rogue.evaluate(() => (window as any).rogue.use(2));
  await expect.poll(() => rolls(ben)).toEqual([false]);
  expect(await fairness(ben)).toEqual({ aloneWhileHere: [], unusedValues: [{ kind: "roll", dice: 2, sides: 6 }] });
  expect((await now(ben)).badSignatures).toEqual([]);
});

test("signatures in a saved file are checked when it opens as a new game, so an edited roll shows as tampered", async ({ browser }) => {
  const ana = await person(browser);
  const ben = await person(browser);
  const link = await ana.evaluate(() => (window as any).proof.open({ width: 60, depth: 44 }, { name: "Ana", colour: "#d1453b" }));
  await ben.evaluate((link) => (window as any).proof.enter(link, { name: "Ben", colour: "#2f6fd6" }), link);
  await ana.evaluate(() => (window as any).proof.session.roll(2, 6));
  await ana.evaluate(() => (window as any).proof.session.leave());
  const benId = ((await now(ben)).who as { player: string }).player;

  // Ana edits her saved file: an honest roll gets a new value, and a roll made alone is passed off as Ben's.
  const saved = (await now(ana)).log as any;
  const edited = structuredClone(saved);
  const roll = edited.entries.find((e: any) => e.action.kind === "roll").action;
  roll.guestValue = roll.guestValue.slice(1) + "A";
  const hostValue = "made-up";
  const seal = await ana.evaluate(async (v) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v)))].map((b) => b.toString(16).padStart(2, "0")).join(""), hostValue);
  edited.entries.push({ n: edited.entries.length + 1, by: saved.host, action: { kind: "roll", dice: 2, sides: 6, link: saved.link, seal, hostValue, guestValue: "also-made-up", guestBy: benId, guestSignature: roll.guestSignature } });
  const rollsAt = edited.entries.filter((e: any) => e.action.kind === "roll").map((e: any) => e.n);

  const carl = await person(browser);
  await carl.evaluate((log) => (window as any).proof.open({ width: 60, depth: 44 }, { name: "Carl", colour: "#3a9d4f" }, log), edited);
  await expect.poll(async () => (await now(carl)).badSignatures).toEqual(rollsAt);
  expect(await rolls(carl)).toEqual([false, false]);
});

test("a host can't slip a roll past a player in a whole log, or rewrite one", async ({ browser }) => {
  const { rogue, link } = await rogueHost(browser);
  const ben = await person(browser);
  await ben.evaluate((link) => (window as any).proof.enter(link, { name: "Ben", colour: "#2f6fd6" }), link);
  await expect.poll(async () => Object.keys((await now(ben)).table.players).length).toBe(2);
  const before = (await now(ben)).log.entries.length;

  // A whole log Ben did not ask for is ignored; the host's next entry then doesn't follow on from his.
  await rogue.evaluate(() => (window as any).rogue.rollAloneInALog());
  await rogue.evaluate(() => (window as any).rogue.rollAlone());
  await expect.poll(async () => (await now(ben)).disagreement).toBe(true);
  expect((await now(ben)).log.entries.length).toBe(before);

  // Asked to resync, the host sends a log with an entry rewritten: Ben keeps his own and still disagrees.
  await rogue.evaluate((n) => (window as any).rogue.rewriteOnResync(n), before);
  const resync = await ben.evaluate(() => (window as any).proof.session.resync().then(() => "agreed", (e: Error) => e.message));
  expect(resync).toMatch(/changes entries/);
  expect((await now(ben)).disagreement).toBe(true);
  expect((await now(ben)).log.entries.length).toBe(before);
});

test("a roll the host took alone and held back is still flagged when the player resyncs", async ({ browser }) => {
  const { rogue, link } = await rogueHost(browser);
  const ben = await person(browser);
  await ben.evaluate((link) => (window as any).proof.enter(link, { name: "Ben", colour: "#2f6fd6" }), link);
  await expect.poll(async () => Object.keys((await now(ben)).table.players).length).toBe(2);
  const n = (await now(ben)).log.entries.length + 1;

  await rogue.evaluate(() => (window as any).rogue.rollAloneUnsent());
  await expect.poll(async () => (await now(ben)).disagreement).toBe(true);
  await ben.evaluate(() => (window as any).proof.session.resync());
  expect((await now(ben)).disagreement).toBe(false);
  expect(await rolls(ben)).toEqual([true]);
  expect(await fairness(ben)).toEqual({ aloneWhileHere: [n], unusedValues: [] });
});

test("a player signs only the roll they asked for, not one the host relabels", async ({ browser }) => {
  const { rogue, link } = await rogueHost(browser);
  const ben = await person(browser);
  await ben.evaluate((link) => (window as any).proof.enter(link, { name: "Ben", colour: "#2f6fd6" }), link);
  await expect.poll(async () => Object.keys((await now(ben)).table.players).length).toBe(2);

  await rogue.evaluate(() => (window as any).rogue.relabelAsks());
  const roll = await ben.evaluate(() => (window as any).proof.session.roll(2, 6, "to hit").then(() => "rolled", (e: Error) => e.message));
  expect(roll).toMatch(/different roll/);
  expect(await rogue.evaluate(() => (window as any).rogue.values.length)).toBe(0);
});
