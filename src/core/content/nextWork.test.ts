import { afterEach, describe, expect, it } from "vitest";
import "../../systems";
import { createInitialState, type GameState, type Intent, type PlayerId } from "../index";
import { appendEvent, createRecord, lastSeq, resolveLogged, stateAt, type GameRecord } from "../log";
import { registerSystem, unregisterSystem } from "./systems";
import { currentSlot } from "./turn";
import { nextWork } from "./nextWork";
import { fortyK } from "./examples/forty-k";
import type { GameSystem } from "./schema";
import { spawnIntents } from "../../systems/wh40k/deploy";
import { sampleRoster } from "../../systems/wh40k/sample";
import { wh40kModule } from "../../systems/wh40k/module";

/** A tiny table kept as a log, like the host's. */
class Table {
  record: GameRecord = createRecord(createInitialState());
  private n = 1;
  get state(): GameState {
    return stateAt(this.record);
  }
  send(intent: Intent, by: PlayerId): boolean {
    const r = () => ((this.n = (this.n * 16807) % 2147483647) - 1) / 2147483646;
    const logged = resolveLogged(this.record, intent, by, r, lastSeq(this.record) + 1);
    if (!logged) return false;
    this.record = appendEvent(this.record, logged);
    return true;
  }
  must(intent: Intent, by: PlayerId) {
    if (!this.send(intent, by)) throw new Error(`refused: ${JSON.stringify(intent)} from ${by}`);
  }
}

/** Two players with a sample army each (the invented 40k samples), the battle started. */
function battle(system: string): Table {
  const t = new Table();
  t.must({ type: "player/join", player: { id: "a", name: "A", color: "#888", seat: 0 } }, "a");
  t.must({ type: "player/join", player: { id: "b", name: "B", color: "#888", seat: 1 } }, "b");
  t.must({ type: "game/system", system }, "a");
  for (const [p, seat] of [
    ["a", 0],
    ["b", 1],
  ] as const)
    for (const i of spawnIntents(t.state, p, sampleRoster(seat).units.slice(0, 3), `${p}-`)) t.must(i, p);
  t.must({ type: "turn/next" }, "a");
  return t;
}

const phase = (s: GameState) => currentSlot(s)?.id;
const unitsOf = (s: GameState, p: PlayerId) =>
  Object.values(s.units)
    .filter((u) => u.owner === p)
    .map((u) => u.id);

afterEach(() => unregisterSystem("alternate-test"));

describe("nextWork (#84)", () => {
  it("40k: a unit with no enemy in reach has no shooting to do, and a failed charge roll is a charge done", () => {
    const t = battle("forty-k-11");
    for (const p of ["a", "b"]) t.must({ type: "turn/ready" }, p);
    const active = t.state.turn.activeSeat === 0 ? "a" : "b";
    t.must({ type: "turn/next" }, active);
    expect(phase(t.state)).toBe("shooting");
    // The armies start about 20" apart: units whose guns reach that far have shooting to do, the rest don't.
    const fn = wh40kModule.functions as Record<string, (view: { state: GameState }, id: string) => number>;
    const reaches = (id: string) =>
      fn.shotReach!({ state: t.state }, id) >= fn.enemyGap!({ state: t.state }, id);
    const shooting = nextWork(t.state, active);
    const mine = unitsOf(t.state, active);
    expect(mine.some((u) => !reaches(u))).toBe(true);
    expect(shooting.left.sort()).toEqual(mine.filter(reaches).sort());
    t.must({ type: "turn/next" }, active);
    expect(phase(t.state)).toBe("charge");
    // No charge either (nothing within 12"), but a charge rolled by hand counts as that unit's charge, made or not.
    const unit = unitsOf(t.state, active)[0]!;
    t.must({ type: "dice/roll", count: 2, sides: 6, label: "charge", unitId: unit }, active);
    expect(nextWork(t.state, active).done).toContain(unit);
  });

  it("40k player turns: Done for both in Command, then the active side's units, phase by phase", () => {
    const t = battle("forty-k-11");
    const active = t.state.turn.activeSeat === 0 ? "a" : "b";
    const other = active === "a" ? "b" : "a";
    expect(phase(t.state)).toBe("command");
    // Both sides at once: each has its own Done.
    for (const p of ["a", "b"]) {
      const w = nextWork(t.state, p);
      expect(w).toMatchObject({ kind: "ready", mine: true, ends: { type: "turn/ready" } });
      expect(w.whose.sort()).toEqual(["a", "b"]);
    }
    t.must({ type: "turn/ready" }, other);
    expect(nextWork(t.state, other)).toMatchObject({ kind: "wait", mine: false, whose: [active] });
    t.must({ type: "turn/ready" }, active);
    expect(phase(t.state)).toBe("movement");

    // Movement: every unit of the active side has work; the other side waits.
    const w = nextWork(t.state, active);
    expect(w).toMatchObject({ kind: "units", mine: true, whose: [active], ends: { type: "turn/next" } });
    expect(w.left.sort()).toEqual(unitsOf(t.state, active).sort());
    expect(nextWork(t.state, other)).toMatchObject({
      kind: "wait",
      mine: false,
      whose: [active],
      ends: null,
    });

    // A unit that moved is done; one that remained stationary too.
    const [first, second] = w.left;
    const m = t.state.models[t.state.units[first!]!.modelIds[0]!]!;
    t.must(
      { type: "models/move", moves: [{ id: m.id, to: { x: m.position.x + 1, y: m.position.y } }] },
      active,
    );
    t.must({ type: "action/take", unitId: second!, action: "remainStationary" }, active);
    const after = nextWork(t.state, active);
    expect(after.done.sort()).toEqual([first, second].sort());
    expect(after.left).not.toContain(first);
  });

  it("a roll is its roller's, and the 40k fight order hands the pick to the other side", () => {
    const t = battle("forty-k-11");
    const active = t.state.turn.activeSeat === 0 ? "a" : "b";
    const other = active === "a" ? "b" : "a";
    while (phase(t.state) !== "fight") t.must({ type: "turn/next" }, active);
    // One unit of each side in base contact: both may fight, and the side whose turn it isn't picks first.
    const s = t.state;
    const mine = s.units[unitsOf(s, active)[0]!]!;
    const theirs = s.units[unitsOf(s, other)[0]!]!;
    const at = s.models[theirs.modelIds[0]!]!.position;
    const moves = mine.modelIds.map((id, i) => ({ id, to: { x: at.x + 1.1 + i * 1.1, y: at.y } }));
    t.must({ type: "models/move", moves }, active);
    const pick = nextWork(t.state, other);
    expect(pick).toMatchObject({ kind: "pick", mine: true, whose: [other], ends: null });
    expect(pick.left).toContain(theirs.id);
    // The active side waits on that pick, but can still move on (an opponent who never picks can't hold it up).
    expect(nextWork(t.state, active)).toMatchObject({
      kind: "wait",
      mine: false,
      whose: [other],
      ends: { type: "turn/next" },
    });

    // A fight under way: its dice are the attacker's to roll.
    const weapon = Object.values(theirs.sheet?.weapons ?? {}).find((x) => x.kind === "melee")!;
    t.must(
      { type: "action/take", unitId: theirs.id, action: "fight", weapon: weapon.id, targetId: mine.id },
      other,
    );
    expect(t.state.procedure).toBeTruthy();
    const roll = nextWork(t.state, other);
    expect(roll).toMatchObject({ kind: "roll", mine: true, blocking: true });
    expect(roll.intents.length).toBe(1);
    expect(nextWork(t.state, active).mine).toBe(roll.whose.includes(active));
  });

  it("alternating activations: the side whose go it is activates a unit, then ends its go", () => {
    const system: GameSystem = {
      ...fortyK,
      id: "alternate-test",
      name: "Alternate (test)",
      turn: {
        rounds: 2,
        initiative: "fixed",
        round: [
          {
            kind: "alternate",
            id: "acts",
            pool: { kind: "units" },
            activation: [{ kind: "phase", id: "act", name: "Act" }],
          },
        ],
      },
      actions: [],
    };
    registerSystem(system);
    const t = battle("alternate-test");
    expect(phase(t.state)).toBe("acts");
    const active = t.state.turn.activeSeat === 0 ? "a" : "b";
    const other = active === "a" ? "b" : "a";
    const go = nextWork(t.state, active);
    expect(go).toMatchObject({ kind: "activation", mine: true, ends: { type: "turn/pass" } });
    expect(go.left.sort()).toEqual(unitsOf(t.state, active).sort());
    expect(nextWork(t.state, other)).toMatchObject({ kind: "wait", whose: [active], ends: null });
    // Moving a unit starts its go: it is the one with work, and ending the go is the way on.
    const u = t.state.units[go.left[0]!]!;
    const m = t.state.models[u.modelIds[0]!]!;
    t.must(
      { type: "models/move", moves: [{ id: m.id, to: { x: m.position.x + 1, y: m.position.y } }] },
      active,
    );
    expect(nextWork(t.state, active)).toMatchObject({
      kind: "activation",
      left: [u.id],
      ends: { type: "turn/endActivation" },
    });
    t.must({ type: "turn/endActivation" }, active);
    expect(nextWork(t.state, other)).toMatchObject({ kind: "activation", mine: true });
    expect(nextWork(t.state, active).kind).toBe("wait");
  });

  it("a question, a score and the end of the battle", () => {
    const t = battle("forty-k-11");
    const s = t.state;
    const asked: GameState = {
      ...s,
      script: {
        system: "forty-k-11",
        procedure: "x",
        args: {},
        by: "a",
        startSeq: 0,
        results: [],
        waiting: { player: "b", question: "Which?", options: [{ id: "y", label: "Y" }] },
      },
    };
    expect(nextWork(asked, "b")).toMatchObject({
      kind: "question",
      mine: true,
      blocking: true,
      intents: [{ type: "script/answer", answer: "y" }],
    });
    expect(nextWork(asked, "a")).toMatchObject({ kind: "question", mine: false, whose: ["b"] });
    const scores = [{ seat: 1, key: "k", round: 1, vp: 3, why: "held it" }];
    expect(nextWork(s, "b", { scores })).toMatchObject({
      kind: "score",
      mine: true,
      intents: [{ type: "score/confirm", key: "k", vp: 3 }],
    });
    expect(nextWork(s, "a", { scores }).mine).toBe(false);
    const over = { ...s, turn: { ...s.turn, round: 6 } };
    expect(nextWork(over, "a")).toMatchObject({ kind: "over", whose: [], mine: false });
  });
});
