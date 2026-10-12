import { rotate } from "./geometry";
import type { Vec2 } from "./types";

/**
 * Rigidly move a group of positions: rotate them by `turn` around `pivot`,
 * then translate by `delta`. Used for whole-unit moves, wheels and pivots.
 */
export function transformPositions(positions: Vec2[], pivot: Vec2, turn: number, delta: Vec2): Vec2[] {
  return positions.map((p) => {
    const r = rotate({ x: p.x - pivot.x, y: p.y - pivot.y }, turn);
    return { x: pivot.x + r.x + delta.x, y: pivot.y + r.y + delta.y };
  });
}
