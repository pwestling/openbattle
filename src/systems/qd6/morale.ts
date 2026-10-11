import { maxWounds } from "../../core/attack";
import type { GameState, Unit } from "../../core/types";
import { systemOf } from "../../core/content/turn";
import type { Command, CodeProcedure, Ctx, GameView } from "../../sdk";
import { QD6_CONSTANTS } from "./system";

/**
 * Morale (#82), in our own words: a unit tests on its Quality, a natural 6
 * passing and a natural 1 failing. Fearless units that fail pass anyway on
 * a further roll of 4 or more. A unit that fails is Shaken; one that fails
 * after losing a fight while at half strength or below routs and is gone.
 * A Shaken unit that has to test again fails at once.
 *
 * Shooting tests when an attack leaves a unit at half strength or below
 * (`afterAttack`, started by the attack procedure); fights test the side
 * that caused fewer wounds (melee.ts).
 */

const alive = (state: GameState, u: Unit) =>
  u.modelIds.flatMap((id) => {
    const m = state.models[id];
    return m && !m.destroyed ? [m] : [];
  });

/**
 * At half strength or below: half of its models gone, or for a unit of one
 * model, half of its wounds.
 */
function atHalf(state: GameState, u: Unit): boolean {
  const left = alive(state, u);
  if (!left.length) return false;
  if (u.modelIds.length === 1) {
    const m = left[0]!;
    const w = maxWounds(m);
    return (w - (m.woundsLost ?? 0)) * 2 <= w;
  }
  return left.length * 2 <= u.modelIds.length;
}

/** The unit's wounds still standing, for telling whether an attack cost it anything. */
export function woundsLeft(state: GameState, u: Unit): number {
  return alive(state, u).reduce((n, m) => n + Math.max(0, maxWounds(m) - (m.woundsLost ?? 0)), 0);
}

/** One of the game's constants, as the system has it (a package may change them). */
export const constant = (view: GameView, id: keyof typeof QD6_CONSTANTS): number =>
  systemOf(view.state).constants?.[id] ?? QD6_CONSTANTS[id];

const hasRule = (view: GameView, unitId: string, rule: string): boolean => {
  const u = view.unit(unitId) as { rules?: { rule: string }[] } | undefined;
  return !!u?.rules?.some((r) => r.rule === rule);
};

const quality = (view: GameView, unitId: string): number => {
  const q = Number((view.unit(unitId) as { Q?: unknown } | undefined)?.Q);
  return Number.isFinite(q) && q > 0 ? q : 4;
};

/** A morale test: true when it is passed. A Shaken unit fails without rolling. */
export function* moraleTest(ctx: Ctx, unitId: string, why: string): Generator<Command, boolean, unknown> {
  const u = ctx.view.state.units[unitId];
  if (!u) return true;
  if (u.status?.shaken) {
    yield ctx.note(`${u.name} is already Shaken: the morale test (${why}) fails`);
    return false;
  }
  const q = quality(ctx.view, unitId);
  const roll = (yield ctx.roll("1d6", `morale ${q}+ (${why})`, unitId, q)) as { total: number };
  if (roll.total !== 1 && (roll.total === 6 || roll.total >= q)) return true;
  if (hasRule(ctx.view, unitId, "fearless")) {
    const need = constant(ctx.view, "fearless");
    const again = (yield ctx.roll("1d6", `Fearless ${need}+`, unitId, need)) as { total: number };
    if (again.total >= need) return true;
  }
  return false;
}

/** A failed test: Shaken, or routed (removed) after losing a fight at half strength. */
export function* failed(ctx: Ctx, unitId: string, fight: boolean): Generator<Command, void, unknown> {
  const state = ctx.view.state;
  const u = state.units[unitId];
  if (!u) return;
  if (fight && atHalf(state, u)) {
    yield ctx.note(`${u.name} routs`);
    for (const m of alive(state, u))
      yield ctx.emit({ type: "model/wounds", id: m.id, woundsLost: m.woundsLost ?? 0, destroyed: true });
    return;
  }
  if (!u.status?.shaken) {
    yield ctx.emit({ type: "unit/status", id: unitId, key: "shaken", value: true });
    yield ctx.note(`${u.name} is Shaken`);
  }
}

/**
 * After a shot's casualties are off: a unit left at half strength or below
 * by an attack that cost it wounds tests morale, unless already Shaken.
 */
const afterAttack: CodeProcedure = function* (ctx, args) {
  const unitId = String(args.unit ?? "");
  const u = ctx.view.state.units[unitId];
  if (!u || !alive(ctx.view.state, u).length || u.status?.shaken) return;
  // Only an attack that cost it something (Regeneration may have saved every wound).
  if (typeof args.before === "number" && woundsLeft(ctx.view.state, u) >= args.before) return;
  if (!atHalf(ctx.view.state, u)) return;
  if (yield* moraleTest(ctx, unitId, "half strength")) return;
  yield* failed(ctx, unitId, false);
};

export const moraleProcedures: Record<string, CodeProcedure> = { afterAttack };
