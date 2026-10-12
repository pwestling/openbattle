import { describe, expect, it } from "vitest";
import "../systems";
import { wh40kModule } from "../systems/wh40k/module";
import { spawnIntents } from "../systems/wh40k/deploy";
import {
  appendEvent,
  branchRecord,
  createInitialState,
  createRecord,
  resolveLogged,
  stateAt,
  type GameRecord,
  type GameState,
  type Intent,
  type PlayerId,
} from "./index";
import { commitmentOf, secretsWithPrefix, sha256Hex } from "./secrets";

const rng = () => 0.5;

function host(record: GameRecord, intent: Intent, by: PlayerId): GameRecord {
  const logged = resolveLogged(record, intent, by, rng, 0);
  if (!logged) throw new Error(`Rejected: ${JSON.stringify(intent)}`);
  return appendEvent(record, logged);
}

/** A secret is keyed by a prefix and a number; these tests commit and look for "note:" ones. */
const noteKey = (i: number) => `note:${String(i).padStart(3, "0")}`;
/** The notes a player has committed, or undefined if they have none. */
const notesOf = (state: GameState, player: PlayerId) => {
  const notes = secretsWithPrefix(state, player, "note:");
  return notes.length ? notes : undefined;
};

/** A game in round 1 with player 1's secrets committed. */
function secretGame(): GameRecord {
  let r = createRecord(createInitialState());
  r = host(r, { type: "player/join", player: { id: "p1", name: "Ana", color: "#00f", seat: 0 } }, "p1");
  r = host(r, { type: "player/join", player: { id: "p2", name: "Ben", color: "#f00", seat: 1 } }, "p2");
  r = host(r, { type: "game/system", system: wh40kModule.system.id }, "p1");
  for (const [p, seat] of [
    ["p1", 0],
    ["p2", 1],
  ] as const)
    for (const i of spawnIntents(stateAt(r), p, wh40kModule.app!.sample(seat).units, p, "army"))
      r = host(r, i, p);
  r = host(r, { type: "turn/next" }, "p1");
  const mine = Object.values(stateAt(r).units).filter((u) => u.owner === "p1");
  const secrets = mine.map((u, i) => ({ key: noteKey(i), commitment: commitmentOf(u.id, `s${i}`) }));
  return host(r, { type: "secret/commit", player: "p1", secrets }, "p1");
}

describe("branching a game (what if)", () => {
  it("starts a new game at a point in the parent, naming it, without its secrets", () => {
    const parent = secretGame();
    const at = parent.events.at(-2)!.seq;
    const branch = branchRecord(parent, parent.events.at(-1)!.seq);
    const first = branch.events[0]!;
    expect(first.event).toMatchObject({
      type: "game/branch",
      branch: {
        parentHash: sha256Hex(JSON.stringify(parent)),
        parentSeq: parent.events.at(-1)!.seq,
        round: 1,
      },
    });
    expect(first.event.type === "game/branch" && first.event.branch.title).toBe("Ana vs Ben, round 1");
    expect(first.event.type === "game/branch" && first.event.branch.droppedSecrets).toBeGreaterThan(0);
    const state = stateAt(branch);
    expect(state.secrets).toBeUndefined();
    expect(notesOf(state, "p1")).toBeUndefined();
    expect(state.branch?.parentSeq).toBe(parent.events.at(-1)!.seq);
    // Same table: units, system, turn.
    const was = stateAt(parent);
    expect(state.system).toBe(was.system);
    expect(Object.keys(state.units)).toEqual(Object.keys(was.units));
    expect(state.turn).toEqual(was.turn);

    // Play goes on in the branch: player 1 commits a new secret.
    const again = host(
      branch,
      {
        type: "secret/commit",
        player: "p1",
        secrets: [{ key: noteKey(0), commitment: commitmentOf("x", "y") }],
      },
      "p1",
    );
    expect(notesOf(stateAt(again), "p1")).toHaveLength(1);
    // An earlier point: before the commit.
    expect(stateAt(branchRecord(parent, at)).secrets).toBeUndefined();
  });

  it("keeps a player's secrets when they come back under a new id (UX 131)", () => {
    const r = host(secretGame(), { type: "player/claim", player: "p1" }, "p1-again");
    const s = stateAt(r);
    expect(s.secrets?.p1).toBeUndefined();
    expect(notesOf(s, "p1-again")?.length).toBeGreaterThan(0);
  });
});
