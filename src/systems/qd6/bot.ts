import type { GameState, Unit } from "../../core/types";
import { unitView } from "../../core/content/runtime";
import { systemOf } from "../../core/content/turn";
import type { BotTuning } from "../../sdk";

/**
 * How the computer weighs a Quality d6 table (#82), on top of its usual
 * judgement: a Shaken unit is worth a share less (it must spend a go
 * rallying and holds nothing), and a unit moves as its Move (Fast, Slow)
 * says.
 */

/** The share of a unit's worth a side loses while it is Shaken. */
const SHAKEN = 0.3;

const worth = (u: Unit) => u.sheet?.points ?? 50;

const standing = (state: GameState, u: Unit) =>
  u.modelIds.some((id) => state.models[id] && !state.models[id]!.destroyed);

export const qd6Bot: BotTuning = {
  moveInches: (state, unit) => {
    const m = Number(unitView(state, systemOf(state), unit).M);
    return Number.isFinite(m) && m > 0 ? m : 6;
  },
  evaluate: (state, seat) => {
    // In the judge's units: a whole army is worth about holding every objective for the battle.
    const rounds = Number(systemOf(state).turn.rounds) || 4;
    const armyVp = Math.max(6, rounds * Math.max(1, state.objectives.length) * 1.5);
    const armies: Record<number, number> = {};
    for (const u of Object.values(state.units)) {
      const s = state.players[u.owner]?.seat;
      if (s !== undefined) armies[s] = (armies[s] ?? 0) + worth(u);
    }
    let v = 0;
    for (const u of Object.values(state.units)) {
      const s = state.players[u.owner]?.seat;
      if (s === undefined || !u.status?.shaken || !standing(state, u)) continue;
      v += (s === seat ? -1 : 1) * SHAKEN * (worth(u) / (armies[s] || 1)) * armyVp;
    }
    return v;
  },
};
