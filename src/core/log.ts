import { resolveIntent, type GameEvent, type Intent, type Rng } from "./actions";
import { applyEvent } from "./reducer";
import { createInitialState, type GameState, type PlayerId } from "./types";
import { eventProblem, jsonProblem } from "./validate";
import type { Args } from "../sdk";
import { structuralDependencies } from "./structural-dependencies";

/** A host-recorded obligation; its identity distinguishes repeated inner events. */
export interface Reaction {
  id: string;
  system: string;
  macro: string;
  args: Args;
  by: PlayerId;
  cause: number;
  depth: number;
}

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
  /** Reactions owed by this committed event, resolved with its original composition. */
  reactions?: Reaction[];
}

/** A whole game: the starting table plus every event since. Also the replay file format. */
export interface GameRecord {
  format: "open-battle/record@9";
  initial: GameState;
  events: LoggedEvent[];
}

export function createRecord(initial: GameState = createInitialState()): GameRecord {
  return { format: "open-battle/record@9", initial, events: [] };
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
  if (record.format !== "open-battle/record@9")
    throw new Error(
      `Unsupported game record ${String(record.format)}; this build reads open-battle/record@9`,
    );
  const undone = undoneSeqs(record, uptoSeq);
  let state = record.initial;
  for (const logged of record.events) {
    if (logged.seq > uptoSeq) break;
    if (!undone.has(logged.seq)) state = applyEvent(state, logged.event);
    state = { ...state, seq: logged.seq };
  }
  return state;
}

/** Outstanding recorded work, independent of whatever hook code is loaded now. */
export function pendingReactions(record: GameRecord, uptoSeq = Infinity): Reaction[] {
  const undone = undoneSeqs(record, uptoSeq);
  const pending = new Map<string, Reaction>();
  for (const logged of record.events) {
    if (logged.seq > uptoSeq) break;
    const event = logged.event;
    // Undoing a reaction's effects is an explicit cancellation, not a request to rerun it.
    if (event.type === "macro/step" && event.started && event.reaction) pending.delete(event.reaction);
    if (undone.has(logged.seq)) continue;
    if (event.type === "player/claim") {
      for (const [id, reaction] of pending)
        if (reaction.by === event.player) pending.set(id, { ...reaction, by: event.by });
    }
    for (const reaction of logged.reactions ?? []) pending.set(reaction.id, reaction);
  }
  return [...pending.values()];
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
  if (jsonProblem(intent) || !intent || typeof intent !== "object") return null;
  if (
    (intent.type === "game/system" || intent.type === "game/packages") &&
    (state.macro || pendingReactions(record).length) &&
    (intent.type === "game/system"
      ? intent.system !== state.system
      : JSON.stringify({ app: intent.app, system: intent.system, packages: intent.packages }) !==
        JSON.stringify(state.packages))
  )
    return null;
  if (intent.type === "macro/start" && intent.reaction !== undefined) {
    const reaction = pendingReactions(record).find((r) => r.id === intent.reaction);
    if (
      !reaction ||
      reaction.system !== state.system ||
      reaction.by !== by ||
      reaction.macro !== intent.macro ||
      reaction.cause !== intent.cause ||
      JSON.stringify(reaction.args) !== JSON.stringify(intent.args ?? {})
    )
      return null;
  }
  if (Object.getOwnPropertyDescriptor(intent, "type")?.value === "undo") {
    if (eventProblem(intent, state) || intent.type !== "undo") return null;
    // Every supplied root brings its structural and macro dependents with it.
    const also = dependents(record, intent.seq, intent.also);
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
 * Transitive closure of active engine prerequisites and macro causality. Initial-state
 * entities have no creation event to undo; replacement IDs establish new identities.
 */
export function dependents(record: GameRecord, seq: number, roots: readonly number[] = []): number[] {
  const undone = undoneSeqs(record);
  const downstream = new Map<number, number[]>();
  for (const [at, prerequisites] of structuralDependencies(record, undone))
    for (const prerequisite of prerequisites) {
      const dependents = downstream.get(prerequisite);
      if (dependents) dependents.push(at);
      else downstream.set(prerequisite, [at]);
    }
  const taken = new Set<number>([seq, ...roots]);
  const queue = [...taken];
  for (let i = 0; i < queue.length; i++)
    for (const dependent of downstream.get(queue[i]!) ?? [])
      if (!taken.has(dependent)) {
        taken.add(dependent);
        queue.push(dependent);
      }
  taken.delete(seq);
  return [...taken].sort((a, b) => a - b);
}

/** An event can be undone once, and undo events themselves cannot be undone (yet). */
export function canUndo(record: GameRecord, seq: number): boolean {
  const target = record.events.find((e) => e.seq === seq);
  // A branch's opening records its origin, not a move.
  if (target?.event.type === "game/branch") return false;
  return !!target && target.event.type !== "undo" && !undoneSeqs(record).has(seq);
}

export function appendEvent(record: GameRecord, logged: LoggedEvent): GameRecord {
  return { ...record, events: [...record.events, logged] };
}
