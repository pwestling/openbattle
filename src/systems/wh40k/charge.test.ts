import { describe, expect, it } from "vitest";
import "../index";
import {
  appendEvent,
  createInitialState,
  createRecord,
  resolveLogged,
  stateAt,
  type GameRecord,
  type Intent,
} from "../../core";
import { unitActions } from "../../core/content/play";
import { hookIntents } from "../../core/script";
import { currentSlot } from "../../core/content/turn";
import { spawnIntents } from "./deploy";
import { fightOrder } from "./fight";
import { rollerSeat } from "../../core";
import { wh40kModule } from "./module";

describe("40k charge", () => {
  it("is offered only with an enemy unit within 12 inches", () => {
    let r: GameRecord = createRecord(createInitialState());
    const host = (i: Intent, by: string) => {
      const l = resolveLogged(r, i, by, () => 0.5, 0);
      if (!l) throw new Error(`Rejected ${i.type}`);
      r = appendEvent(r, l);
    };
    host({ type: "player/join", player: { id: "a", name: "A", color: "#00f", seat: 0 } }, "a");
    host({ type: "player/join", player: { id: "b", name: "B", color: "#f00", seat: 1 } }, "b");
    host({ type: "game/system", system: wh40kModule.system.id }, "a");
    for (const [p, seat] of [
      ["a", 0],
      ["b", 1],
    ] as const)
      for (const i of spawnIntents(stateAt(r), p, wh40kModule.app!.sample(seat).units, p, "x")) host(i, p);
    while (currentSlot(stateAt(r))?.id !== "charge") host({ type: "turn/next" }, "a");
    const s = stateAt(r);
    const mine = Object.values(s.units).find((u) => u.owner === "a")!;
    const enemy = Object.values(s.units).find((u) => u.owner === "b")!;
    const charge = () => unitActions(stateAt(r), mine.id).find((o) => o.def.id === "charge")!;
    // Pull every enemy unit far away, then bring one within 8".
    for (const u of Object.values(s.units).filter((u) => u.owner === "b"))
      host(
        { type: "models/move", moves: u.modelIds.map((id, i) => ({ id, to: { x: -25 + i, y: -21 } })) },
        "b",
      );
    for (const id of mine.modelIds) host({ type: "models/move", moves: [{ id, to: { x: 20, y: 20 } }] }, "a");
    expect(charge().ok).toBe(false);
    expect(charge().why).toBe('No enemy within 12"');
    host(
      {
        type: "models/move",
        moves: enemy.modelIds.map((id, i) => ({
          id,
          to: { x: 20 - 1.5 * (i % 5), y: 12 - 1.5 * Math.floor(i / 5) },
        })),
      },
      "b",
    );
    expect(charge().ok).toBe(true);
  });
});

describe("40k Battle-shock test", () => {
  it("is offered only below half-strength, counting a lone model's wounds", () => {
    let r: GameRecord = createRecord(createInitialState());
    const host = (i: Intent, by: string) => {
      const l = resolveLogged(r, i, by, () => 0.5, 0);
      if (!l) throw new Error(`Rejected ${i.type}`);
      r = appendEvent(r, l);
    };
    host({ type: "player/join", player: { id: "a", name: "A", color: "#00f", seat: 0 } }, "a");
    host({ type: "player/join", player: { id: "b", name: "B", color: "#f00", seat: 1 } }, "b");
    host({ type: "game/system", system: wh40kModule.system.id }, "a");
    for (const i of spawnIntents(stateAt(r), "a", wh40kModule.app!.sample(0).units, "a", "x")) host(i, "a");
    host({ type: "turn/next" }, "a");
    const s = stateAt(r);
    const units = Object.values(s.units).filter((u) => u.owner === "a");
    const lone = units.find(
      (u) => u.modelIds.length === 1 && Number(s.models[u.modelIds[0]!]!.profile?.chars.W) > 1,
    )!;
    const squad = units.find((u) => u.modelIds.length >= 4)!;
    const shock = (id: string) => unitActions(stateAt(r), id).find((o) => o.def.id === "battleShockTest")!.ok;
    expect(lone && squad).toBeTruthy();
    expect(shock(lone.id)).toBe(false);
    expect(shock(squad.id)).toBe(false);
    const w = Number(s.models[lone.modelIds[0]!]!.profile!.chars.W);
    host(
      { type: "model/wounds", id: lone.modelIds[0]!, woundsLost: Math.ceil(w / 2) - 1, destroyed: false },
      "a",
    );
    expect(shock(lone.id)).toBe(false);
    host(
      {
        type: "model/wounds",
        id: lone.modelIds[0]!,
        woundsLost: w - Math.floor((w - 1) / 2),
        destroyed: false,
      },
      "a",
    );
    expect(shock(lone.id)).toBe(true);
    const half = Math.ceil(squad.modelIds.length / 2);
    for (const id of squad.modelIds.slice(0, squad.modelIds.length - half))
      host({ type: "model/wounds", id, woundsLost: 1, destroyed: true }, "a");
    expect(shock(squad.id)).toBe(false);
    host({ type: "model/wounds", id: squad.modelIds.at(-1)!, woundsLost: 1, destroyed: true }, "a");
    expect(shock(squad.id)).toBe(true);
  });
});

describe("40k shooting after an Advance", () => {
  it("is only with Assault weapons", () => {
    let r: GameRecord = createRecord(createInitialState());
    const host = (i: Intent, by: string) => {
      const l = resolveLogged(r, i, by, () => 0.5, 0);
      if (!l) throw new Error(`Rejected ${i.type}`);
      r = appendEvent(r, l);
    };
    host({ type: "player/join", player: { id: "a", name: "A", color: "#00f", seat: 0 } }, "a");
    host({ type: "player/join", player: { id: "b", name: "B", color: "#f00", seat: 1 } }, "b");
    host({ type: "game/system", system: wh40kModule.system.id }, "a");
    for (const [p, seat] of [
      ["a", 0],
      ["b", 1],
    ] as const)
      for (const i of spawnIntents(stateAt(r), p, wh40kModule.app!.sample(seat).units, p, "x")) host(i, p);
    while (currentSlot(stateAt(r))?.id !== "movement" || stateAt(r).turn.activeSeat !== 0)
      host({ type: "turn/next" }, "a");
    const mine = Object.values(stateAt(r).units).find(
      (u) => u.owner === "a" && Object.values(u.sheet?.weapons ?? {}).some((w) => w.kind === "ranged"),
    )!;
    host({ type: "action/take", unitId: mine.id, action: "advance" } as Intent, "a");
    host({ type: "turn/next" }, "a");
    const s = stateAt(r);
    const enemy = Object.values(s.units).find((u) => u.owner === "b")!;
    const [id, weapon] = Object.entries(mine.sheet!.weapons).find(([, w]) => w.kind === "ranged")!;
    const shoot = (state: typeof s) =>
      unitActions(state, mine.id, { weapon: id, targetId: enemy.id }).find((o) => o.def.id === "shoot")!;
    expect(shoot(s).why).toBe("Advanced: only Assault weapons");
    const assault = {
      ...s,
      units: {
        ...s.units,
        [mine.id]: {
          ...s.units[mine.id]!,
          sheet: {
            ...s.units[mine.id]!.sheet!,
            weapons: { ...s.units[mine.id]!.sheet!.weapons, [id]: { ...weapon, keywords: ["Assault"] } },
          },
        },
      },
    };
    expect(shoot(assault).why).not.toBe("Advanced: only Assault weapons");
  });

  it("a charge made by hand (roll, then drag into contact) charged: it fights first (UX N27)", () => {
    let r: GameRecord = createRecord(createInitialState());
    // As the host's session does: the turn hooks an event sets off run after it.
    const host = (i: Intent, by: string): void => {
      const before = stateAt(r);
      const l = resolveLogged(r, i, by, () => 0.5, 0);
      if (!l) throw new Error(`Rejected ${i.type}`);
      r = appendEvent(r, l);
      for (const h of hookIntents(before, stateAt(r), l.event)) host(h, by);
    };
    host({ type: "player/join", player: { id: "a", name: "A", color: "#00f", seat: 0 } }, "a");
    host({ type: "player/join", player: { id: "b", name: "B", color: "#f00", seat: 1 } }, "b");
    host({ type: "game/system", system: wh40kModule.system.id }, "a");
    for (const [p, seat] of [
      ["a", 0],
      ["b", 1],
    ] as const)
      for (const i of spawnIntents(stateAt(r), p, wh40kModule.app!.sample(seat).units, p, "x")) host(i, p);
    const s = stateAt(r);
    const mine = Object.values(s.units).find((u) => u.owner === "a" && u.modelIds.length > 3)!;
    const enemy = Object.values(s.units).find((u) => u.owner === "b" && u.modelIds.length > 3)!;
    // Everyone else far apart; the two units 5" apart.
    for (const u of Object.values(s.units).filter((u) => u.id !== mine.id && u.id !== enemy.id))
      host(
        {
          type: "models/move",
          moves: u.modelIds.map((id, i) => ({ id, to: { x: (u.owner === "a" ? -25 : 25) + i * 0.1, y: 0 } })),
        },
        u.owner,
      );
    host(
      { type: "models/move", moves: enemy.modelIds.map((id, i) => ({ id, to: { x: i * 1.6, y: 0 } })) },
      "b",
    );
    host(
      { type: "models/move", moves: mine.modelIds.map((id, i) => ({ id, to: { x: i * 1.6, y: -6 } })) },
      "a",
    );
    // Set up before the Charge phase, so these moves aren't counted in the charge move.
    while (currentSlot(stateAt(r))?.id !== "charge") host({ type: "turn/next" }, "a");
    // The bare roll the charge card makes, then the models dragged into contact.
    host(
      { type: "dice/roll", count: 2, sides: 6, label: "charge", unitId: mine.id, targets: [enemy.id] },
      "a",
    );
    expect(stateAt(r).units[mine.id]!.status?.charged).toBeFalsy();
    host(
      { type: "models/move", moves: mine.modelIds.map((id, i) => ({ id, to: { x: i * 1.6, y: -1.7 } })) },
      "a",
    );
    expect(stateAt(r).units[mine.id]!.status?.charged).toBe(true);
    host({ type: "turn/next" }, "a");
    const order = fightOrder(stateAt(r));
    expect(order?.step).toBe("fightsFirst");
    expect(order?.eligible).toEqual([mine.id]);
  });
  it("the other side's fight in my turn is rolled by its own side (UX N40)", () => {
    let r: GameRecord = createRecord(createInitialState());
    // As the host's session does: the turn hooks an event sets off run after it.
    const host = (i: Intent, by: string): void => {
      const before = stateAt(r);
      const l = resolveLogged(r, i, by, () => 0.5, 0);
      if (!l) throw new Error(`Rejected ${i.type}`);
      r = appendEvent(r, l);
      for (const h of hookIntents(before, stateAt(r), l.event)) host(h, by);
    };
    host({ type: "player/join", player: { id: "a", name: "A", color: "#00f", seat: 0 } }, "a");
    host({ type: "player/join", player: { id: "b", name: "B", color: "#f00", seat: 1 } }, "b");
    host({ type: "game/system", system: wh40kModule.system.id }, "a");
    for (const [p, seat] of [
      ["a", 0],
      ["b", 1],
    ] as const)
      for (const i of spawnIntents(stateAt(r), p, wh40kModule.app!.sample(seat).units, p, "x")) host(i, p);
    const s = stateAt(r);
    const mine = Object.values(s.units).find((u) => u.owner === "a" && u.modelIds.length > 3)!;
    const enemy = Object.values(s.units).find((u) => u.owner === "b" && u.modelIds.length > 3)!;
    // Everyone else far apart; the two units 5" apart.
    for (const u of Object.values(s.units).filter((u) => u.id !== mine.id && u.id !== enemy.id))
      host(
        {
          type: "models/move",
          moves: u.modelIds.map((id, i) => ({ id, to: { x: (u.owner === "a" ? -25 : 25) + i * 0.1, y: 0 } })),
        },
        u.owner,
      );
    host(
      { type: "models/move", moves: enemy.modelIds.map((id, i) => ({ id, to: { x: i * 1.6, y: 0 } })) },
      "b",
    );
    host(
      { type: "models/move", moves: mine.modelIds.map((id, i) => ({ id, to: { x: i * 1.6, y: -6 } })) },
      "a",
    );
    // Set up before the Charge phase, so these moves aren't counted in the charge move.
    while (currentSlot(stateAt(r))?.id !== "charge") host({ type: "turn/next" }, "a");
    // The bare roll the charge card makes, then the models dragged into contact.
    host(
      { type: "dice/roll", count: 2, sides: 6, label: "charge", unitId: mine.id, targets: [enemy.id] },
      "a",
    );
    expect(stateAt(r).units[mine.id]!.status?.charged).toBeFalsy();
    host(
      { type: "models/move", moves: mine.modelIds.map((id, i) => ({ id, to: { x: i * 1.6, y: -1.7 } })) },
      "a",
    );
    expect(stateAt(r).units[mine.id]!.status?.charged).toBe(true);
    host({ type: "turn/next" }, "a");
    // My charger fought; now the other side fights back in my turn.
    host({ type: "unit/status", id: mine.id, key: "fought", value: true }, "a");
    const weapon = Object.entries(enemy.sheet!.weapons).find(([, w]) => w.kind === "melee")![0];
    host({ type: "action/take", unitId: enemy.id, action: "fight", weapon, targetId: mine.id }, "b");
    const st = stateAt(r);
    expect(st.procedure ?? st.attack).toBeTruthy();
    // The turn is mine, but its hits are theirs to roll: the computer must not wait on me for them.
    expect(st.turn.activeSeat).toBe(0);
    expect(rollerSeat(st)).toBe(1);
  });

  it("a charge dragged further than its roll still charged once in contact (UX N34)", () => {
    let r: GameRecord = createRecord(createInitialState());
    // As the host's session does: the turn hooks an event sets off run after it.
    const host = (i: Intent, by: string): void => {
      const before = stateAt(r);
      const l = resolveLogged(r, i, by, () => 0, 0);
      if (!l) throw new Error(`Rejected ${i.type}`);
      r = appendEvent(r, l);
      for (const h of hookIntents(before, stateAt(r), l.event)) host(h, by);
    };
    host({ type: "player/join", player: { id: "a", name: "A", color: "#00f", seat: 0 } }, "a");
    host({ type: "player/join", player: { id: "b", name: "B", color: "#f00", seat: 1 } }, "b");
    host({ type: "game/system", system: wh40kModule.system.id }, "a");
    for (const [p, seat] of [
      ["a", 0],
      ["b", 1],
    ] as const)
      for (const i of spawnIntents(stateAt(r), p, wh40kModule.app!.sample(seat).units, p, "x")) host(i, p);
    const s = stateAt(r);
    const mine = Object.values(s.units).find((u) => u.owner === "a" && u.modelIds.length > 3)!;
    const enemy = Object.values(s.units).find((u) => u.owner === "b" && u.modelIds.length > 3)!;
    // Everyone else far apart; the two units 5" apart.
    for (const u of Object.values(s.units).filter((u) => u.id !== mine.id && u.id !== enemy.id))
      host(
        {
          type: "models/move",
          moves: u.modelIds.map((id, i) => ({ id, to: { x: (u.owner === "a" ? -25 : 25) + i * 0.1, y: 0 } })),
        },
        u.owner,
      );
    host(
      { type: "models/move", moves: enemy.modelIds.map((id, i) => ({ id, to: { x: i * 1.6, y: 0 } })) },
      "b",
    );
    host(
      { type: "models/move", moves: mine.modelIds.map((id, i) => ({ id, to: { x: i * 1.6, y: -6 } })) },
      "a",
    );
    // Set up before the Charge phase, so these moves aren't counted in the charge move.
    while (currentSlot(stateAt(r))?.id !== "charge") host({ type: "turn/next" }, "a");
    // The bare roll the charge card makes, then the models dragged into contact.
    host(
      { type: "dice/roll", count: 2, sides: 6, label: "charge", unitId: mine.id, targets: [enemy.id] },
      "a",
    );
    // A roll short of the 4.3" drag below.
    expect(stateAt(r).units[mine.id]!.status?.charge).toBeLessThan(4);
    expect(stateAt(r).units[mine.id]!.status?.charged).toBeFalsy();
    host(
      { type: "models/move", moves: mine.modelIds.map((id, i) => ({ id, to: { x: i * 1.6, y: -1.7 } })) },
      "a",
    );
    expect(stateAt(r).units[mine.id]!.status?.charged).toBe(true);
    host({ type: "turn/next" }, "a");
    const order = fightOrder(stateAt(r));
    expect(order?.step).toBe("fightsFirst");
    expect(order?.eligible).toEqual([mine.id]);
  });
});
