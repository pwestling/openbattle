import { describe, expect, it } from "vitest";
import "../systems";
import { createInitialState, type GameState, type Intent, type PlayerId } from "../core";
import { appendEvent, createRecord, lastSeq, resolveLogged, stateAt, type GameRecord } from "../core/log";
import { currentSlot } from "../core/content/turn";
import { spawnIntents } from "../systems/wh40k/deploy";
import { sampleRoster } from "../systems/wh40k/sample";
import { stepFor } from "../next/step";
import { deadEnds } from "./deadEnds";

/** A 40k game in its first Movement phase, kept as a log like the host's. */
function movement(): { record: GameRecord; state: GameState; active: PlayerId } {
  let record = createRecord(createInitialState());
  const must = (intent: Intent, by: PlayerId) => {
    const logged = resolveLogged(record, intent, by, () => 0.5, lastSeq(record) + 1);
    if (!logged) throw new Error(`refused: ${intent.type}`);
    record = appendEvent(record, logged);
  };
  must({ type: "player/join", player: { id: "a", name: "A", color: "#888", seat: 0 } }, "a");
  must({ type: "player/join", player: { id: "b", name: "B", color: "#888", seat: 1 } }, "b");
  must({ type: "game/system", system: "forty-k-11" }, "a");
  for (const [p, seat] of [
    ["a", 0],
    ["b", 1],
  ] as const)
    for (const i of spawnIntents(stateAt(record), p, sampleRoster(seat).units.slice(0, 2), `${p}-`))
      must(i, p);
  must({ type: "turn/next" }, "a");
  must({ type: "turn/ready" }, "a");
  must({ type: "turn/ready" }, "b");
  const state = stateAt(record);
  expect(currentSlot(state)?.id).toBe("movement");
  return { record, state, active: state.turn.activeSeat === 0 ? "a" : "b" };
}

describe("no dead ends (#84)", () => {
  it("passes the step bar on a plain Movement phase", () => {
    const { record, state } = movement();
    expect(deadEnds(record, state, [])).toEqual([]);
  });

  it("catches a step bar that leaves every screen waiting", () => {
    const { record, state, active } = movement();
    const broken: typeof stepFor = (input) => ({
      ...stepFor(input),
      tone: "wait",
      buttons: [],
      next: undefined,
    });
    const found = deadEnds(record, state, [], broken);
    expect(found.map((d) => d.rule).sort()).toEqual(["endHidden", "noStep", "unseenWork"]);
    expect(found.find((d) => d.rule === "unseenWork")).toMatchObject({ screen: active });
    expect(found.every((d) => !d.allowed)).toBe(true);
  });

  it("catches a lit button the engine refuses, with nothing else to press", () => {
    const { record, state } = movement();
    // Done in a phase that isn't simultaneous: the host won't log turn/ready here.
    const refused: typeof stepFor = (input) => ({
      ...stepFor(input),
      next: undefined,
      buttons: [{ label: "Done", lit: true, intent: { type: "turn/ready" } }],
    });
    const rules = deadEnds(record, state, [], refused).map((d) => d.rule);
    expect(rules).toContain("noStep");
    expect(rules).toContain("endHidden");
  });

  it("asks nothing of a finished battle", () => {
    const { record, state } = movement();
    expect(deadEnds(record, { ...state, turn: { ...state.turn, round: 6 } }, [])).toEqual([]);
  });
});
