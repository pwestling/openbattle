import { applyEvent, undoneSeqs, type GameRecord, type GameState } from "../core";
import { currentSlot, systemOf } from "../core/content/turn";
import type { ScoringMoment } from "../sdk";

/**
 * Scoring moments and the scores waiting on a player. The app works out each
 * suggestion from the table as it stood at the moment (the end of a phase, of
 * a round, of the battle); a player of that side confirms it with
 * `score/confirm`, which logs it once under its key.
 */

interface Moment {
  kind: "phaseEnd" | "roundEnd" | "gameEnd";
  /** The phase that ended (phaseEnd). */
  phase?: string;
  /** The side whose turn it was (phaseEnd). */
  seat?: number;
  round: number;
  /** The table as it stood. */
  state: GameState;
  /** The event that ended it. */
  seq: number;
}

/** Every scoring moment so far: each move to the next phase ends one, and maybe a round or the battle. */
export function moments(record: GameRecord): Moment[] {
  const undone = undoneSeqs(record);
  const out: Moment[] = [];
  let state = record.initial;
  for (const logged of record.events) {
    if (undone.has(logged.seq)) continue;
    const before = state;
    state = { ...applyEvent(state, logged.event), seq: logged.seq };
    // The turn moves on with ▶, and also when both sides pass or the last activation ends (UX 324-325).
    if (logged.event.type === "turn/prev" || before.turn.round === 0) continue;
    if (state.turn.round <= before.turn.round && state.turn.phase === before.turn.phase) continue;
    const slot = currentSlot(before);
    if (slot?.id)
      out.push({
        kind: "phaseEnd",
        phase: slot.id,
        seat: before.turn.activeSeat,
        round: before.turn.round,
        state: before,
        seq: logged.seq,
      });
    if (state.turn.round > before.turn.round) {
      out.push({ kind: "roundEnd", round: before.turn.round, state: before, seq: logged.seq });
      const rounds = systemOf(state).turn.rounds;
      if (typeof rounds === "number" && state.turn.round > rounds)
        out.push({ kind: "gameEnd", round: before.turn.round, state: before, seq: logged.seq });
    }
  }
  return out;
}

/** Whether a scoring rule's moment is this one. */
export const momentMatches = (at: ScoringMoment, m: Moment) =>
  "phaseEnd" in at
    ? m.kind === "phaseEnd" && m.phase === at.phaseEnd && m.round >= (at.fromRound ?? 1)
    : "roundEnd" in at
      ? m.kind === "roundEnd" && m.round >= (at.fromRound ?? 1)
      : m.kind === "gameEnd";
