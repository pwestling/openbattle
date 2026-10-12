import { create } from "zustand";
import type { GameState } from "../core";
import { aliveModels, suggestAttack } from "../systems/wh40k/rules";
import { useStore } from "../store";
import { t } from "../i18n";
import { sendVolley } from "../talk/talk";

/**
 * "Shoot everything at…" (UX 398): a unit's ranged weapons, one attack each,
 * at one target, declared one after another as each attack is done.
 */
interface Volley {
  attackerId: string;
  targetId: string;
  /** The weapons still to fire, in order. */
  weapons: string[];
  /** How many it started with, for "Weapon 2 of 3". */
  total: number;
}

/** This screen's shooting habits (#81), remembered: saves rolled for you, hits and wounds in one go. */
interface ShotHabits {
  /**
   * Defending: your saves roll as soon as the wounds land, against a person or the computer. Only
   * when chosen: otherwise a roll waits for your press, for as long as it takes (Porter, 2026-10-12).
   */
  rollSaves: boolean;
  /** Attacking a person: one roll button does the hits and then the wounds. */
  oneGo: boolean;
}
const HABITS_KEY = "open-battle:shot-habits";
function loadHabits(): ShotHabits {
  const habits = { rollSaves: false, oneGo: false };
  try {
    const saved = JSON.parse(localStorage.getItem(HABITS_KEY) ?? "{}") as Partial<ShotHabits>;
    // The old "saves as they land" was on unless unticked, so it isn't carried over as a choice; the
    // old "Roll my saves for me" against the computer was ticked by hand, so it is.
    if (typeof saved.rollSaves === "boolean") habits.rollSaves = saved.rollSaves;
    else if (localStorage.getItem("open-battle:bot-rolls-mine") === "1") habits.rollSaves = true;
    if (typeof saved.oneGo === "boolean") habits.oneGo = saved.oneGo;
  } catch {
    // Private windows and blocked storage keep the defaults.
  }
  return habits;
}
export const useShotHabits = create<ShotHabits>(loadHabits);
export function setShotHabit(habit: Partial<ShotHabits>): void {
  useShotHabits.setState(habit);
  try {
    localStorage.setItem(HABITS_KEY, JSON.stringify(useShotHabits.getState()));
  } catch {
    // Kept for this visit only.
  }
}

export const useVolley = create<{ queue: Volley | null }>(() => ({ queue: null }));

/**
 * The unit's ranged weapons against the target: those that can fire now (models in range and in
 * sight, not used this phase), and those that can't, with why.
 */
export function volleyWeapons(
  game: GameState,
  attackerId: string,
  targetId: string,
): { id: string; name: string; inRange: number; why?: string }[] {
  const attacker = game.units[attackerId];
  if (!attacker) return [];
  return Object.values(attacker.sheet?.weapons ?? {}).flatMap((w) => {
    if (w.kind !== "ranged") return [];
    const base = { id: w.id, name: w.name };
    if (attacker.status?.[`fired.${w.id}`]) return [{ ...base, inRange: 0, why: t("used this phase") }];
    const s = suggestAttack(game, attackerId, w.id, targetId);
    if (!s || s.inRange === 0) return [{ ...base, inRange: 0, why: t("out of range") }];
    if (s.visible === 0) return [{ ...base, inRange: s.inRange, why: t("can't see it") }];
    return [{ ...base, inRange: s.inRange }];
  });
}

/** Declare the next weapon's attack; the volley ends when none is left or the target is gone. */
export function fireNext(): void {
  const q = useVolley.getState().queue;
  if (!q) return;
  const { game, dispatch } = useStore.getState();
  const target = game.units[q.targetId];
  const attacker = game.units[q.attackerId];
  let rest = q.weapons;
  while (rest.length && attacker && target && aliveModels(game, target).length) {
    const [next, ...more] = rest;
    rest = more;
    const s = suggestAttack(game, q.attackerId, next!, q.targetId);
    if (!s || s.inRange === 0) continue;
    // Kept with none left while the last one fires, so it reads "Weapon 3 of 3"; it ends when that's done.
    useVolley.setState({ queue: { ...q, weapons: more } });
    dispatch({ type: "attack/declare", spec: s.spec }, attacker.owner);
    return;
  }
  useVolley.setState({ queue: null });
}

// When one weapon's attack is done (cleared), the next one's is declared. Picking another unit ends the
// volley there (UX 509).
useStore.subscribe((s, prev) => {
  const q = useVolley.getState().queue;
  if (q && s.selected !== prev.selected && s.selected && s.selected !== q.attackerId)
    useVolley.setState({ queue: null });
  if (
    prev.game.attack &&
    !s.game.attack &&
    !s.game.procedure &&
    s.scrub === null &&
    useVolley.getState().queue
  )
    window.setTimeout(fireNext, 0);
});

// The defender hears what's coming, and how much of it is left: "Ana is shooting your Ember Kin with 3 weapons".
useVolley.subscribe((s, prev) => {
  const q = s.queue;
  const p = prev.queue;
  if (q && (!p || p.attackerId !== q.attackerId || p.weapons.length !== q.weapons.length))
    sendVolley(q.attackerId, q.targetId, q.total, q.weapons.length + 1);
  else if (!q && p) sendVolley(p.attackerId, p.targetId, p.total, 0);
});
