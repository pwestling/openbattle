import type { GameState } from "../../core/types";
import type { CodeProcedure, TurnHooks } from "../../sdk";

/**
 * Who goes first (#82): the roll-off before the battle picks round 1; after
 * that, the side that ran out of units to activate first in a round goes
 * first in the next. The module keeps `firstDone:<round>` (a seat) as each
 * round's activations end.
 */

const key = (round: number) => `firstDone:${round}`;

/** Whether a seat still has a unit on the table that hasn't gone this round. */
function unitsLeft(state: GameState, seat: number): boolean {
  return Object.values(state.units).some(
    (u) =>
      state.players[u.owner]?.seat === seat &&
      !u.status?.activated &&
      !u.status?.reserves &&
      u.modelIds.some((id) => state.models[id] && !state.models[id]!.destroyed),
  );
}

const activationEnd: CodeProcedure = function* (ctx, args) {
  const round = Number(args.round);
  const state = ctx.view.state;
  const seat = state.players[String(args.player ?? "")]?.seat;
  if (!Number.isFinite(round) || seat === undefined || ctx.view.own[key(round)] !== undefined) return;
  // The round already moved on: this side went last, so the other ran out first.
  if (ctx.view.round !== round) {
    yield ctx.set(key(round), (seat + 1) % 2);
    return;
  }
  if (!unitsLeft(state, seat)) yield ctx.set(key(round), seat);
};

const roundStart: CodeProcedure = function* (ctx, args) {
  const round = Number(args.round);
  const first = ctx.view.own[key(round - 1)];
  const state = ctx.view.state;
  if (round < 2 || typeof first !== "number" || state.turn.firstSeat === first) return;
  // Nothing done in the round yet: hand the first go over.
  if (Object.values(state.units).some((u) => u.status?.activated)) return;
  yield ctx.emit({ type: "turn/first", seat: first });
  const name = Object.values(state.players).find((p) => p.seat === first)?.name ?? `Player ${first + 1}`;
  yield ctx.note(`${name} finished first last round and goes first`);
};

export const initiativeHooks: TurnHooks = { activationEnd, roundStart };
