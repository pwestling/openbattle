import { describe, expect, it } from "vitest";
import "../../systems";
import {
  applyEvent,
  createRecord,
  resolveLogged,
  stateAt,
  systemOf,
  type GameRecord,
  type GameState,
  type Intent,
  type PlayerId,
} from "..";
import { commitmentOf } from "../secrets";
import { gameModule } from "../../systems";
import { spawnIntents } from "../../systems/wh40k/deploy";
import { schedule } from "./turn";
import { story } from "./story";

const rng = () => 0.5;

/** A record built intent by intent, as the host would log it. */
class Table {
  record: GameRecord = createRecord();
  state: GameState = this.record.initial;
  play(intent: Intent, by: PlayerId): number {
    const e = resolveLogged(this.record, intent, by, rng, 0, this.state);
    if (!e) throw new Error(`Rejected: ${JSON.stringify(intent).slice(0, 200)}`);
    this.record = { ...this.record, events: [...this.record.events, e] };
    this.state = { ...applyEvent(this.state, e.event), seq: e.seq };
    return e.seq;
  }
  get seq(): number {
    return this.state.seq;
  }
  unit(owner: PlayerId, name: string) {
    return Object.values(this.state.units).find((u) => u.owner === owner && u.name === name)!;
  }
  /** On to the phase with this id (in the current player's turn, or the next round's). */
  to(phase: string, by: PlayerId) {
    const at = schedule(systemOf(this.state)).findIndex((s) => s.id === phase);
    for (let i = 0; i < 20 && !(this.state.turn.round > 0 && this.state.turn.phase === at); i++)
      this.play({ type: "turn/next" }, by);
  }
}

/** Ana (seat 0) and Ben (seat 1) with the invented 40k sample armies, no terrain. */
function fortyK(): Table {
  const t = new Table();
  t.play({ type: "player/join", player: { id: "p1", name: "Ana", color: "#00f", seat: 0 } }, "p1");
  t.play({ type: "player/join", player: { id: "p2", name: "Ben", color: "#f00", seat: 1 } }, "p2");
  t.play({ type: "game/system", system: "forty-k-11" }, "p1");
  const app = gameModule("forty-k-11")!.app!;
  t.play({ type: "layout/set", layout: { ...app.layout(t.state.table), terrain: [] } }, "p1");
  for (const [p, seat] of [
    ["p1", 0],
    ["p2", 1],
  ] as const)
    for (const i of spawnIntents(t.state, p, app.sample(seat).units, p, "army")) t.play(i, p);
  return t;
}

/** Every model of a unit moved by (dx, dy). */
function shift(t: Table, unitId: string, dx: number, dy: number): Intent {
  const u = t.state.units[unitId]!;
  return {
    type: "models/move",
    moves: u.modelIds.map((id) => {
      const m = t.state.models[id]!;
      return { id, to: { x: m.position.x + dx, y: m.position.y + dy } };
    }),
  };
}

describe("story (#85)", () => {
  it("tells a hand-built 40k turn exactly: two units moved, a shot, two models slain", () => {
    const t = fortyK();
    t.to("movement", "p1");
    const from = t.seq;
    const troopers = t.unit("p1", "Line Troopers");
    const lance = t.unit("p1", "Lance Team");
    const thralls = t.unit("p2", "Ashen Thralls");
    // Line Troopers walk up to 8" from the Thralls; the Lance Team steps forward.
    const target = t.state.models[thralls.modelIds[0]!]!.position;
    const at = t.state.models[troopers.modelIds[0]!]!.position;
    const dy = target.y - at.y + (at.y > target.y ? 8 : -8);
    t.play(shift(t, troopers.id, target.x - at.x, dy), "p1");
    t.play(shift(t, lance.id, 0, at.y > target.y ? -2 : 2), "p1");
    // Undone: a third unit's move that was taken back.
    const walker = t.unit("p1", "Bastion Walker");
    const undone = t.play(shift(t, walker.id, 0, 1), "p1");
    t.play({ type: "undo", seq: undone }, "p1");
    t.to("shooting", "p1");
    const weapon = Object.values(troopers.sheet!.weapons).find((w) => w.kind === "ranged")!;
    t.play(
      { type: "action/take", unitId: troopers.id, action: "shoot", targetId: thralls.id, weapon: weapon.id },
      "p1",
    );
    // The players take two casualties off by hand while the attack is open.
    for (const id of thralls.modelIds.slice(0, 2))
      t.play({ type: "model/wounds", id, woundsLost: 1, destroyed: true }, "p2");
    t.play({ type: "procedure/clear" }, "p1");
    const to = t.seq;

    const s = story(t.record, from, to, "p2");
    const ana = s.sides.find((x) => x.seat === 0)!;
    const ben = s.sides.find((x) => x.seat === 1)!;
    expect(ana.name).toBe("Ana");
    expect(ana.moved.sort()).toEqual([troopers.id, lance.id].sort());
    expect(ana.acts.map((a) => [a.action, a.verb, a.units])).toEqual([["shoot", "shot", [troopers.id]]]);
    expect(ana.attacks).toEqual([
      {
        attacker: troopers.id,
        attackerName: "Line Troopers",
        target: thralls.id,
        targetName: "Ashen Thralls",
        slain: 2,
        wounds: 2,
        destroyed: false,
      },
    ]);
    expect(ben.losses).toEqual([
      { unit: thralls.id, name: "Ashen Thralls", slain: 2, wounds: 2, destroyed: false },
    ]);
    expect(s.lines).toEqual([
      "Ana: moved 2 units, shot with 1 unit, and attacked Ashen Thralls (2 slain).",
      "Ben: lost 2 from Ashen Thralls.",
    ]);
    expect(s.start).toMatchObject({ round: 1, seat: 0, phase: "Movement" });
    expect(s.end).toMatchObject({ round: 1, seat: 0, phase: "Shooting" });
    expect(s.phases.map((p) => p.phase)).toEqual(["Shooting"]);
    // Each reader's own line: the one who lost models, the one who shot, and a watcher.
    expect(s.brief).toBe("Lost 2 Ashen Thralls. Ana attacked Ashen Thralls. Ana moved 2 units.");
    expect(story(t.record, from, to, "p1").brief).toBe("Your Line Troopers hit Ashen Thralls: 2 slain.");
    expect(story(t.record, from, to, null).brief).toBe(
      "Ana attacked Ashen Thralls (2 slain). Ana moved 2 units.",
    );
    // The same from a state the caller already holds.
    expect(story(t.record, from, to, "p2", { start: stateAt(t.record, from) })).toEqual(s);
  });

  it("counts stratagems with their cost, VP with the rule's name, and a destroyed unit", () => {
    const t = fortyK();
    t.to("command", "p1");
    const from = t.seq;
    const marshal = t.unit("p1", "Field Marshal");
    for (const id of marshal.modelIds)
      t.play({ type: "model/wounds", id, woundsLost: 4, destroyed: true }, "p1");
    t.play(
      {
        type: "player/action",
        player: "p1",
        action: "otherStratagem",
        payment: [],
        label: "Iron Will",
      } as never,
      "p1",
    );
    t.play(
      { type: "score/confirm", key: "hold:1:1", seat: 1, round: 1, vp: 5, why: "Hold the middle" } as never,
      "p2",
    );
    const s = story(t.record, from, t.seq, "p1");
    const ana = s.sides[0]!;
    const ben = s.sides[1]!;
    expect(ana.destroyed).toEqual([marshal.id]);
    expect(ana.plays.map((p) => p.name)).toEqual(["Iron Will"]);
    expect(ben.vp).toBe(5);
    expect(ben.scores).toEqual([{ vp: 5, why: "Hold the middle", round: 1 }]);
    expect(s.brief).toBe("Field Marshal destroyed. Ben scored 5 VP.");
    expect(s.lines).toContain("Ben: scored 5 VP (Hold the middle).");
  });

  it("never tells a secret before it is revealed, and counts it once it is", () => {
    const t = fortyK();
    t.to("command", "p1");
    const from = t.seq;
    const value = "objective:secret-plan-xyzzy";
    const commitment = commitmentOf(value, "a1b2c3");
    t.play(
      {
        type: "secret/commit",
        player: "p2",
        secrets: [{ key: "objective:001", commitment }],
        label: "a plan",
      },
      "p2",
    );
    const hidden = story(t.record, from, t.seq, "p1");
    expect(JSON.stringify(hidden)).not.toContain("xyzzy");
    expect(JSON.stringify(hidden)).not.toContain(commitment);
    expect(hidden.sides[1]!.secrets).toEqual({ committed: 1, revealed: [] });
    t.play(
      {
        type: "secret/reveal",
        player: "p2",
        key: "objective:001",
        value,
        salt: "a1b2c3",
        label: "their plan",
      },
      "p2",
    );
    const shown = story(t.record, from, t.seq, "p1");
    expect(shown.sides[1]!.secrets).toEqual({ committed: 1, revealed: ["their plan"] });
    expect(shown.lines).toContain("Ben: revealed 1 secret.");
  });
});
