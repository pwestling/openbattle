import { isAlive } from "../units";
import type { ArmyStratagem, GameState, PlayerActionUse, PlayerId, UnitId } from "../types";
import { actingUnits, costLabel, evalCtx, pay, payFor, safeBool, setStatus, type Payment } from "./play";
import { hasKeywordPhrase, unitView, type UnitView } from "./runtime";
import type { ActionDef } from "./schema";
import { currentSlot, endActivation, systemOf } from "./turn";
import { sharedPhase } from "./simultaneous";

/**
 * Player-level play: actions a player takes rather than a unit (40k
 * stratagems, spending command points), and reminders of the imported
 * abilities the engine doesn't automate, put in front of players when their
 * text says they matter.
 */

interface PlayerActionOption {
  def: ActionDef;
  ok: boolean;
  why?: string;
  cost: string;
  payment: Payment[];
  /** Units it may target, when it targets one. */
  targets?: UnitId[];
}

/** A stratagem as taken: what it cost and what it was used on. */
export interface PlayerActionTaken {
  player: PlayerId;
  action: string;
  payment: Payment[];
  targetId?: UnitId;
  /** For a custom action: the name the player gave it. */
  label?: string;
  /** Used anyway, against the rules' word (why not); shown to everyone. */
  forced?: string;
}

function seatOf(state: GameState, player: PlayerId): number | undefined {
  return state.players[player]?.seat;
}

/** Earlier uses of an action that count against its limit now. */
function usesInWindow(state: GameState, player: PlayerId, def: ActionDef): PlayerActionUse[] {
  const per = def.limit?.per ?? "phase";
  const { round, phase, activeSeat } = state.turn;
  return (state.used?.[player] ?? []).filter(
    (u) =>
      u.action === def.id &&
      (per === "battle" ||
        (u.round === round &&
          (per === "round" || (u.seat === activeSeat && (per === "turn" || u.phase === phase))))),
  );
}

function playerScope(state: GameState, player: PlayerId) {
  const seat = seatOf(state, player);
  return { id: player, seat, active: seat === state.turn.activeSeat || sharedPhase(state) };
}

const ARMY = /^army:(.+):([^:]+)$/;

/** A faction stratagem from the player's roster (#49), as a player action. */
function armyAction(player: PlayerId, s: ArmyStratagem): ActionDef {
  return {
    id: `army:${player}:${s.id}`,
    name: s.name,
    by: "player",
    side: s.side,
    ...(s.phases?.length ? { phases: s.phases } : {}),
    cost: [{ resource: "CP", amount: s.cp }],
    limit: { count: 1, per: s.once ?? "phase" },
    ...(s.targetsUnit ? { target: { filter: { same: ["it.owner", "player.id"] } } } : {}),
    // On the unit for the phase: it runs when automated, and is a reminder on its attacks when not (UX 370).
    ...(s.targetsUnit ? { do: [{ do: "applyStatus", status: `strat.${s.id}` }] } : {}),
    ...(s.effect || s.text ? { hint: s.effect ?? s.text } : {}),
    ...(s.reacts?.length ? { reacts: s.reacts.map((window) => ({ window })) } : {}),
  };
}

/** The player actions a player has: the system's, then their army's own stratagems. */
function playerActionDefs(state: GameState, player: PlayerId): ActionDef[] {
  const own = (state.armies?.[player]?.stratagems ?? []).map((s) => armyAction(player, s));
  return [...systemOf(state).actions.filter((a) => a.by === "player"), ...own];
}

/** The faction stratagem behind an action id, if it is one. */
export function armyStratagem(state: GameState, id: string): ArmyStratagem | undefined {
  const army = ARMY.exec(id);
  return army ? state.armies?.[army[1]!]?.stratagems.find((x) => x.id === army[2]) : undefined;
}

/** Any action by id, a faction stratagem's included. */
function findAction(state: GameState, id: string): ActionDef | undefined {
  const army = ARMY.exec(id);
  if (army) {
    const s = state.armies?.[army[1]!]?.stratagems.find((x) => x.id === army[2]);
    return s && armyAction(army[1]!, s);
  }
  return systemOf(state).actions.find((a) => a.id === id);
}

/** The player actions (stratagems) a player could use now, with why not. */
export function playerActions(
  state: GameState,
  player: PlayerId,
  /**
   * For reaction windows: `only` these actions (the rest aren't checked), units
   * that also `fit` the window, and with `first`, one unit is enough.
   */
  opts: {
    only?: (def: ActionDef) => boolean;
    fits?: (def: ActionDef, unit: UnitId, it: UnitView) => boolean;
    first?: boolean;
  } = {},
): PlayerActionOption[] {
  const system = systemOf(state);
  const slot = currentSlot(state);
  const me = playerScope(state, player);
  const out: PlayerActionOption[] = [];
  for (const def of playerActionDefs(state, player)) {
    if (def.by !== "player") continue;
    if (opts.only && !opts.only(def)) continue;
    const ctx = evalCtx(state, system, { player: me, turn: { round: state.turn.round } });
    const why = ((): string | undefined => {
      if (!slot || state.turn.round === 0) return "Once the battle starts";
      if (def.phases && !def.phases.includes(slot.id)) return "Not in this phase";
      if (def.side === "active" && !me.active) return "Only in your turn";
      if (def.side === "inactive" && me.active) return "Only in your opponent's turn";
      if (def.endsTurn && (actingUnits(state).length || state.pending))
        return "Finish the current activation first";
      if (def.limit && usesInWindow(state, player, def).length >= def.limit.count)
        return `Already used this ${def.limit.per}`;
      const ruled = def.notWhen?.find((n) => safeBool(n.if, ctx));
      if (ruled) return ruled.why;
      if (def.if !== undefined && !safeBool(def.if, ctx)) return "Not allowed now";
      return undefined;
    })();
    const paid = payFor(state, system, player, def, ctx);
    const option: PlayerActionOption = {
      def,
      ok: !why && !("why" in paid),
      // The price shows even when it can't be paid (UX 303).
      cost: "label" in paid ? paid.label : costLabel(system, def, ctx),
      payment: "payment" in paid ? paid.payment : [],
      ...(why || "why" in paid ? { why: why ?? (paid as { why: string }).why } : {}),
    };
    if (def.target) {
      const army = armyStratagem(state, def.id);
      option.targets = [];
      for (const u of Object.values(state.units)) {
        if (
          army?.targetKeywords &&
          !army.targetKeywords.split(/\s+or\s+/i).some((k) => hasKeywordPhrase(u, k))
        )
          continue;
        if (army?.notYet && u.status?.[army.notYet]) continue;
        // A unit with no models left is never a target: skip building its view.
        if (!isAlive(state, u)) continue;
        const it = unitView(state, system, u);
        if (!it.models.length || !safeBool(def.target.filter, { ...ctx, scope: { ...ctx.scope, it } }))
          continue;
        if (opts.fits && !opts.fits(def, u.id, it)) continue;
        option.targets.push(u.id);
        if (opts.first) break;
      }
      if (option.ok && !option.targets.length) {
        option.ok = false;
        option.why = "No eligible unit";
      }
    }
    out.push(option);
  }
  return out;
}

/** Note that a player used something now (a stratagem, a pool re-roll), for limits. */
export function recordUse(state: GameState, player: PlayerId, action: string): GameState {
  const use: PlayerActionUse = {
    action,
    round: state.turn.round,
    phase: state.turn.phase,
    seat: state.turn.activeSeat,
  };
  return { ...state, used: { ...state.used, [player]: [...(state.used?.[player] ?? []), use] } };
}

/** Where a player stands with a re-roll-once pool this round: re-rolled, ready, or neither. */
export function poolUsed(state: GameState, player: PlayerId, resource: string): "ready" | "rerolled" | null {
  const mine = (state.used?.[player] ?? []).filter((u) => u.round === state.turn.round);
  if (mine.some((u) => u.action === `ready:${resource}`)) return "ready";
  if (mine.some((u) => u.action === `reroll:${resource}`)) return "rerolled";
  return null;
}

/** Fold a used player action into the state: pay, count it, apply its statuses. */
export function applyPlayerAction(state: GameState, ev: PlayerActionTaken): GameState {
  const def = findAction(state, ev.action);
  const seat = seatOf(state, ev.player);
  if (!def || seat === undefined) return state;
  let next = pay(state, ev.player, ev.payment);
  const use: PlayerActionUse = {
    action: def.id,
    round: state.turn.round,
    phase: state.turn.phase,
    seat: state.turn.activeSeat,
  };
  next = { ...next, used: { ...next.used, [ev.player]: [...(next.used?.[ev.player] ?? []), use] } };
  const target = ev.targetId ? next.units[ev.targetId] : undefined;
  for (const a of def.do ?? []) {
    if (!target) break;
    if (a.do === "applyStatus") next = setStatus(next, target.id, { [a.status]: true });
    if (a.do === "removeStatus") next = setStatus(next, target.id, { [a.status]: null });
    if (a.do === "setFlag") next = setStatus(next, target.id, { [a.flag]: a.value });
  }
  // Instead of an activation: the other side goes next (UX 263).
  return def.endsTurn ? endActivation(next) : next;
}

// ---------------------------------------------------------------------------
// Ability reminders
// ---------------------------------------------------------------------------

export const appliedKey = (ability: string) => `applied.${ability}`;
