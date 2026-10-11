import {
  applyEvent,
  createInitialState,
  resolveIntent,
  type GameEvent,
  type GameState,
  type Intent,
  type PlayerId,
  type Unit,
} from "../../core";
import { hookIntents } from "../../core/script";
import type { ProcedureRun } from "../../core/content/runner";
import { spawnIntents } from "../wh40k/deploy";
import "../index";
import { qd6Layout } from "./layout";
import type { ImportedRoster } from "../wh40k/roster";
import { qd6Sample } from "./sample";

/** Test helpers for Quality d6 (#82): seeded dice, a deployed table, units placed by hand. */

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Dice that come up these values in turn, the last repeating once the rest are used. */
export function dice(...values: number[]) {
  let i = 0;
  return () => (values[Math.min(i++, values.length - 1)]! - 0.5) / 6;
}

let last: GameEvent | null = null;

/** The notes the last intent `play` resolved wrote to the log (a code procedure's). */
export function lastNotes(): string[] {
  const events = last?.type === "script/step" ? last.events : last ? [last] : [];
  return events.flatMap((e) => (e.type === "log/note" ? [e.text] : []));
}

/** Resolve an intent as the host would and apply it; turn hooks it sets off run too. */
export function play(state: GameState, intent: Intent, from: PlayerId, r = rng(1)): GameState {
  const event = resolveIntent(intent, from, r, state);
  if (!event) throw new Error(`Rejected: ${JSON.stringify(intent)}`);
  last = event;
  const next = applyEvent({ ...state, seq: state.seq + 1 }, event);
  let out = next;
  for (const hook of hookIntents(state, next, event)) {
    const e = resolveIntent(hook, from, r, out);
    if (e) out = applyEvent({ ...out, seq: out.seq + 1 }, e);
  }
  return out;
}

/** Two seated players, the game chosen, an empty table and the armies deployed. */
export function setup(armies: [ImportedRoster, ImportedRoster] = [qd6Sample(0), qd6Sample(1)]): GameState {
  let s = createInitialState();
  s = play(s, { type: "player/join", player: { id: "p1", name: "A", color: "#00f", seat: 0 } }, "p1");
  s = play(s, { type: "player/join", player: { id: "p2", name: "B", color: "#f00", seat: 1 } }, "p2");
  s = play(s, { type: "game/system", system: "qd6-1" }, "p1");
  s = play(s, { type: "layout/set", layout: { ...qd6Layout(), terrain: [] } }, "p1");
  for (const [p, seat] of [
    ["p1", 0],
    ["p2", 1],
  ] as const)
    for (const i of spawnIntents(s, p, armies[seat].units, p, "army")) s = play(s, i, p);
  return s;
}

/** Start the battle with seat 0 going first. */
export function start(s: GameState): GameState {
  s = play(s, { type: "turn/next" }, "p1");
  return s.turn.activeSeat === 0 ? s : applyEvent(s, { type: "turn/first", seat: 0 });
}

export const unitNamed = (s: GameState, name: string): Unit =>
  Object.values(s.units).find((u) => u.name === name)!;

/** Put every model of a unit in a row from (x, y), `gap` inches apart. */
export function place(s: GameState, unitId: string, x: number, y: number, gap = 1.2): GameState {
  const unit = s.units[unitId]!;
  const moves = unit.modelIds.map((id, i) => ({ id, to: { x: x + i * gap, y } }));
  return applyEvent(s, { type: "models/move", moves, setup: true });
}

/** Every model of a unit with these characteristics. */
export function withChars(s: GameState, unitId: string, chars: Record<string, string>): GameState {
  const models = { ...s.models };
  for (const id of s.units[unitId]!.modelIds) {
    const m = models[id]!;
    models[id] = { ...m, profile: { ...m.profile!, chars: { ...m.profile!.chars, ...chars } } };
  }
  return { ...s, models };
}

/** A unit with these abilities instead of its own. */
export function withRules(s: GameState, unitId: string, names: string[]): GameState {
  const u = s.units[unitId]!;
  const sheet = { ...u.sheet!, abilities: names.map((name) => ({ name, text: "" })) };
  return { ...s, units: { ...s.units, [unitId]: { ...u, sheet } } };
}

/** A weapon of the unit with these special rules instead of its own. */
export function withWeaponRules(s: GameState, unitId: string, weapon: string, rules: string[]): GameState {
  const u = s.units[unitId]!;
  const w = { ...u.sheet!.weapons[weapon]!, keywords: rules };
  const sheet = { ...u.sheet!, weapons: { ...u.sheet!.weapons, [weapon]: w } };
  return { ...s, units: { ...s.units, [unitId]: { ...u, sheet } } };
}

/** A finished run's record of one step. */
export const record = (run: ProcedureRun, step: string) =>
  run.records.find((r) => r.id === step) as unknown as { successes: number; in: number; out: number };

export const alive = (s: GameState, unitId: string) =>
  s.units[unitId]!.modelIds.filter((id) => !s.models[id]!.destroyed).length;
