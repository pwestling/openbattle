/**
 * Ranked games: the part every peer applies the same way. A player ties a key
 * (a P-256 public key, src/player in older builds) to their seat with
 * `ranked/card`; shared dice (sharedDice.ts) need both players to have one.
 * The log only carries the keys; what a result is and how it is signed is a
 * game's own business.
 */

/** A player key as text: the P-256 public key's x and y (base64url), joined by a dot. */
export type PlayerKey = string;

export interface RankedState {
  /** Each opted-in player's key. */
  keys: Record<string, PlayerKey>;
}

export const isPlayerKey = (k: unknown): k is PlayerKey =>
  typeof k === "string" && /^[A-Za-z0-9_-]{40,48}\.[A-Za-z0-9_-]{40,48}$/.test(k);
