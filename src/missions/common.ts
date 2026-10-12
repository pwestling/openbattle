import type { GameState, Objective, Unit, Vec2, Zone } from "../core";

/** Helpers for writing missions: zones along the table edges, who holds an objective, what has fallen. */

/** Seat 0 deploys along the +y edge, seat 1 along the -y edge, `deep` inches in. */
export function edgeZones(table: { width: number; depth: number }, deep: number): Zone[] {
  const hx = table.width / 2;
  const hy = table.depth / 2;
  const strip = (seat: number, y0: number, y1: number): Zone => ({
    seat,
    points: [
      { x: -hx, y: y0 },
      { x: hx, y: y0 },
      { x: hx, y: y1 },
      { x: -hx, y: y1 },
    ],
  });
  return [strip(0, hy - deep, hy), strip(1, -hy, -(hy - deep))];
}

export function objective(id: string, x: number, y: number): Objective {
  return { id, position: { x, y } };
}

export const seatOf = (game: GameState, player: string) => game.players[player]?.seat;

export function inside(p: Vec2, zone: Zone): boolean {
  let hit = false;
  const pts = zone.points;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i]!;
    const b = pts[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) hit = !hit;
  }
  return hit;
}

/** Units of other seats than `seat`. */
export const enemyUnits = (game: GameState, seat: number) =>
  Object.values(game.units).filter((u) => {
    const s = seatOf(game, u.owner);
    return s !== undefined && s !== seat;
  });

export const destroyed = (game: GameState, u: Unit) =>
  u.modelIds.length > 0 && u.modelIds.every((id) => game.models[id]?.destroyed);

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
