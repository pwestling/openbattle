import type { GameState, Unit } from "../../core/types";
import type { CodeAction, CodeProcedure, Command, Ctx, GameView, PureFn, RunResult } from "../../sdk";
import { opposed } from "../../core/teams";
import { constant, failed, moraleTest, woundsLeft } from "./morale";

/**
 * Melee (#82), in our own words. A unit that charged and made contact
 * fights one enemy it touches:
 *  1. Impact(X) hits on 2+ as the charge lands;
 *  2. it strikes with every melee weapon (all its models fight);
 *  3. the enemy strikes back with its own, unless the game turns that off;
 *  4. the side that caused fewer wounds tests morale (morale.ts), on a tie
 *     neither does.
 * After a unit's first fight in a round it is Fatigued: its later fights
 * that round hit only on natural 6s (the hit step reads it), as do a
 * Shaken unit's.
 */

const standing = (state: GameState, u: Unit | undefined) =>
  !!u && u.modelIds.some((id) => state.models[id] && !state.models[id]!.destroyed);

/** Enemy units within contact of this one. */
function inContact(view: GameView, unitId: string): Unit[] {
  const me = view.state.units[unitId];
  if (!me) return [];
  return view
    .engaged(unitId)
    .flatMap((id) => view.state.units[id] ?? [])
    .filter((u) => opposed(view.state, u.owner, me.owner) && standing(view.state, u));
}

/** The unit's melee weapons that someone alive carries. */
function meleeWeapons(state: GameState, unitId: string): string[] {
  const u = state.units[unitId];
  if (!u) return [];
  const carried = new Set(
    u.modelIds.flatMap((id) =>
      state.models[id] && !state.models[id]!.destroyed ? state.models[id]!.weapons : [],
    ),
  );
  return Object.values(u.sheet?.weapons ?? {})
    .filter((w) => w.kind === "melee" && carried.has(w.id))
    .map((w) => w.id);
}

/** Wounds an attack took off the table. */
const woundsIn = (r: RunResult): number =>
  r.outcomes.reduce((n, o) => n + (o.kind === "wounds" ? o.lost : 0), 0);

/** Every melee weapon of `from` at `to`: the wounds caused. */
function* strike(ctx: Ctx, from: string, to: string): Generator<Command, number, unknown> {
  let dealt = 0;
  for (const weapon of meleeWeapons(ctx.view.state, from)) {
    if (!standing(ctx.view.state, ctx.view.state.units[to])) break;
    const r = (yield ctx.run("attack", {
      attacker: from,
      weapon: { unit: from, weapon },
      target: to,
    })) as RunResult;
    dealt += woundsIn(r);
  }
  return dealt;
}

const fight: CodeProcedure = function* (ctx, args) {
  const unitId = String(args.unit ?? "");
  const targetId = String(args.target ?? "");
  const state = ctx.view.state;
  const me = state.units[unitId];
  const foe = state.units[targetId];
  if (!me || !foe) return;
  yield ctx.emit({ type: "unit/status", id: unitId, key: "fought", value: true });
  let dealt = 0;
  const unit = ctx.view.unit(unitId) as { Impact?: unknown } | undefined;
  if (me.status?.charging && Number(unit?.Impact ?? 0) > 0) {
    const r = (yield ctx.run("impact", { attacker: unitId, target: targetId })) as RunResult;
    dealt += woundsIn(r);
  }
  dealt += yield* strike(ctx, unitId, targetId);
  if (constant(ctx.view, "fatigue") > 0)
    yield ctx.emit({ type: "unit/status", id: unitId, key: "fatigued", value: true });
  let taken = 0;
  if (constant(ctx.view, "strikeBack") > 0 && standing(ctx.view.state, ctx.view.state.units[targetId])) {
    taken = yield* strike(ctx, targetId, unitId);
    if (constant(ctx.view, "fatigue") > 0)
      yield ctx.emit({ type: "unit/status", id: targetId, key: "fatigued", value: true });
  }
  yield ctx.note(`${me.name} caused ${dealt} wound${dealt === 1 ? "" : "s"}, ${foe.name} ${taken}`);
  // The fight as the round panel sums it up (ui/RoundPanel.tsx): who struck whom, and how it ended.
  const record = (morale: FightRecord["morale"], loser?: string) =>
    ctx.set("lastFight", {
      round: ctx.view.round,
      unit: unitId,
      unitName: me.name,
      foe: targetId,
      foeName: foe.name,
      dealt,
      taken,
      ...(loser ? { loser } : {}),
      morale,
    } satisfies FightRecord);
  if (dealt === taken) {
    yield record("tie");
    return;
  }
  const loser = dealt < taken ? unitId : targetId;
  if (!standing(ctx.view.state, ctx.view.state.units[loser])) {
    yield record("destroyed", loser);
    return;
  }
  if (yield* moraleTest(ctx, loser, "lost the fight")) {
    yield record("held", loser);
    return;
  }
  yield* failed(ctx, loser, true);
  yield record(standing(ctx.view.state, ctx.view.state.units[loser]) ? "shaken" : "routed", loser);
};

/** The last fight, kept in the module's state as `lastFight`. */
export interface FightRecord {
  round: number;
  unit: string;
  unitName: string;
  foe: string;
  foeName: string;
  /** Wounds the charging unit caused, and took from the strike-back. */
  dealt: number;
  taken: number;
  /** The side that caused fewer wounds. */
  loser?: string;
  /** A tie tests no one; else the loser was destroyed, held, or failed and is Shaken or routed. */
  morale: "tie" | "destroyed" | "held" | "shaken" | "routed";
}

export const meleeActions: CodeAction[] = [
  {
    id: "fight",
    name: "Fight",
    by: "unit",
    available: (view, actor) => {
      const u = view.state.units[actor.unitId ?? ""];
      if (!u?.status?.acting) return "Only in its activation";
      if (!u.status.charging) return "Only after a Charge";
      if (u.status.fought) return "Already fought";
      return inContact(view, u.id).length ? true : "Not in contact with an enemy";
    },
    targets: (view, actor) =>
      inContact(view, actor.unitId ?? "").map((u) => ({ unitId: u.id, label: u.name })),
    run: fight,
  },
];

/** Pure functions the rules data calls. */
export const meleeFunctions: Record<string, PureFn> = {
  /** In contact with an enemy. */
  engaged: (view, id) => inContact(view, String(id)).length > 0,
  /** The gap to the nearest enemy unit on the table, in inches (Infinity with none). */
  enemyGap: (view, id) => {
    const me = view.state.units[String(id)];
    if (!me) return Infinity;
    let best = Infinity;
    for (const u of Object.values(view.state.units))
      if (opposed(view.state, u.owner, me.owner) && standing(view.state, u) && !u.status?.reserves)
        best = Math.min(best, view.distance(me.id, u.id));
    return best;
  },
  /** Its wounds still standing (morale after a shot reads it before and after). */
  woundsLeft: (view, id) => {
    const u = view.state.units[String(id)];
    return u ? woundsLeft(view.state, u) : 0;
  },
};
