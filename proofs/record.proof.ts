import { test, expect, type Page } from "@playwright/test";
import * as nodeRecord from "../src/record/index.ts";

// The Record module, driven through its public face in real Chromium (ADR-018).
// There is no screen yet, so a proof page loads the module and these proofs call it as Session will.

type RecordModule = typeof nodeRecord;
type Log = ReturnType<RecordModule["newLog"]>;

// A short game several proofs start from: two players join, Ann brings a unit of two models and moves them.
const opening = (r: RecordModule): Log => {
  let log = r.newLog({ width: 44, depth: 30 });
  log = r.append(log, { kind: "join", name: "Ann", colour: "#c33", publicKey: "key-Ann" }, "ann");
  log = r.append(log, { kind: "join", name: "Bo", colour: "#33c", publicKey: "key-Bo" }, "bo");
  const base = { shape: "round" as const, width: 32, depth: 32 };
  log = r.append(
    log,
    {
      kind: "add to army",
      units: [{ id: "u1", name: "Wardens" }],
      models: [
        { id: "m1", unit: "u1", name: "Warden 1", base, height: 1.2, position: { x: 5, y: 5 }, facing: 0, floor: null },
        { id: "m2", unit: "u1", name: "Warden 2", base, height: 1.2, position: { x: 7, y: 5 }, facing: 0, floor: null },
      ],
      groups: [{ id: "army-ann", name: "Ann's army", members: ["u1"] }],
    },
    "ann",
  );
  log = r.append(
    log,
    {
      kind: "move",
      moves: [
        { model: "m1", position: { x: 5, y: 11 }, facing: 0, floor: null, path: [{ x: 5, y: 8 }] },
        { model: "m2", position: { x: 7, y: 11 }, facing: 0, floor: null, path: [] },
      ],
    },
    "ann",
  );
  return log;
};

type Scenario<T> = (r: RecordModule, start: typeof opening) => T;

/** Runs a scenario against the Record module as loaded in the browser page. */
async function inBrowser<T>(page: Page, scenario: Scenario<T>): Promise<T> {
  return page.evaluate(`(${scenario.toString()})(window.record, ${opening.toString()})`) as Promise<T>;
}

test.beforeEach(async ({ page }) => {
  await page.goto("/proofs/pages/record.html");
  await expect(page.locator("body[data-ready=yes]")).toBeAttached();
});

test("the table is worked out from the log, and appending never changes an earlier log", async ({ page }) => {
  const seen = await inBrowser(page, (r, start) => {
    const log = start(r);
    const after = r.tableAt(log);
    const longer = r.append(log, { kind: "phase", phase: { round: 1, turn: "ann", name: "Movement" } }, "ann");
    return {
      numbers: log.entries.map((e) => e.n),
      players: Object.values(after.players).map((p) => p.name),
      unitOwner: after.units.u1?.owner,
      before: r.tableAt(log, 3).models.m1?.position,
      after: after.models.m1?.position,
      path: after.models.m1?.path,
      oldLength: log.entries.length,
      newLength: longer.entries.length,
      phase: r.tableAt(longer).phase,
      sameAgain: JSON.stringify(r.tableAt(log)) === JSON.stringify(after),
      bare: r.tableAt(log, 0),
    };
  });
  expect(seen.numbers).toEqual([1, 2, 3, 4]);
  expect(seen.players).toEqual(["Ann", "Bo"]);
  expect(seen.unitOwner).toBe("ann");
  expect(seen.before).toEqual({ x: 5, y: 5 });
  expect(seen.after).toEqual({ x: 5, y: 11 });
  expect(seen.path).toEqual([{ x: 5, y: 8 }]);
  expect(seen.oldLength).toBe(4);
  expect(seen.newLength).toBe(5);
  expect(seen.phase).toEqual({ round: 1, turn: "ann", name: "Movement" });
  expect(seen.sameAgain).toBe(true);
  expect(seen.bare.models).toEqual({});
  expect(seen.bare.size).toEqual({ width: 44, depth: 30 });
});

test("every kind of action changes the table as the Record surface says", async ({ page }) => {
  const t = await inBrowser(page, (r, start) => {
    let log = start(r);
    const take = (action: Parameters<RecordModule["append"]>[1], by = "ann") => (log = r.append(log, action, by));
    take({ kind: "rename", name: "Annie", colour: "#a00" });
    const floors = [{ height: 3, outline: [{ x: -1, y: -1 }, { x: 1, y: -1 }, { x: 1, y: 1 }, { x: -1, y: 1 }] }];
    const ruin = { id: "t1", name: "Ruin", shape: { kind: "box" as const, width: 6, depth: 6, height: 3 }, position: { x: 20, y: 15 }, facing: 0, floors };
    take({ kind: "place terrain", terrain: ruin }, "bo");
    take({ kind: "place terrain", terrain: { id: "t2", name: "Hill", shape: { kind: "mesh", mesh: "ab12", width: 8, depth: 8, height: 2 }, position: { x: 30, y: 10 }, facing: 45, floors: [] } }, "bo");
    take({ kind: "move", moves: [{ model: "m1", position: { x: 20, y: 15 }, facing: 90, floor: { terrain: "t1", floor: 0 }, path: [] }] });
    const onRuin = r.tableAt(log).models.m1?.floor;
    take({ kind: "remove terrain", terrain: "t1" }, "bo");
    const afterRemove = r.tableAt(log);
    take({ kind: "add to army", units: [], models: [{ id: "m3", unit: "u1", name: "Warden 3", base: { shape: "oval", width: 60, depth: 35 }, mesh: "cd34", height: 2, position: { x: 9, y: 11 }, facing: 0, floor: null }], groups: [] });
    take({ kind: "add to army", units: [{ id: "u2", name: "Raiders" }], models: [{ id: "b1", unit: "u2", name: "Raider", base: { shape: "rect", width: 25, depth: 50 }, height: 1, position: { x: 30, y: 25 }, facing: 180, floor: null }], groups: [] }, "bo");
    take({ kind: "set aside", models: ["m2"] });
    const aside = r.tableAt(log).models.m2;
    take({ kind: "return", models: [{ model: "m2", position: { x: 8, y: 9 }, facing: 10, floor: null }] });
    take({ kind: "group", group: "g1", name: "Vanguard", members: ["u1", "army-ann"] });
    take({ kind: "group", group: "g1", name: "Vanguard!", members: ["u1"] }, "bo");
    const grouped = r.tableAt(log).groups.g1;
    take({ kind: "group", group: "g2", name: "Outer", members: ["g1"] });
    take({ kind: "ungroup", group: "g1" });
    take({ kind: "phase", phase: { round: 2, turn: "bo", name: "Shooting" } }, "bo");
    take({ kind: "counter", target: "m1", name: "wounds", value: 3 });
    take({ kind: "counter", target: "bo", name: "points", value: 5 }, "bo");
    take({ kind: "counter", target: "game", name: "round marker", value: 2 }, "bo");
    take({ kind: "counter", target: "bo", name: "points", value: null }, "bo");
    take({ kind: "mark", target: "u1", name: "has moved", on: true });
    take({ kind: "mark", target: "u1", name: "pinned", on: true }, "bo");
    take({ kind: "mark", target: "u1", name: "has moved", on: false });
    take({
      kind: "add deck", deck: "d1", name: "Missions", owner: null, order: "ordered", position: { x: 40, y: 2 },
      cards: [{ id: "c1", name: "Hold" }, { id: "c2", name: "Take", text: "Take the hill" }, { id: "c3", name: "Break", picture: "ef56" }, { id: "c4", name: "Scout" }],
    }, "bo");
    take({ kind: "draw", deck: "d1", cards: 1, to: "hand" });
    take({ kind: "draw", deck: "d1", cards: 1, to: "table" }, "bo");
    take({ kind: "move card", card: "c1", to: { in: "deck", deck: "d1" }, at: "bottom" });
    take({ kind: "move card", card: "c2", to: { in: "deck", deck: "d1" }, at: 1 }, "bo");
    const reordered = r.tableAt(log).decks.d1?.cards;
    take({ kind: "move card", card: "c3", to: { in: "table", position: { x: 1, y: 1 }, faceUp: false } }, "bo");
    take({ kind: "move card", card: "c3", to: { in: "discard", deck: "d1" } }, "bo");
    take({ kind: "move card", card: "c4", to: { in: "hand", player: "bo" } }, "bo");
    take({ kind: "shuffle", deck: "d1" }, "bo");
    return { table: r.tableAt(log), onRuin, afterRemove, aside, grouped, reordered };
  });
  // Renaming keeps the key the player joined with.
  expect(t.table.players.ann).toEqual({ id: "ann", name: "Annie", colour: "#a00", publicKey: "key-Ann" });
  expect(t.onRuin).toEqual({ terrain: "t1", floor: 0 });
  // Removing terrain puts the models standing on it back on the table, where they were.
  expect(t.afterRemove.terrain.t1).toBeUndefined();
  expect(t.afterRemove.models.m1?.floor).toBeNull();
  expect(t.afterRemove.models.m1?.position).toEqual({ x: 20, y: 15 });
  expect(t.table.terrain.t2?.shape).toEqual({ kind: "mesh", mesh: "ab12", width: 8, depth: 8, height: 2 });
  expect(t.table.models.m3).toMatchObject({ unit: "u1", mesh: "cd34", base: { shape: "oval", width: 60, depth: 35 } });
  expect(t.table.units.u2?.owner).toBe("bo");
  expect(t.aside?.aside).toBe(true);
  expect(t.table.models.m2).toMatchObject({ aside: false, position: { x: 8, y: 9 }, facing: 10 });
  // Another player may change a group, as at a real table, but it keeps its owner.
  expect(t.grouped).toEqual({ id: "g1", owner: "ann", name: "Vanguard!", members: ["u1"] });
  expect(t.table.groups.g1).toBeUndefined();
  expect(t.table.groups.g2?.members).toEqual([]);
  expect(t.table.units.u1).toBeDefined();
  expect(t.table.phase).toEqual({ round: 2, turn: "bo", name: "Shooting" });
  expect(t.table.counters).toEqual({ m1: { wounds: 3 }, game: { "round marker": 2 } });
  expect(t.table.marks).toEqual({ u1: ["pinned"] });
  expect(t.reordered).toEqual(["c3", "c2", "c4", "c1"]);
  expect(t.table.cards.c1?.place).toEqual({ in: "deck", deck: "d1" });
  expect(t.table.cards.c2).toMatchObject({ text: "Take the hill", place: { in: "deck", deck: "d1" } });
  expect(t.table.cards.c3).toMatchObject({ picture: "ef56", place: { in: "discard", deck: "d1" } });
  expect(t.table.cards.c4?.place).toEqual({ in: "hand", player: "bo" });
  expect(t.table.decks.d1).toMatchObject({ order: "shuffled", cards: ["c2", "c1"] });
});

test("check says in plain words why an action can't be taken, and append refuses it", async ({ page }) => {
  const seen = await inBrowser(page, (r, start) => {
    const log = start(r);
    const p = (action: unknown, by = "ann") => r.check(log, action as Parameters<RecordModule["check"]>[1], by)?.problem ?? null;
    let thrown = "";
    try {
      r.append(log, { kind: "set aside", models: ["nobody"] }, "ann");
    } catch (e) {
      thrown = (e as Error).message;
    }
    return {
      fine: p({ kind: "set aside", models: ["m1"] }),
      missingModel: p({ kind: "set aside", models: ["nobody"] }),
      infinite: p({ kind: "move", moves: [{ model: "m1", position: { x: Infinity, y: 0 }, facing: 0, floor: null, path: [] }] }),
      notANumber: p({ kind: "counter", target: "m1", name: "wounds", value: NaN }),
      selfGroup: p({ kind: "group", group: "army-ann", name: "Loop", members: ["army-ann"] }),
      loop: (() => {
        const two = r.append(log, { kind: "group", group: "g1", name: "Inner", members: ["army-ann"] }, "ann");
        return r.check(two, { kind: "group", group: "army-ann", name: "Ann's army", members: ["u1", "g1"] }, "ann")?.problem;
      })(),
      takenId: p({ kind: "add to army", units: [{ id: "m1", name: "Clash" }], models: [], groups: [] }),
      othersUnit: p({ kind: "add to army", units: [], models: [{ id: "x", unit: "u1", name: "Sneak", base: { shape: "round", width: 25, depth: 25 }, height: 1, position: { x: 1, y: 1 }, facing: 0, floor: null }], groups: [] }, "bo"),
      unevenRound: p({ kind: "add to army", units: [{ id: "u9", name: "Odd" }], models: [{ id: "x", unit: "u9", name: "Odd", base: { shape: "round", width: 25, depth: 30 }, height: 1, position: { x: 1, y: 1 }, facing: 0, floor: null }], groups: [] }),
      noFloor: p({ kind: "move", moves: [{ model: "m1", position: { x: 1, y: 1 }, facing: 0, floor: { terrain: "t9", floor: 0 }, path: [] }] }),
      stranger: p({ kind: "phase", phase: { round: 1, turn: null, name: "Setup" } }, "eve"),
      twiceJoined: p({ kind: "join", name: "Ann again", colour: "#000", publicKey: "key-Ann again" }),
      unknownKind: p({ kind: "teleport" }),
      malformed: p({ kind: "move" }),
      tooManyDice: p({ kind: "roll", dice: 1025, sides: 6, seal: "", hostValue: "", guestValue: "" }),
      oneSided: p({ kind: "roll", dice: 1, sides: 1, seal: "", hostValue: "", guestValue: "" }),
      unsigned: p({ kind: "roll", dice: 1, sides: 6, seal: "", hostValue: "", guestValue: "" }),
      noKey: p({ kind: "join", name: "Cy", colour: "#0c0" }, "cy"),
      thrown,
    };
  });
  expect(seen.fine).toBeNull();
  expect(seen.missingModel).toBe('There is no model "nobody".');
  expect(seen.thrown).toBe('There is no model "nobody".');
  expect(seen.infinite).toBe('Model "m1"\'s position must be a point with finite x and y.');
  expect(seen.notANumber).toBe("The counter's value must be a finite number.");
  expect(seen.selfGroup).toBe('Group "army-ann" would contain itself.');
  expect(seen.loop).toBe('Group "army-ann" would contain itself.');
  expect(seen.takenId).toBe('The id "m1" for the new unit already names a model.');
  expect(seen.othersUnit).toBe('Unit "u1" is in another player\'s army.');
  expect(seen.unevenRound).toBe('Model "x"\'s base is round, so its width and depth must be equal.');
  expect(seen.noFloor).toBe('Model "m1" is on terrain "t9", which is not on the table.');
  expect(seen.stranger).toBe('Player "eve" has not joined the game.');
  expect(seen.twiceJoined).toBe("This player has already joined.");
  expect(seen.unknownKind).toBe('"teleport" is not a kind of action.');
  expect(seen.malformed).toBe("The moves must be a list.");
  expect(seen.tooManyDice).toBe("A roll is 1 to 1024 dice.");
  expect(seen.oneSided).toBe("A die has a whole number of sides, at least two.");
  expect(seen.unsigned).toBe("A roll needs the other player's signature over their value.");
  expect(seen.noKey).toBe("The player's public key must be text.");
});

test("undo cancels the latest action, only for the player who took it, and looking back still shows it", async ({ page }) => {
  const seen = await inBrowser(page, (r, start) => {
    let log = start(r);
    log = r.append(log, { kind: "counter", target: "game", name: "score", value: 1 }, "bo");
    const boOnly = r.check(log, { kind: "undo" }, "ann")?.problem;
    log = r.append(log, { kind: "undo" }, "bo");
    const afterFirst = r.tableAt(log);
    // Ann's move (4) is now the latest standing action, so Ann can undo it, and then her army (3).
    const boCannot = r.check(log, { kind: "undo" }, "bo")?.problem;
    log = r.append(log, { kind: "undo" }, "ann");
    const afterSecond = r.tableAt(log);
    log = r.append(log, { kind: "undo" }, "ann");
    const afterThird = r.tableAt(log);
    return {
      boOnly,
      boCannot,
      scoreGone: afterFirst.counters,
      cancelled: [afterFirst.cancelled, afterSecond.cancelled, afterThird.cancelled],
      backHome: afterSecond.models.m1?.position,
      noArmy: Object.keys(afterThird.models),
      lookBack: r.tableAt(log, 5).counters,
      length: log.entries.length,
      bothJoined: r.check(log, { kind: "undo" }, "ann")?.problem,
    };
  });
  expect(seen.boOnly).toBe("Only the player who took the latest action can undo it.");
  expect(seen.boCannot).toBe("Only the player who took the latest action can undo it.");
  expect(seen.scoreGone).toEqual({});
  expect(seen.cancelled).toEqual([[5], [4, 5], [3, 4, 5]]);
  expect(seen.backHome).toEqual({ x: 5, y: 5 });
  expect(seen.noArmy).toEqual([]);
  expect(seen.lookBack).toEqual({ game: { score: 1 } });
  // The log only grows: three undos are three more actions.
  expect(seen.length).toBe(8);
  // Bo's join is now the latest standing action, so Ann cannot undo it.
  expect(seen.bothJoined).toBe("Only the player who took the latest action can undo it.");
});

// The sealed exchange (ADR-008): the host's value, its seal, and the other player's value.
const sealedWith = async (hostValue: string, guestValue: string) => {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(hostValue));
  const seal = Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
  // Session signs and checks the other player's value (ADR-022); the record only needs a signature there.
  return { seal, hostValue, guestValue, guestSignature: `signed ${guestValue}` };
};

test("a roll's result comes from both random values, the same in every browser, and a bad seal shows as tampered", async ({ page }) => {
  const host = "9f2c4e71d0a3b8e6c5f1a2d7e4b9c3a0";
  const fair = await sealedWith(host, "17e0c9b2a4d6f8e1");
  const otherGuest = await sealedWith(host, "a0b1c2d3e4f5a6b7");
  const roll = (r: RecordModule, sealed: Awaited<ReturnType<typeof sealedWith>>, by = "ann") => {
    const log = r.append(opening(r), { kind: "roll", dice: 10, sides: 6, label: "to hit", ...sealed }, by);
    return { log, roll: r.tableAt(log).rolls[0]! };
  };
  const seen = await page.evaluate(
    `(async () => {
      const r = window.record, opening = ${opening.toString()}, sealedWith = ${sealedWith.toString()};
      const roll = ${roll.toString()};
      const fair = ${JSON.stringify(fair)}, otherGuest = ${JSON.stringify(otherGuest)};
      const first = roll(r, fair);
      const many = [];
      for (let i = 0; i < 10; i++) {
        const log = r.append(opening(r), { kind: "roll", dice: 1024, sides: 6, ...(await sealedWith("host " + i, "guest " + i)) }, "bo");
        many.push(...r.tableAt(log).rolls[0].result);
      }
      return {
        first: first.roll,
        again: roll(r, fair).roll.result,
        otherGuest: roll(r, otherGuest).roll.result,
        tampered: roll(r, { ...fair, hostValue: "a different value" }).roll,
        undo: r.check(first.log, { kind: "undo" }, "ann")?.problem,
        counts: [1, 2, 3, 4, 5, 6].map((face) => many.filter((d) => d === face).length),
      };
    })()`,
  ) as {
    first: nodeRecord.Roll; again: number[]; otherGuest: number[]; tampered: nodeRecord.Roll; undo: string; counts: number[];
  };
  expect(seen.first).toMatchObject({ at: 5, by: "ann", dice: 10, sides: 6, label: "to hit", tampered: false });
  expect(seen.first.result).toHaveLength(10);
  expect(seen.first.result.every((d) => Number.isInteger(d) && d >= 1 && d <= 6)).toBe(true);
  expect(seen.again).toEqual(seen.first.result);
  // Node runs the same module outside the browser and gets the same dice.
  expect(roll(nodeRecord, fair).roll.result).toEqual(seen.first.result);
  // The other player's value changes the dice, so the host alone cannot pick them.
  expect(seen.otherGuest).not.toEqual(seen.first.result);
  // A host value that does not open the seal is still logged, flagged as tampered.
  expect(seen.tampered.tampered).toBe(true);
  expect(seen.tampered.result).toHaveLength(10);
  expect(seen.undo).toBe("A roll can't be undone: it happens once and its result never changes.");
  // 10,240 dice come up evenly: each face is within four standard deviations of a sixth.
  for (const count of seen.counts) expect(Math.abs(count - 10240 / 6)).toBeLessThan(160);
});

test("a shuffled deck is drawn from with the same sealed exchange, and a bad seal shows the draw as tampered", async ({ page }) => {
  const fair = await sealedWith("host value for the draw", "guest value for the draw");
  const draw = (r: RecordModule, sealed: Partial<Awaited<ReturnType<typeof sealedWith>>>, order: "ordered" | "shuffled" = "shuffled") => {
    let log = opening(r);
    const cards = Array.from({ length: 10 }, (_, i) => ({ id: `c${i}`, name: `Card ${i}` }));
    log = r.append(log, { kind: "add deck", deck: "d1", name: "Objectives", owner: "bo", order, cards, position: { x: 1, y: 1 } }, "bo");
    const action = { kind: "draw" as const, deck: "d1", cards: 3, to: "hand" as const, ...sealed };
    const problem = r.check(log, action, "bo")?.problem;
    if (problem) return { problem };
    log = r.append(log, action, "bo");
    const table = r.tableAt(log);
    return {
      drawn: Object.values(table.cards).filter((c) => c.place.in === "hand").map((c) => c.id),
      left: table.decks.d1!.cards,
      draws: table.draws,
      undo: r.check(log, { kind: "undo" }, "bo")?.problem,
    };
  };
  const seen = await page.evaluate(
    `(() => {
      const r = window.record, opening = ${opening.toString()}, draw = ${draw.toString()};
      const fair = ${JSON.stringify(fair)};
      return {
        fair: draw(r, fair),
        tampered: draw(r, { ...fair, hostValue: "something else" }),
        unsealed: draw(r, {}),
        orderedWithValues: draw(r, fair, "ordered"),
        ordered: draw(r, {}, "ordered"),
      };
    })()`,
  ) as Record<string, { drawn?: string[]; left?: string[]; draws?: nodeRecord.Draw[]; undo?: string; problem?: string }>;
  expect(seen.fair!.drawn).toHaveLength(3);
  expect(new Set([...seen.fair!.drawn!, ...seen.fair!.left!]).size).toBe(10);
  expect(draw(nodeRecord, fair)).toEqual(seen.fair);
  expect(seen.fair!.undo).toBe("A draw from a shuffled deck can't be undone, or it could be drawn again until it suited.");
  // The draw keeps the cards in the order they were picked.
  expect(seen.fair!.draws).toMatchObject([{ at: 6, by: "bo", deck: "d1", to: "hand", tampered: false }]);
  expect([...seen.fair!.draws![0]!.cards].sort()).toEqual(seen.fair!.drawn);
  // A host value that does not open the seal is still logged, and everyone sees the draw flagged as tampered.
  expect(seen.tampered!.drawn).toHaveLength(3);
  expect(seen.tampered!.draws?.[0]?.tampered).toBe(true);
  expect(seen.unsealed!.problem).toBe("A draw from a shuffled deck needs the seal and both random values.");
  expect(seen.orderedWithValues!.problem).toBe("An ordered deck gives its top cards; a draw from it has no random values.");
  expect(seen.ordered).toEqual({
    drawn: ["c0", "c1", "c2"],
    left: ["c3", "c4", "c5", "c6", "c7", "c8", "c9"],
    draws: [{ at: 6, by: "bo", deck: "d1", cards: ["c0", "c1", "c2"], to: "hand", tampered: false }],
    undo: undefined,
  });
});

test("equal tables have equal fingerprints, in the browser and out of it, and any change shows", async ({ page }) => {
  const seen = await inBrowser(page, (r, start) => {
    const log = start(r);
    const table = r.tableAt(log);
    // The same table with its keys written in another order, as a table loaded from elsewhere might be.
    const reordered = Object.fromEntries(Object.entries(table).reverse()) as typeof table;
    reordered.models = Object.fromEntries(Object.entries(table.models).reverse());
    const moved = r.tableAt(r.append(log, { kind: "move", moves: [{ model: "m2", position: { x: 7, y: 11.01 }, facing: 0, floor: null, path: [] }] }, "ann"));
    return {
      print: r.fingerprint(table),
      again: r.fingerprint(r.tableAt(start(r))),
      reordered: r.fingerprint(reordered),
      moved: r.fingerprint(moved),
      earlier: r.fingerprint(r.tableAt(log, 3)),
    };
  });
  expect(seen.print).toMatch(/^[0-9a-f]{16}$/);
  expect(seen.again).toBe(seen.print);
  expect(seen.reordered).toBe(seen.print);
  expect(nodeRecord.fingerprint(nodeRecord.tableAt(opening(nodeRecord)))).toBe(seen.print);
  expect(seen.moved).not.toBe(seen.print);
  expect(seen.earlier).not.toBe(seen.print);
});

test("ids that every object inherits, such as __proto__ and toString, can't break or pollute the game", async ({ page }) => {
  const seen = await inBrowser(page, (r, start) => {
    let log = start(r);
    const problems = [
      r.check(log, { kind: "counter", target: "__proto__", name: "polluted", value: 1 }, "ann")?.problem,
      r.check(log, { kind: "mark", target: "toString", name: "pinned", on: true }, "ann")?.problem,
      r.check(log, { kind: "move card", card: "constructor", to: { in: "hand", player: "ann" } }, "ann")?.problem,
      r.check(log, { kind: "set aside", models: ["hasOwnProperty"] }, "ann")?.problem,
    ];
    // Such an id is just a name when a player chooses it for something new.
    log = r.append(log, { kind: "add to army", units: [{ id: "__proto__", name: "Odd name" }], models: [], groups: [] }, "ann");
    log = r.append(log, { kind: "counter", target: "__proto__", name: "polluted", value: 1 }, "ann");
    const table = r.tableAt(log);
    return {
      problems,
      unit: table.units["__proto__"]?.name,
      counter: table.counters["__proto__"],
      polluted: "polluted" in {},
      stillWorks: r.check(log, { kind: "undo" }, "ann"),
      print: r.fingerprint(table).length,
    };
  });
  expect(seen.problems).toEqual([
    '"__proto__" is not a model, unit, group, player or the game.',
    '"toString" is not a model, unit, group, player or the game.',
    'There is no card "constructor".',
    'There is no model "hasOwnProperty".',
  ]);
  expect(seen.unit).toBe("Odd name");
  expect(seen.counter).toEqual({ polluted: 1 });
  expect(seen.polluted).toBe(false);
  expect(seen.stillWorks).toBeNull();
  expect(seen.print).toBe(16);
});

test("a roll of dice with more sides than 2^32 still comes up, quickly and fairly", async ({ page }) => {
  const sealed = await sealedWith("host", "guest");
  const huge = (r: RecordModule, s: typeof sealed) => {
    const log = r.append(opening(r), { kind: "roll", dice: 1000, sides: 2 ** 40, ...s }, "ann");
    return r.tableAt(log).rolls[0]!.result;
  };
  const seen = (await page.evaluate(
    `(() => { const opening = ${opening.toString()}, huge = ${huge.toString()}; return huge(window.record, ${JSON.stringify(sealed)}); })()`,
  )) as number[];
  expect(seen).toHaveLength(1000);
  expect(seen.every((d) => Number.isInteger(d) && d >= 1 && d <= 2 ** 40)).toBe(true);
  // Half the dice land in the top half, give or take four standard deviations.
  expect(Math.abs(seen.filter((d) => d > 2 ** 39).length - 500)).toBeLessThan(64);
  expect(huge(nodeRecord, sealed)).toEqual(seen);
});
