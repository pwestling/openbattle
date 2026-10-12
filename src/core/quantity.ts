import { stableJson } from "./secrets";
import type { Bag, EntityRef, GameState, Json, Mod } from "./types";

/**
 * Quantities. Every player, unit, model and token has an open bag `q` of
 * named values a game registers (wounds, command points, a profile), and the
 * state keeps a list of modifier records on top. A quantity's value is worked
 * out from the two here, so the log holds what happened ("-1 to hit until the
 * phase ends"), never a result that depends on which rules were loaded.
 *
 * Order: the last `set` replaces the base; every `add` is summed on; then
 * each `min` caps it from above and each `max` lifts it from below.
 *
 * A modifier ends mechanically: `until` names a pointer field and the value
 * it must still have. Nothing else expires one; a game takes the rest off
 * with `mod/remove`.
 */

/** The entity a reference names, or undefined when it is gone. */
function entityOf(state: GameState, ref: EntityRef): { q?: Bag; tags?: string[] } | undefined {
  switch (ref.kind) {
    case "player":
      return state.players[ref.id];
    case "unit":
      return state.units[ref.id];
    case "model":
      return state.models[ref.id];
    case "token":
      return state.tokens[ref.id];
  }
}

/** Whether a modifier still holds at the pointer where the game is now. */
function modHolds(state: GameState, mod: Mod): boolean {
  if (!mod.until) return true;
  const now: Json | undefined = state.pointer[mod.until.field];
  return stableJson(now ?? null) === stableJson(mod.until.is);
}

/** The modifiers on one entity (or one of its quantities) that still hold. */
export function modsOn(state: GameState, ref: EntityRef, q?: string): Mod[] {
  return state.mods.filter(
    (m) =>
      m.target.kind === ref.kind &&
      m.target.id === ref.id &&
      (q === undefined || m.q === q) &&
      modHolds(state, m),
  );
}

/** A quantity as stored, before any modifier. */
function baseQuantity(state: GameState, ref: EntityRef, key: string): Json | undefined {
  return entityOf(state, ref)?.q?.[key];
}

/** A quantity's value now: its base (or `fallback`) with the modifiers that hold. */
export function quantity(state: GameState, ref: EntityRef, key: string, fallback = 0): number {
  const stored = baseQuantity(state, ref, key);
  let value = typeof stored === "number" ? stored : fallback;
  const mods = modsOn(state, ref, key);
  const set = mods.filter((m) => m.op === "set").at(-1);
  if (set) value = set.value;
  for (const m of mods) if (m.op === "add") value += m.value;
  for (const m of mods) if (m.op === "min") value = Math.min(value, m.value);
  for (const m of mods) if (m.op === "max") value = Math.max(value, m.value);
  return value;
}

/** Drop the modifiers whose `until` no longer holds: the state need not carry what can never apply again. */
export function dropExpired(state: GameState): GameState {
  const mods = state.mods.filter((m) => modHolds(state, m));
  return mods.length === state.mods.length ? state : { ...state, mods };
}
