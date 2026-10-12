import type { GameView } from "../sdk";
import { baseToBaseDistance } from "./geometry";
import { modelSight } from "./los";
import { modsOn, quantity } from "./quantity";
import type { EntityRef, GameState, Json, Model } from "./types";

/** Read-only access to the game for module code. */
export function gameView(state: GameState, module: string): GameView {
  /** The models an id stands for: a unit's, the model itself, or a token as a point. */
  const modelsOf = (id: string): Model[] => {
    const unit = state.units[id];
    if (unit)
      return unit.modelIds.flatMap((m) =>
        state.models[m] && !state.models[m]!.off ? [state.models[m]!] : [],
      );
    const model = state.models[id];
    if (model) return model.off ? [] : [model];
    const token = state.tokens[id];
    if (!token) return [];
    return [
      {
        id: token.id,
        owner: token.owner ?? "",
        label: token.label ?? token.kind,
        position: token.position,
        facing: token.facing ?? 0,
        base: { shape: "round", diameterMm: 1 },
        ...(token.z === undefined ? {} : { z: token.z }),
      },
    ];
  };
  const best = (from: string, to: string) => {
    let seen = { visible: false, fully: false, fraction: 0, obscuredBy: [] as string[] };
    const hidden = new Set<string>();
    const targets = modelsOf(to);
    const targetIds = new Set(targets.map((m) => m.id));
    for (const o of modelsOf(from))
      for (const t of targets) {
        const s = modelSight(state, o, t, { ignore: targetIds });
        for (const piece of s.obscuredBy) hidden.add(piece.id);
        if (s.fraction >= seen.fraction)
          seen = { visible: s.visible, fully: s.fully, fraction: s.fraction, obscuredBy: [] };
      }
    seen.obscuredBy = [...hidden];
    return seen;
  };
  const centre = (models: Model[]) => ({
    x: models.reduce((a, m) => a + m.position.x, 0) / Math.max(1, models.length),
    y: models.reduce((a, m) => a + m.position.y, 0) / Math.max(1, models.length),
  });
  return {
    state,
    pointer: state.pointer,
    q: (ref: EntityRef, key: string, fallback = 0) => quantity(state, ref, key, fallback),
    mods: (ref?: EntityRef) =>
      ref ? modsOn(state, ref) : state.mods.filter((m) => modsOn(state, m.target, m.q).includes(m)),
    until: (field: string) => ({ field, is: (state.pointer[field] ?? null) as Json }),
    units: (player) =>
      Object.values(state.units).filter((u) => (!player || u.owner === player) && modelsOf(u.id).length > 0),
    distance: (a, b) => {
      let d = Infinity;
      for (const x of modelsOf(a)) for (const y of modelsOf(b)) d = Math.min(d, baseToBaseDistance(x, y));
      return Math.round(d * 1e4) / 1e4;
    },
    visible: (from, to) => best(from, to).visible,
    sight: (from, to) => best(from, to),
    angle: (of, other) => {
      const me = modelsOf(of);
      const them = modelsOf(other);
      if (!me.length || !them.length) return 0;
      const a = centre(me);
      const b = centre(them);
      const bearing = Math.atan2(b.x - a.x, b.y - a.y);
      let rel = bearing - me[0]!.facing;
      while (rel > Math.PI) rel -= Math.PI * 2;
      while (rel <= -Math.PI) rel += Math.PI * 2;
      return Math.round(((rel * 180) / Math.PI) * 100) / 100;
    },
    own: state.modules?.[module] ?? {},
  };
}
