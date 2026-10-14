import type { GameView } from "../sdk";
import { cardsIn } from "./cards";
import { baseToBaseDistance } from "./geometry";
import { immutable } from "./immutable";
import { geometryView } from "./los";
import { modsOn, quantity } from "./quantity";
import type { EntityRef, GameState, Json, Model, Token } from "./types";

/** Read-only access to the game for module code. */
export function gameView(state: GameState, module: string): GameView {
  immutable(state);
  const geometry = geometryView(state);
  /** Physical members of a unit, a model, or a token (point unless it has a base). */
  const modelsOf = (id: string): Array<Model | Token> => {
    const unit = state.units[id];
    if (unit)
      return unit.modelIds.flatMap((m) =>
        state.models[m] && !state.models[m]!.off ? [state.models[m]!] : [],
      );
    const model = state.models[id];
    if (model) return model.off ? [] : [model];
    const token = state.tokens[id];
    return token ? [token] : [];
  };
  const centre = (models: Array<Model | Token>) => ({
    x: models.reduce((a, m) => a + m.position.x, 0) / Math.max(1, models.length),
    y: models.reduce((a, m) => a + m.position.y, 0) / Math.max(1, models.length),
  });
  const view: GameView = {
    state,
    pointer: state.pointer,
    q: (ref: EntityRef, key: string, fallback = 0) => quantity(state, ref, key, fallback),
    mods: (ref?: EntityRef) =>
      immutable(
        ref ? modsOn(state, ref) : state.mods.filter((m) => modsOn(state, m.target, m.q).includes(m)),
      ),
    until: (field: string) => immutable({ field, is: (state.pointer[field] ?? null) as Json }),
    units: (player) =>
      immutable(
        Object.values(state.units).filter(
          (u) => (!player || u.owner === player) && modelsOf(u.id).length > 0,
        ),
      ),
    cards: (collection, player = null) => immutable(cardsIn(state, collection, player)),
    distance: (a, b) => {
      let d = Infinity;
      for (const x of modelsOf(a)) for (const y of modelsOf(b)) d = Math.min(d, baseToBaseDistance(x, y));
      return Math.round(d * 1e4) / 1e4;
    },
    geometry: {
      ...geometry,
      segment: (...args) => immutable(geometry.segment(...args)),
      segment2D: (...args) => immutable(geometry.segment2D(...args)),
      sample: (...args) => immutable(geometry.sample(...args)),
    },
    angle: (of, other) => {
      const me = modelsOf(of);
      const them = modelsOf(other);
      if (!me.length || !them.length) return 0;
      const a = centre(me);
      const b = centre(them);
      const bearing = Math.atan2(b.x - a.x, b.y - a.y);
      let rel = bearing - (me[0]!.facing ?? 0);
      while (rel > Math.PI) rel -= Math.PI * 2;
      while (rel <= -Math.PI) rel += Math.PI * 2;
      return Math.round(((rel * 180) / Math.PI) * 100) / 100;
    },
    own: state.modules?.[module] ?? {},
  };
  return immutable(view);
}
