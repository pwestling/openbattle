import { describe, expect, it } from "vitest";
import {
  appendEvent,
  applyEvent,
  createRecord,
  stateAt,
  type GameEvent,
  type GameRecord,
  type GameState,
} from "../core";
import { leadPairs, standingWith } from "./leading";

const log = (events: GameEvent[]): GameRecord =>
  events.reduce((r, event, i) => appendEvent(r, { seq: i + 1, at: i, by: "p1", event }), createRecord());

const model = (id: string, x: number, y: number) => ({
  id,
  owner: "p1",
  label: id,
  position: { x, y },
  facing: 0,
  base: { shape: "round" as const, diameterMm: 32 },
  profile: { name: id, chars: {} },
  weapons: [],
});

const LEADER = { name: "Leader", text: "This model can be attached to a squad." };
const unit = (id: string, name: string, x: number, keywords: string[] = [], leader = false): GameEvent => ({
  type: "unit/add",
  unit: {
    id,
    owner: "p1",
    name,
    modelIds: [],
    formation: { kind: "skirmish" },
    sheet: { weapons: {}, abilities: leader ? [LEADER] : [], keywords },
  },
  models: [model(`${id}1`, x, 0)],
});

/** Two characters and a squad and a walker standing together: the TTS-save case (UX N23). */
function table(): GameState {
  return stateAt(
    log([
      { type: "player/join", player: { id: "p1", name: "A", color: "#f00" } },
      unit("walker", "Furnace Crawler", 0, ["Vehicle"]),
      unit("cap", "Pyre Captain", 1, ["Character", "Infantry"], true),
      unit("adept", "Pyre Adept", 2, ["Character", "Infantry"], true),
      unit("squad", "Cinder Thralls", 3, ["Infantry"]),
    ]),
  );
}

const attach = (state: GameState, id: string, to: string) =>
  applyEvent(state, { type: "unit/attach", id, to });

describe("leading at deployment", () => {
  it("never offers a vehicle, and one leader to a squad", () => {
    const game = table();
    expect(standingWith(game, game.units.cap!)?.id).toBe("squad");
    const pairs = leadPairs(game, "p1");
    expect(pairs.map((p) => [p.leader.id, p.near.id])).toEqual([["cap", "squad"]]);
  });

  it("stops offering once led: the merged unit is never a leader, and nothing merges again", () => {
    let game = table();
    for (const p of leadPairs(game, "p1")) game = attach(game, p.leader.id, p.near.id);
    const count = Object.keys(game.units).length;
    // The second character has no squad left to lead; pressing the step again changes nothing.
    expect(leadPairs(game, "p1")).toEqual([]);
    expect(standingWith(game, game.units.squad!)).toBeUndefined();
    expect(Object.keys(game.units).length).toBe(count);
  });
});
