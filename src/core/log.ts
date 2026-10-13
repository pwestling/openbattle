import { resolveIntent, type GameEvent, type Intent, type Rng } from "./actions";
import { applyEvent } from "./reducer";
import { createInitialState, type GameState, type PlayerId } from "./types";

/**
 * The game is an event log. The host turns every intent into a numbered
 * event, and everything else derives from the log: the current table, live
 * sync, undo, spectating, replays and stats.
 */
export interface LoggedEvent {
  seq: number;
  /** Peer who asked for it. */
  by: PlayerId;
  /** Host clock, ms since epoch. Used for replays, never for game logic. */
  at: number;
  event: GameEvent;
  /** Peer that was host when it was logged (and rolled its dice), once hosts can change. */
  host?: PlayerId;
  /**
   * Under shared dice (core/sharedDice.ts): the intent it came from, so the
   * other player can roll it again once the host reveals its seed.
   */
  intent?: Intent;
  /** Under shared dice, a rules package's event: the seed its sandbox was given. */
  seed?: number;
}

/** A whole game: the starting table plus every event since. Also the replay file format. */
export interface GameRecord {
  format: "open-battle/record@2";
  initial: GameState;
  events: LoggedEvent[];
}

export function createRecord(initial: GameState = createInitialState()): GameRecord {
  return { format: "open-battle/record@2", initial, events: [] };
}

export function lastSeq(record: GameRecord): number {
  return record.events.at(-1)?.seq ?? record.initial.seq;
}

/** Seqs taken back by undo events at or before `uptoSeq`. */
function undoneSeqs(record: GameRecord, uptoSeq = Infinity): Set<number> {
  const undone = new Set<number>();
  for (const { seq, event } of record.events) {
    if (seq > uptoSeq) break;
    if (event.type === "undo") for (const s of [event.seq, ...(event.also ?? [])]) undone.add(s);
  }
  return undone;
}

/** Rebuild the table as it stood after `uptoSeq` (default: now). Replays scrub with this. */
export function stateAt(record: GameRecord, uptoSeq = Infinity): GameState {
  const undone = undoneSeqs(record, uptoSeq);
  let state = record.initial;
  for (const logged of record.events) {
    if (logged.seq > uptoSeq) break;
    if (!undone.has(logged.seq)) state = applyEvent(state, logged.event);
    state = { ...state, seq: logged.seq };
  }
  return state;
}

/**
 * Host side: turn an intent into the next logged event, or null if it is
 * rejected. Only malformed requests are rejected; rules are advisory.
 */
export function resolveLogged(
  record: GameRecord,
  intent: Intent,
  by: PlayerId,
  rng: Rng,
  now: number,
  state: GameState = stateAt(record),
): LoggedEvent | null {
  if (intent.type === "undo") {
    // What the target set off goes with it: a macro's later steps, a hook's run (see dependents).
    const also = [...new Set([...(intent.also ?? []), ...dependents(record, intent.seq)])].sort(
      (a, b) => a - b,
    );
    if (![intent.seq, ...also].every((s) => canUndo(record, s))) return null;
    return {
      seq: lastSeq(record) + 1,
      by,
      at: now,
      event: { type: "undo", seq: intent.seq, ...(also.length ? { also } : {}) },
    };
  }
  const event = resolveIntent(intent, by, rng, state, (seq) => stateAt(record, seq));
  return event && { seq: lastSeq(record) + 1, by, at: now, event };
}

/**
 * The events that must be undone with `seq`, which haven't been already: the
 * later steps of the same macro run, and any macro run that `seq` set off (a
 * hook answering it). Undoing the first without these would leave a macro
 * answering a table that never was.
 */
export function dependents(record: GameRecord, seq: number): number[] {
  const undone = undoneSeqs(record);
  const target = record.events.find((e) => e.seq === seq)?.event;
  const taken = new Set<number>([seq]);
  const runs = new Set<number>();
  if (target?.type === "macro/step") runs.add(target.run);
  for (const { seq: at, event } of record.events) {
    if (at <= seq || undone.has(at) || event.type !== "macro/step") continue;
    if (runs.has(event.run) || (event.cause !== undefined && taken.has(event.cause))) {
      taken.add(at);
      runs.add(event.run);
    }
  }
  taken.delete(seq);
  return [...taken].sort((a, b) => a - b);
}

/** An event can be undone once, and undo events themselves cannot be undone (yet). */
export function canUndo(record: GameRecord, seq: number): boolean {
  const target = record.events.find((e) => e.seq === seq);
  // Shared dice (core/sharedDice.ts), ranked bookkeeping and a branch's opening are promises, not moves.
  const kind = target?.event.type;
  if (
    kind === "dice/commit" ||
    kind === "dice/seed" ||
    kind === "dice/reveal" ||
    kind === "game/branch" ||
    kind?.startsWith("ranked/")
  )
    return false;
  return !!target && target.event.type !== "undo" && !undoneSeqs(record).has(seq);
}

export function appendEvent(record: GameRecord, logged: LoggedEvent): GameRecord {
  return { ...record, events: [...record.events, logged] };
}
