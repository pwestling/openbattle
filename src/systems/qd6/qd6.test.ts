import { describe, expect, it } from "vitest";
import { applyEvent, currentSlot, type GameState } from "../../core";
import { validateSystem } from "../../core/content/validate";
import { actionTargets, procedureEnv, procedureRoles, unitActions } from "../../core/content/play";
import { previewRun, type TestPlan } from "../../core/content/runner";
import { unitView } from "../../core/content/runtime";
import { terrainOnMove } from "../../core/content/moves";
import type { TerrainCategory } from "../../core";
import { makePiece } from "../wh40k/layout";
import { gameView } from "../../core/script";
import { tableWarnings } from "../../ui/warnings";
import { qd6Bot } from "./bot";
import { holdFast } from "./mission";
import { importQd6List } from "./roster";
import { qd6 } from "./system";
import { fightLine, lastFight } from "./ui/RoundPanel";
import { qd6Orders } from "./ui/Qd6Card";
import {
  alive,
  dice,
  lastNotes,
  place,
  play,
  record,
  rng,
  setup,
  start,
  unitNamed,
  withChars,
  withRules,
  withWeaponRules,
} from "./testing";

/**
 * Quality d6 (#82): one test per automated rule. See
 * docs/rules-coverage/qd6.md for the matrix.
 */

const status = (s: GameState, unitId: string, key: string, value: boolean) =>
  applyEvent(s, { type: "unit/status", id: unitId, key, value });

/** The attack's planned steps, without rolling. */
function preview(s: GameState, attacker: string, weapon: string, target: string) {
  const roles = procedureRoles(qd6, "attack", attacker, { weapon, targetId: target });
  return previewRun(procedureEnv(s), "attack", roles);
}
const plan = (s: GameState, a: string, w: string, t: string, step: string) =>
  preview(s, a, w, t).plans[step] as TestPlan;

/** Everything parked far apart, then two units placed by hand; seat 0 to act. */
function table(a: string, b: string, ay: number, by: number) {
  let s = setup();
  let x = -30;
  for (const u of Object.values(s.units)) {
    s = place(s, u.id, x, u.owner === "p1" ? 22 : -22);
    x += 7;
  }
  const first = unitNamed(s, a).id;
  const second = unitNamed(s, b).id;
  s = place(s, first, -6, ay);
  s = place(s, second, -6, by);
  return { s: start(s), first, second };
}

/** The riflemen 16" from the thornlings. */
function duel() {
  const { s, first, second } = table("Line Riflemen", "Thornlings", 8, -8);
  return { s, riflemen: first, thorns: second };
}

const six = () => 5.5 / 6;

/** Give an order, shoot with a weapon rolling these dice: the finished run, and the state once cleared. */
function shoot(s: GameState, unit: string, weapon: string, target: string, r: () => number, order = "hold") {
  s = play(s, { type: "action/take", unitId: unit, action: order }, "p1");
  s = play(s, { type: "action/take", unitId: unit, action: "shoot", weapon, targetId: target }, "p1", r);
  for (let i = 0; i < 20 && s.procedure && !s.procedure.run.done; i++)
    s = play(s, { type: "procedure/roll" }, "p1", r);
  const run = s.procedure!.run;
  return { run, after: play(s, { type: "procedure/clear" }, "p1", r) };
}

const ten = (v: number) => Array.from({ length: 10 }, () => v);

describe("Quality d6: the game data", () => {
  it("has no broken references", () => {
    expect(validateSystem(qd6)).toEqual([]);
  });
});

describe("Quality d6: orders and the round", () => {
  it("offers the four orders to the side whose go it is, one unit at a time", () => {
    let s = start(setup());
    expect(currentSlot(s)?.kind).toBe("alternate");
    const riflemen = unitNamed(s, "Line Riflemen");
    const ok = unitActions(s, riflemen.id)
      .filter((o) => o.ok)
      .map((o) => o.def.id);
    expect(ok).toEqual(expect.arrayContaining(["hold", "advance", "rush"]));
    const thorns = unitNamed(s, "Thornlings");
    expect(unitActions(s, thorns.id).find((o) => o.def.id === "hold")?.why).toBe("Not your turn");
    // The unit card's order picker (ui/Qd6Card.tsx): no Rally while steady; Shaken, Rally is the one to take.
    expect(qd6Orders(s, riflemen).map((o) => o.def.id)).toEqual(["hold", "advance", "rush", "charge"]);
    const shaken = status(s, riflemen.id, "shaken", true);
    expect(
      qd6Orders(shaken, shaken.units[riflemen.id]!)
        .filter((o) => o.ok)
        .map((o) => o.def.id),
    ).toEqual(["rally"]);
    s = play(s, { type: "action/take", unitId: riflemen.id, action: "advance" }, "p1");
    expect(s.units[riflemen.id]?.status?.allowance).toBe(6);
    expect(s.units[riflemen.id]?.status?.advancing).toBe(true);
    // One order a round.
    expect(unitActions(s, riflemen.id).find((o) => o.def.id === "hold")?.ok).toBe(false);
  });

  it("Rush and Charge go twice the Move; only Hold and Advance shoot", () => {
    const { s, riflemen, thorns } = duel();
    const rushed = play(s, { type: "action/take", unitId: riflemen, action: "rush" }, "p1");
    expect(rushed.units[riflemen]?.status?.allowance).toBe(12);
    const can = (t: GameState) =>
      unitActions(t, riflemen, { weapon: "long-rifle", targetId: thorns }).find((o) => o.def.id === "shoot")
        ?.ok;
    expect(can(rushed)).toBe(false);
    expect(can(play(s, { type: "action/take", unitId: riflemen, action: "hold" }, "p1"))).toBe(true);
    // 16" away: out of a 12" charge.
    expect(unitActions(s, riflemen).find((o) => o.def.id === "charge")?.why).toBe("No enemy in reach");
  });

  it("a weapon shoots only in range", () => {
    const { s: near, riflemen, thorns } = duel();
    let s = place(near, thorns, -6, -20);
    s = play(s, { type: "action/take", unitId: riflemen, action: "hold" }, "p1");
    expect(actionTargets(s, riflemen, "shoot", "long-rifle").find((t) => t.unitId === thorns)?.why).toBe(
      "Out of range",
    );
  });

  it("the round ends once every unit has gone; the go passes only to a side with units left", () => {
    let s = start(setup());
    const left = (seat: number) =>
      Object.values(s.units).filter((u) => s.players[u.owner]?.seat === seat && !u.status?.activated);
    // Five units against four: after four each, seat 0 goes again.
    for (let i = 0; i < 9; i++) {
      const seat = s.turn.activeSeat;
      const by = seat === 0 ? "p1" : "p2";
      s = play(s, { type: "action/take", unitId: left(seat)[0]!.id, action: "hold" }, by);
      s = play(s, { type: "turn/endActivation" }, by);
      if (i === 7) expect(s.turn.activeSeat).toBe(0);
    }
    expect(s.turn.round).toBe(2);
    expect(Object.values(s.units).some((u) => u.status?.activated)).toBe(false);
  });

  it("the side that ran out of units first goes first next round", () => {
    let s = start(setup());
    expect(s.turn.firstSeat).toBe(0);
    const left = (seat: number) =>
      Object.values(s.units).filter((u) => s.players[u.owner]?.seat === seat && !u.status?.activated);
    for (let i = 0; i < 9; i++) {
      const seat = s.turn.activeSeat;
      const by = seat === 0 ? "p1" : "p2";
      s = play(s, { type: "action/take", unitId: left(seat)[0]!.id, action: "hold" }, by);
      s = play(s, { type: "turn/endActivation" }, by);
    }
    expect(s.turn.round).toBe(2);
    expect(s.turn.firstSeat).toBe(1);
    expect(s.turn.activeSeat).toBe(1);
  });
});

describe("Quality d6: checks", () => {
  it("warns, without stopping anything, when models stray from their unit or move too far", () => {
    const { s, riflemen } = duel();
    const t = play(s, { type: "action/take", unitId: riflemen, action: "advance" }, "p1");
    const moved = (gap: number, dy: number) => {
      let n = t;
      n.units[riflemen]!.modelIds.forEach((id, i) => {
        n = applyEvent(n, { type: "model/move", id, to: { x: -6 + i * gap, y: 8 - dy } });
      });
      return tableWarnings(n)
        .filter((w) => w.unitId === riflemen)
        .map((w) => w.checkId);
    };
    expect(moved(1.2, 5)).toEqual([]);
    expect(moved(3, 5)).toContain("coherency");
    expect(moved(1.2, 9)).toContain("moveDistance");
  });
});

describe("Quality d6: shooting", () => {
  it("hits on Quality, saves on Defense; a natural 6 always passes, a 1 always fails", () => {
    const { s, riflemen, thorns } = duel();
    const hit = plan(s, riflemen, "long-rifle", thorns, "hit");
    expect(hit).toMatchObject({ target: 4, alwaysPass: [6], alwaysFail: [1] });
    const save = plan(s, riflemen, "long-rifle", thorns, "defense");
    expect(save).toMatchObject({ target: 6, alwaysPass: [6], alwaysFail: [1] });
    const { run, after } = shoot(s, riflemen, "long-rifle", thorns, dice(...ten(6), 1));
    expect(record(run, "hit").successes).toBe(10);
    expect(alive(after, thorns)).toBe(0);
  });

  it("AP(X) takes X off the Defense roll", () => {
    const { s, riflemen, thorns } = duel();
    expect(plan(s, riflemen, "long-rifle", thorns, "defense").modifier).toBe(0);
    const ap = withWeaponRules(s, riflemen, "long-rifle", ["AP(2)"]);
    expect(plan(ap, riflemen, "long-rifle", thorns, "defense").modifier).toBe(-2);
  });

  it("Reliable and Sniper hit on 2+ whatever the Quality", () => {
    const { s, riflemen, thorns } = duel();
    for (const r of ["Reliable", "Sniper"]) {
      const t = withWeaponRules(s, riflemen, "long-rifle", [r]);
      expect(plan(t, riflemen, "long-rifle", thorns, "hit").target).toBe(2);
    }
  });

  it("Sniper: the shooter picks the model hit, before the damage", () => {
    const { s, riflemen, thorns } = duel();
    const aim = (t: GameState) => {
      t = play(t, { type: "action/take", unitId: riflemen, action: "hold" }, "p1");
      return play(
        t,
        { type: "action/take", unitId: riflemen, action: "shoot", weapon: "long-rifle", targetId: thorns },
        "p1",
      );
    };
    const last = s.units[thorns]!.modelIds.at(-1)!;
    const pick = { type: "procedure/allocate" as const, order: [last] };
    // Not a sniper: only the defender orders the wounds.
    const plain = aim(s);
    expect(() => play(plain, pick, "p1")).toThrow(/Rejected/);
    expect(play(plain, pick, "p2").procedure?.run.overrides?.allocate?.order).toEqual([last]);
    // A sniper: the shooter picks, the defender can't, and every hit goes to that model first.
    const sniped = aim(withWeaponRules(s, riflemen, "long-rifle", ["Sniper"]));
    expect(() => play(sniped, pick, "p2")).toThrow(/Rejected/);
    let t = play(sniped, pick, "p1");
    for (let i = 0; i < 20 && t.procedure && !t.procedure.run.done; i++)
      // One hit (a 6 and nine 1s), then its Defense roll fails.
      t = play(t, { type: "procedure/roll" }, "p1", i === 0 ? dice(6, ...Array(9).fill(1)) : dice(1));
    expect(t.models[last]?.destroyed).toBe(true);
    expect(alive(t, thorns)).toBe(s.units[thorns]!.modelIds.length - 1);
  });

  it("Stealth is -1 to be hit by shooting, not by Lock-On", () => {
    const { s, riflemen, thorns } = duel();
    const sneaky = withRules(s, thorns, ["Stealth"]);
    expect(plan(sneaky, riflemen, "long-rifle", thorns, "hit").modifier).toBe(-1);
    const locked = withWeaponRules(sneaky, riflemen, "long-rifle", ["Lock-On"]);
    expect(plan(locked, riflemen, "long-rifle", thorns, "hit").modifier).toBe(0);
  });

  it("cover: +1 to Defense when most of the target is in cover terrain, not against Lock-On", () => {
    const { s, riflemen, thorns } = duel();
    const wood = makePiece("Woods", "w", { x: 0, y: -8 }, 0, "cover" as TerrainCategory);
    const covered = { ...s, terrain: [{ ...wood, width: 30, depth: 4 }] };
    expect(plan(covered, riflemen, "long-rifle", thorns, "defense").modifier).toBe(1);
    const locked = withWeaponRules(covered, riflemen, "long-rifle", ["Lock-On"]);
    expect(plan(locked, riflemen, "long-rifle", thorns, "defense").modifier).toBe(0);
  });

  it("Indirect: -1 to hit after moving, and may shoot what it can't see", () => {
    const { s: open, riflemen, thorns } = duel();
    const wall = makePiece("Container", "c", { x: 0, y: 0 }, 0, "blocking" as TerrainCategory);
    const solids = [{ kind: "block" as const, x: 0, y: 0, z: 0, w: 40, d: 2, h: 10 }];
    const walled = { ...open, terrain: [{ ...wall, width: 40, depth: 2, solids }] };
    const sees = (t: GameState) =>
      !!actionTargets(t, riflemen, "shoot", "long-rifle").find((x) => x.unitId === thorns)?.ok;
    const held = play(walled, { type: "action/take", unitId: riflemen, action: "hold" }, "p1");
    expect(sees(held)).toBe(false);
    const lobbing = withWeaponRules(walled, riflemen, "long-rifle", ["Indirect"]);
    const advanced = play(lobbing, { type: "action/take", unitId: riflemen, action: "advance" }, "p1");
    expect(sees(advanced)).toBe(true);
    expect(plan(advanced, riflemen, "long-rifle", thorns, "hit").modifier).toBe(-1);
    const still = play(lobbing, { type: "action/take", unitId: riflemen, action: "hold" }, "p1");
    expect(plan(still, riflemen, "long-rifle", thorns, "hit").modifier).toBe(0);
  });

  it("Blast(X): each hit becomes X hits, no more than the target has models", () => {
    const { s, riflemen, thorns } = duel();
    const blast = withWeaponRules(s, riflemen, "long-rifle", ["Blast(3)"]);
    expect(record(shoot(blast, riflemen, "long-rifle", thorns, six).run, "defense").in).toBe(30);
    const big = withWeaponRules(s, riflemen, "long-rifle", ["Blast(20)"]);
    expect(record(shoot(big, riflemen, "long-rifle", thorns, six).run, "defense").in).toBe(100);
  });

  it("Deadly(X): each unsaved hit does X wounds to one model", () => {
    const { s, riflemen, thorns } = duel();
    const deadly = withWeaponRules(s, riflemen, "long-rifle", ["Deadly(3)"]);
    const wounds = (t: GameState) =>
      preview(t, riflemen, "long-rifle", thorns).plans.wounds as { amount: string };
    expect(wounds(s).amount).toBe("1");
    expect(wounds(deadly).amount).toBe("3");
  });

  it("Rending: a natural 6 to hit makes the Defense roll 4 harder", () => {
    const { s, riflemen, thorns } = duel();
    const sturdy = withChars(s, thorns, { D: "2+" });
    // Ten 6s to hit, then 5s to save: a 2+ save holds them all...
    const plain = shoot(sturdy, riflemen, "long-rifle", thorns, dice(...ten(6), 5)).run;
    expect(record(plain, "defense").out).toBe(0);
    // ...but Rending makes it 6+.
    const rending = withWeaponRules(sturdy, riflemen, "long-rifle", ["Rending"]);
    const run = shoot(rending, riflemen, "long-rifle", thorns, dice(...ten(6), 5)).run;
    expect(record(run, "defense").out).toBe(10);
    // A hit from a 5 isn't rending.
    const fives = shoot(rending, riflemen, "long-rifle", thorns, dice(5)).run;
    expect(record(fives, "defense").out).toBe(0);
  });

  it('Relentless: having held, natural 6s to hit at over 9" score an extra hit', () => {
    const { s, riflemen, thorns } = duel();
    const relentless = withRules(s, riflemen, ["Relentless"]);
    expect(record(shoot(relentless, riflemen, "long-rifle", thorns, six).run, "defense").in).toBe(20);
    const moved = shoot(relentless, riflemen, "long-rifle", thorns, six, "advance").run;
    expect(record(moved, "defense").in).toBe(10);
  });

  it("Regeneration ignores each wound on a 5+", () => {
    const { s, riflemen, thorns } = duel();
    const ignore = (t: GameState) =>
      (preview(t, riflemen, "long-rifle", thorns).plans.wounds as { ignoreDamage: number | null })
        .ignoreDamage;
    expect(ignore(s)).toBeNull();
    expect(ignore(withRules(s, thorns, ["Regeneration"]))).toBe(5);
  });
});

describe("Quality d6: units", () => {
  it('Fast and Slow move 2" more or less', () => {
    const { s, riflemen } = duel();
    const m = (t: GameState) => unitView(t, qd6, t.units[riflemen]!).M;
    expect(m(s)).toBe(6);
    expect(m(withRules(s, riflemen, ["Fast"]))).toBe(8);
    expect(m(withRules(s, riflemen, ["Slow"]))).toBe(4);
    const fast = withRules(s, riflemen, ["Fast"]);
    const rushed = play(fast, { type: "action/take", unitId: riflemen, action: "rush" }, "p1");
    expect(rushed.units[riflemen]?.status?.allowance).toBe(16);
  });

  it("Tough(X) from a list becomes each model's Wounds", async () => {
    const list = "Hill Ogre [1] Q4+ D3+ | 60pts | Tough(6)\nClub (A3)\n";
    const army = await importQd6List("list.txt", new TextEncoder().encode(list));
    expect(army.units[0]!.models[0]!.profile!.chars.W).toBe("6");
  });

  it("Flying moves over blocking terrain", () => {
    const { s: open, riflemen } = duel();
    const rock = makePiece("Container", "rock", { x: 0, y: 3 }, 0, "blocking" as TerrainCategory);
    const s = { ...open, terrain: [{ ...rock, width: 40, depth: 2 }] };
    const over = (t: GameState) => {
      let n = t;
      for (const id of n.units[riflemen]!.modelIds) {
        const at = n.models[id]!.position;
        n = applyEvent(n, { type: "model/move", id, to: { x: at.x, y: at.y - 8 } });
      }
      return terrainOnMove(n, qd6, n.units[riflemen]!).blocked.map((p) => p.id);
    };
    expect(over(s)).toEqual(["rock"]);
    expect(over(withRules(s, riflemen, ["Flying"]))).toEqual([]);
  });
});

describe("Quality d6: morale", () => {
  // Ten 6s to hit, ten 1s to save: five two-wound thornlings go.
  const halve = [...ten(6), ...ten(1)];

  it("a unit shot to half strength tests on its Quality, and is Shaken if it fails", () => {
    const { s, riflemen, thorns } = duel();
    const sturdy = withChars(s, thorns, { W: "2" });
    const { after } = shoot(sturdy, riflemen, "long-rifle", thorns, dice(...halve, 1));
    expect(alive(after, thorns)).toBe(5);
    expect(after.units[thorns]?.status?.shaken).toBe(true);
    // A Shaken unit can only Rally, which clears it.
    let t = play(after, { type: "turn/endActivation" }, "p1");
    expect(unitActions(t, thorns).find((o) => o.def.id === "hold")?.why).toBe("Shaken: Rally first");
    t = play(t, { type: "action/take", unitId: thorns, action: "rally" }, "p2");
    expect(t.units[thorns]?.status?.shaken).toBeFalsy();
  });

  it("a pass keeps the unit steady; Fearless passes a failed test on a further 4+", () => {
    const { s, riflemen, thorns } = duel();
    const sturdy = withChars(s, thorns, { W: "2" });
    const shaken = (t: GameState, ...after: number[]) =>
      !!shoot(t, riflemen, "long-rifle", thorns, dice(...halve, ...after)).after.units[thorns]?.status
        ?.shaken;
    expect(shaken(sturdy, 4)).toBe(false);
    const fearless = withRules(sturdy, thorns, ["Fearless"]);
    expect(shaken(fearless, 2, 4)).toBe(false);
    expect(shaken(fearless, 2, 3)).toBe(true);
  });

  it("Shaken units hold no objectives", () => {
    const { s, riflemen } = duel();
    const pos = s.models[s.units[riflemen]!.modelIds[0]!]!.position;
    const t = { ...s, objectives: [{ id: "o", position: pos, label: "o" }] } as GameState;
    const score = (g: GameState) => holdFast().scoring[0]!.suggest!(g, 0)!.vp;
    expect(score(t)).toBe(1);
    expect(score(status(t, riflemen, "shaken", true))).toBe(0);
  });
});

describe("Quality d6: melee", () => {
  /** The breachers (Furious, five models, one hatchet each) charged into the thornlings (ten). */
  function contact() {
    const { s: open, first, second } = table("Breacher Squad", "Thornlings", 4, -4);
    let s = play(open, { type: "action/take", unitId: first, action: "charge", targetId: second }, "p1");
    s = place(s, first, -6, -2.9);
    return { s, breachers: first, thorns: second };
  }
  const fight = (s: GameState, unit: string, target: string, r: () => number) =>
    play(s, { type: "script/start", procedure: "fight", args: { unit, target } }, "p1", r);

  it("only a unit that charged into contact fights", () => {
    const { s, breachers } = contact();
    expect(s.units[breachers]?.status?.charging).toBe(true);
    const { s: far, riflemen, thorns } = duel();
    const held = play(far, { type: "action/take", unitId: riflemen, action: "hold" }, "p1");
    expect(() => fight(held, riflemen, thorns, rng(1))).toThrow(/Rejected/);
  });

  it("the defender strikes back, both end Fatigued, and a tie tests no one", () => {
    const { s, breachers, thorns } = contact();
    // Every die a 6: every hit lands and every save holds, both ways.
    const after = fight(s, breachers, thorns, six);
    expect(after.units[breachers]?.status).toMatchObject({ fought: true, fatigued: true });
    expect(after.units[thorns]?.status?.fatigued).toBe(true);
    expect(lastNotes()).toContain("Breacher Squad caused 0 wounds, Thornlings 0");
    expect(after.units[thorns]?.status?.shaken).toBeFalsy();
    // The round panel's summary (ui/RoundPanel.tsx).
    expect(lastFight(after)).toMatchObject({
      unit: breachers,
      foe: thorns,
      dealt: 0,
      taken: 0,
      morale: "tie",
    });
  });

  it("strike-back and fatigue are the game's constants: 0 turns either off", () => {
    const { s, breachers, thorns } = contact();
    const constants = qd6.constants as Record<string, number>;
    const was = { ...constants };
    try {
      constants.strikeBack = 0;
      constants.fatigue = 0;
      const after = fight(s, breachers, thorns, six);
      expect(after.units[breachers]?.status?.fatigued).toBeFalsy();
      expect(after.units[thorns]?.status?.fatigued).toBeFalsy();
      expect(plan(status(s, breachers, "fatigued", true), breachers, "hatchet", thorns, "hit").target).toBe(
        4,
      );
    } finally {
      Object.assign(constants, was);
    }
  });

  it("Furious: charging, each natural 6 to hit in melee scores one more hit", () => {
    const { s, breachers, thorns } = contact();
    // Five 6s to hit (ten hits), then ten 1s to save: every thornling falls.
    fight(s, breachers, thorns, dice(6, 6, 6, 6, 6, ...ten(1)));
    expect(lastNotes()).toContain("Breacher Squad caused 10 wounds, Thornlings 0");
    fight(withRules(s, breachers, []), breachers, thorns, dice(6, 6, 6, 6, 6, 1, 1, 1, 1, 1, 6));
    expect(lastNotes()).toContain("Breacher Squad caused 5 wounds, Thornlings 0");
  });

  it("the side that caused fewer wounds tests morale; at half strength a failure routs", () => {
    const { s, breachers, thorns } = contact();
    const calm = withRules(s, breachers, []);
    // Five hits, five failed saves; the five left strike back and miss (1s); their test: 1, failed.
    const after = fight(calm, breachers, thorns, dice(6, 6, 6, 6, 6, 1));
    expect(lastNotes()).toContain("Thornlings routs");
    expect(alive(after, thorns)).toBe(0);
    expect(lastFight(after)).toMatchObject({ dealt: 5, taken: 0, loser: thorns, morale: "routed" });
    expect(fightLine(lastFight(after)!)).toBe("Thornlings lost and routed.");
    // Not yet at half (two wounds each): Shaken instead.
    const sturdy = withChars(calm, thorns, { W: "2" });
    const shaken = fight(sturdy, breachers, thorns, dice(6, 6, 6, 6, 6, 1));
    // Five wounds on two-wound models: the wounded one takes the next, so two fall and one is hurt.
    expect(alive(shaken, thorns)).toBe(8);
    expect(shaken.units[thorns]?.status?.shaken).toBe(true);
    expect(lastFight(shaken)?.morale).toBe("shaken");
  });

  it("a unit in melee can't shoot", () => {
    const { s, breachers, thorns } = contact();
    const held = status(s, breachers, "holding", true);
    const option = (t: GameState) =>
      unitActions(t, breachers, { weapon: "scattergun", targetId: thorns }).find((o) => o.def.id === "shoot");
    expect(option(held)?.why).toBe("In melee");
    expect(option(place(held, thorns, -6, -12))?.ok).toBe(true);
  });

  it("fatigued or Shaken, a unit hits only on unmodified 6s in melee", () => {
    const { s, breachers, thorns } = contact();
    expect(plan(s, breachers, "hatchet", thorns, "hit").target).toBe(4);
    expect(plan(status(s, breachers, "fatigued", true), breachers, "hatchet", thorns, "hit").target).toBe(99);
    expect(plan(status(s, breachers, "shaken", true), breachers, "hatchet", thorns, "hit").target).toBe(99);
    // Shooting isn't affected.
    expect(plan(status(s, breachers, "fatigued", true), breachers, "scattergun", thorns, "hit").target).toBe(
      4,
    );
  });

  it("Impact(X): X hits on 2+ for each model as the charge lands", () => {
    const { s, breachers, thorns } = contact();
    const ramming = withRules(s, breachers, ["Impact(2)"]);
    expect(unitView(ramming, qd6, ramming.units[breachers]!).Impact).toBe(2);
    // Ten impact hits on 2s, ten failed saves: every thornling falls before a hatchet swings.
    fight(ramming, breachers, thorns, dice(...ten(2), ...ten(1)));
    expect(lastNotes()).toContain("Breacher Squad caused 10 wounds, Thornlings 0");
  });
});

describe("Quality d6: the computer player", () => {
  it("counts a Shaken unit as worth less, and moves as its Move says", () => {
    const { s, riflemen } = duel();
    expect(qd6Bot.evaluate!(s, 0, gameView(s, "qd6-1"))).toBe(0);
    expect(qd6Bot.evaluate!(status(s, riflemen, "shaken", true), 0, gameView(s, "qd6-1"))).toBeLessThan(0);
    const fast = withRules(s, riflemen, ["Fast"]);
    expect(qd6Bot.moveInches!(fast, fast.units[riflemen]!)).toBe(8);
  });
});
