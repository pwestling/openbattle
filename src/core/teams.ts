import type { GameState, Player, PlayerId } from "./types";

/**
 * Team games (2v2 and up): a side is a seat, and several players can sit at
 * it (settings.teamSize). The pointer goes by seat, so a side takes its turn
 * together.
 */

/** The players at a seat, in the order they joined (the same on every peer). */
export function sidePlayers(state: GameState, seat: number): Player[] {
  return Object.values(state.players).filter((p) => p.seat === seat);
}

/**
 * Whether two players are on opposite sides. Teammates (players at the same
 * seat) are allies. A player with no seat yet only counts as their own side.
 */
export function opposed(state: GameState, a: PlayerId | undefined, b: PlayerId | undefined): boolean {
  if (a === b) return false;
  const sa = a === undefined ? undefined : state.players[a]?.seat;
  const sb = b === undefined ? undefined : state.players[b]?.seat;
  return sa === undefined || sb === undefined || sa !== sb;
}
