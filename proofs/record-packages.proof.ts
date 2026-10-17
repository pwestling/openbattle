import { test, expect, type Page } from "@playwright/test";
import * as nodeRecord from "../src/record/index.ts";

// What the Record keeps for rules packages (ADR-025 to ADR-027, ADR-029): items, markers, reserves,
// priority, the game's rules package and notes on actions, driven through its public face in Chromium.

type RecordModule = typeof nodeRecord;
type Log = ReturnType<RecordModule["newLog"]>;

const players = `const annKey = "YW5uJ3Mga2V5", ann = "SoweuLK7skk73J7j96M1ew";
const boKey = "Ym8ncyBrZXk", bo = "O5bDnDqwoYALSkMu-2db0w";
const link = "Xy3kP9qA-SoweuLK7skk73J7j96M1ew";
// An undo of the latest uncancelled action (ADR-033), or of nothing when there is none.
const undo = (log) => { const c = new Set(window.record.tableAt(log).cancelled); return { kind: "undo", of: log.entries.findLast((e) => e.action.kind !== "undo" && !c.has(e.n))?.n ?? 0 }; };`;
const [annKey, ann] = ["YW5uJ3Mga2V5", "SoweuLK7skk73J7j96M1ew"];
const [boKey, bo] = ["Ym8ncyBrZXk", "O5bDnDqwoYALSkMu-2db0w"];
const link = `Xy3kP9qA-${ann}`;
// The same undo, for the type checker; the browser page uses the copy in the text above.
const undo = (log: Log) => {
  const cancelled = new Set(nodeRecord.tableAt(log).cancelled);
  return { kind: "undo" as const, of: log.entries.findLast((e) => e.action.kind !== "undo" && !cancelled.has(e.n))?.n ?? 0 };
};

// Ann and Bo join; Ann brings a squad of two whose models carry weapons with their stats.
const opening = (r: RecordModule): Log => {
  let log = r.newLog({ width: 72, depth: 48 }, link, ann);
  log = r.append(log, { kind: "join", name: "Ann", colour: "#c33", publicKey: annKey }, ann);
  log = r.append(log, { kind: "join", name: "Bo", colour: "#33c", publicKey: boKey }, bo);
  const base = { shape: "round" as const, width: 32, depth: 32 };
  log = r.append(
    log,
    {
      kind: "add to army",
      units: [{ id: "u1", name: "Battle Brothers", counters: { Quality: 3, Defense: 3 }, marks: ["Fearless"] }],
      models: [
        { id: "m1", unit: "u1", name: "Brother 1", base, height: 1.2, position: { x: 5, y: 5 }, facing: 0, floor: null, counters: { Tough: 1 } },
        { id: "m2", unit: "u1", name: "Brother 2", base, height: 1.2, position: { x: 7, y: 5 }, facing: 0, floor: null },
      ],
      items: [
        { id: "w1", name: "Heavy Rifle", carrier: "m1", counters: { Range: 24, Attacks: 1, AP: 1 } },
        { id: "w2", name: "Heavy Rifle", carrier: "m2", counters: { Range: 24, Attacks: 1, AP: 1 }, marks: ["Rending"] },
      ],
      groups: [],
    },
    ann,
  );
  return log;
};

type Scenario<T> = (r: RecordModule, start: typeof opening) => T;

async function inBrowser<T>(page: Page, scenario: Scenario<T>): Promise<T> {
  return page.evaluate(`(() => { ${players} return (${scenario.toString()})(window.record, ${opening.toString()}); })()`) as Promise<T>;
}

test.beforeEach(async ({ page }) => {
  await page.goto("/proofs/pages/record.html");
  await expect(page.locator("body[data-ready=yes]")).toBeAttached();
});

test("an army arrives with its stats as counters and marks, and its weapons as items on its models", async ({ page }) => {
  const t = await inBrowser(page, (r, start) => r.tableAt(start(r)));
  expect(t.counters.unit.u1).toEqual({ Quality: 3, Defense: 3 });
  expect(t.marks.unit.u1).toEqual(["Fearless"]);
  expect(t.counters.model.m1).toEqual({ Tough: 1 });
  expect(t.items.w1).toEqual({ id: "w1", name: "Heavy Rifle", carrier: "m1" });
  expect(t.counters.item.w2).toEqual({ Range: 24, Attacks: 1, AP: 1 });
  expect(t.marks.item.w2).toEqual(["Rending"]);
});

test("items can hold items, move between carriers and be removed with what they hold, but never hold themselves", async ({ page }) => {
  const seen = await inBrowser(page, (r, start) => {
    let log = start(r);
    const take = (action: Parameters<RecordModule["append"]>[1], by = ann) => (log = r.append(log, action, by));
    take({ kind: "item", item: { id: "h1", name: "Hardpoint", carrier: "m1" } });
    take({ kind: "item", item: { id: "w1", name: "Heavy Rifle", carrier: "h1" } });
    take({ kind: "counter", target: { item: "w1" }, name: "Attacks", value: 2 });
    take({ kind: "mark", target: { item: "h1" }, name: "Turret", on: true });
    const nested = r.tableAt(log);
    const itself = r.check(log, { kind: "item", item: { id: "h1", name: "Hardpoint", carrier: "w1" } }, ann);
    const ownHolder = r.check(log, { kind: "item", item: { id: "h1", name: "Hardpoint", carrier: "h1" } }, ann);
    const nowhere = r.check(log, { kind: "item", item: { id: "x1", name: "Grenade", carrier: "u1" } }, ann);
    const takenId = r.check(log, { kind: "item", item: { id: "m2", name: "Grenade", carrier: "m1" } }, ann);
    take({ kind: "item", item: { id: "h1", name: "Turret mount", carrier: "m2" } });
    const moved = r.tableAt(log);
    take({ kind: "remove item", item: "h1" });
    const removed = r.tableAt(log);
    take(undo(log));
    const back = r.tableAt(log);
    return { nested, itself, ownHolder, nowhere, takenId, moved, removed, back };
  });
  expect(seen.nested.items.w1?.carrier).toBe("h1");
  expect(seen.nested.counters.item.w1?.Attacks).toBe(2);
  expect(seen.itself?.problem).toMatch(/hold itself/);
  expect(seen.ownHolder?.problem).toMatch(/hold itself/);
  expect(seen.nowhere?.problem).toMatch(/carried by a model or held by an item/);
  expect(seen.takenId?.problem).toMatch(/already names a model/);
  expect(seen.moved.items.h1).toEqual({ id: "h1", name: "Turret mount", carrier: "m2" });
  expect(seen.moved.items.w1?.carrier).toBe("h1");
  expect(seen.removed.items.h1).toBeUndefined();
  expect(seen.removed.items.w1).toBeUndefined();
  expect(seen.removed.counters.item.w1).toBeUndefined();
  expect(seen.removed.marks.item.h1).toBeUndefined();
  expect(seen.removed.items.w2).toBeDefined();
  expect(seen.back.items.w1?.carrier).toBe("h1");
});

test("a player can't arm another player's models when bringing an army", async ({ page }) => {
  const problem = await inBrowser(page, (r, start) =>
    r.check(start(r), { kind: "add to army", units: [], models: [], groups: [], items: [{ id: "w9", name: "Bomb", carrier: "m1" }] }, bo),
  );
  expect(problem?.problem).toMatch(/another player's army/);
});

test("markers belong to nobody: anyone places, moves and removes them, and they carry counters and marks", async ({ page }) => {
  const seen = await inBrowser(page, (r, start) => {
    let log = start(r);
    const take = (action: Parameters<RecordModule["append"]>[1], by = ann) => (log = r.append(log, action, by));
    const objective = { id: "o1", name: "Objective 1", colour: "#eee", shape: "disc" as const, width: 1.25, depth: 1.25, position: { x: 36, y: 24 }, facing: 0 };
    take({ kind: "place marker", marker: objective });
    take({ kind: "mark", target: { marker: "o1" }, name: "Held by Ann", on: true }, bo);
    take({ kind: "place marker", marker: { ...objective, position: { x: 30, y: 20 } } }, bo);
    const moved = r.tableAt(log);
    const egg = r.check(log, { kind: "place marker", marker: { ...objective, id: "o2", width: 2 } }, ann);
    const zone = r.check(log, { kind: "place marker", marker: { id: "z1", name: "Ann's zone", colour: "#c33", shape: "rect", width: 72, depth: 12, position: { x: 36, y: 6 }, facing: 0 } }, ann);
    take({ kind: "remove marker", marker: "o1" }, bo);
    return { moved, egg, zone, after: r.tableAt(log) };
  });
  expect(seen.moved.markers.o1?.position).toEqual({ x: 30, y: 20 });
  expect(seen.moved.marks.marker.o1).toEqual(["Held by Ann"]);
  expect(seen.egg?.problem).toMatch(/disc's width and depth must be equal/);
  expect(seen.zone).toBeNull();
  expect(seen.after.markers.o1).toBeUndefined();
  expect(seen.after.marks.marker.o1).toBeUndefined();
});

test("terrain carries counters and marks, which go with it when it is removed", async ({ page }) => {
  const seen = await inBrowser(page, (r, start) => {
    let log = start(r);
    const take = (action: Parameters<RecordModule["append"]>[1], by = ann) => (log = r.append(log, action, by));
    take({ kind: "place terrain", terrain: { id: "t1", name: "Ruin", shape: { kind: "box", width: 6, depth: 6, height: 3 }, position: { x: 20, y: 15 }, facing: 0, floors: [] } });
    take({ kind: "mark", target: { terrain: "t1" }, name: "Cover", on: true }, bo);
    const marked = r.tableAt(log).marks.terrain.t1;
    take({ kind: "remove terrain", terrain: "t1" });
    return { marked, after: r.tableAt(log).marks.terrain.t1 };
  });
  expect(seen.marked).toEqual(["Cover"]);
  expect(seen.after).toBeUndefined();
});

test("a model in reserve is kept apart from a removed one, and returns to the table the same way", async ({ page }) => {
  const seen = await inBrowser(page, (r, start) => {
    let log = start(r);
    const take = (action: Parameters<RecordModule["append"]>[1], by = ann) => (log = r.append(log, action, by));
    const odd = r.check(log, { kind: "set aside", models: ["m1"], to: "lost" as "removed" }, ann);
    take({ kind: "set aside", models: ["m1"], to: "reserve" });
    take({ kind: "set aside", models: ["m2"] });
    const aside = r.tableAt(log).models;
    const moveInReserve = r.check(log, { kind: "move", moves: [{ model: "m1", position: { x: 1, y: 1 }, facing: 0, floor: null, path: [] }] }, ann);
    take({ kind: "return", models: [{ model: "m1", position: { x: 40, y: 40 }, facing: 180, floor: null }] });
    return { aside, moveInReserve, odd, back: r.tableAt(log).models.m1 };
  });
  expect(seen.aside.m1?.place).toEqual({ in: "reserve" });
  expect(seen.aside.m2?.place).toEqual({ in: "removed" });
  expect(seen.moveInReserve?.problem).toMatch(/set aside/);
  expect(seen.odd?.problem).toMatch(/removed or into reserve/);
  expect(seen.back?.place).toEqual({ in: "table", position: { x: 40, y: 40 }, facing: 180, floor: null });
});

test("priority names who the game waits on, any player can hand it over, and it never stops anyone acting", async ({ page }) => {
  const seen = await inBrowser(page, (r, start) => {
    let log = start(r);
    const take = (action: Parameters<RecordModule["append"]>[1], by = ann) => (log = r.append(log, action, by));
    const before = r.tableAt(log).priority;
    take({ kind: "priority", players: [bo], note: "Roll 7 blocks, 4+" });
    const handed = r.tableAt(log).priority;
    // Ann acts without priority, and nothing refuses it.
    take({ kind: "counter", target: { unit: "u1" }, name: "Wounds", value: 1 });
    take({ kind: "priority", players: [] }, bo);
    const nobody = r.tableAt(log).priority;
    const stranger = r.check(log, { kind: "priority", players: ["nobody-here"] }, ann);
    return { before, handed, nobody, stranger };
  });
  expect(seen.before).toEqual({ players: [], note: "" });
  expect(seen.handed).toEqual({ players: [bo], note: "Roll 7 blocks, 4+" });
  expect(seen.nobody).toEqual({ players: [], note: "" });
  expect(seen.stranger?.problem).toMatch(/has not joined/);
});

test("the game names its rules package by an action, and any action can carry a note, except a roll, whose label is its note", async ({ page }) => {
  const seen = await inBrowser(page, (r, start) => {
    let log = start(r);
    const take = (action: Parameters<RecordModule["append"]>[1], by = ann) => (log = r.append(log, action, by));
    const none = r.tableAt(log).rules;
    take({ kind: "rules", name: "Grimdark Future" }, bo);
    const on = r.tableAt(log).rules;
    take({ kind: "mark", target: { unit: "u1" }, name: "Shaken", on: true, note: "Failed morale: rolled 2, needed 4+" });
    const note = log.entries.at(-1)?.action.note;
    const badNote = r.check(log, { kind: "mark", target: { unit: "u1" }, name: "Shaken", on: false, note: 5 as unknown as string }, ann);
    const rollNote = r.check(log, { kind: "roll", dice: 1, sides: 6, link, seal: "s", hostValue: "h", guestValue: "g", guestBy: null, note: "why" }, ann);
    take({ kind: "rules", name: null });
    return { none, on, note, badNote, rollNote, off: r.tableAt(log).rules };
  });
  expect(seen.none).toBeNull();
  expect(seen.on).toBe("Grimdark Future");
  expect(seen.note).toBe("Failed morale: rolled 2, needed 4+");
  expect(seen.badNote?.problem).toMatch(/note must be text/);
  expect(seen.rollNote?.problem).toMatch(/label is its note/);
  expect(seen.off).toBeNull();
});
