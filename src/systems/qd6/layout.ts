import type { Layout, TerrainPiece } from "../../core";
import { edgeZones, objective } from "../../missions/common";
import { makePiece } from "../wh40k/layout";

/** What the shared terrain templates count as in Quality d6. */
export const QD6_CATEGORIES: Record<string, string> = {
  Ruin: "cover",
  "Small ruin": "cover",
  "Tall ruin": "blocking",
  Container: "blocking",
  Woods: "difficult",
  Barricade: "cover",
  Crater: "difficult",
  Hill: "open",
};

/**
 * A point-symmetric 72" x 48" table: ruins, woods, a wall and a container on
 * each half, three objectives across the middle and deployment zones 12"
 * deep along the long edges.
 */
export function qd6Layout(width = 72, depth = 48): Layout {
  const half: [string, string, number, number, number][] = [
    ["a", "Ruin", -14, 6, 0],
    ["b", "Woods", 10, 8, 0.3],
    ["c", "Barricade", -4, 3, 0],
    ["d", "Container", 26, 2, Math.PI / 2],
    ["e", "Small ruin", -28, -4, 0.2],
  ];
  const terrain: TerrainPiece[] = [];
  for (const [id, name, x, y, f] of half) {
    const category = QD6_CATEGORIES[name];
    terrain.push(makePiece(name, `${id}1`, { x, y }, f, category));
    terrain.push(makePiece(name, `${id}2`, { x: -x, y: -y }, f + Math.PI, category));
  }
  return {
    terrain,
    objectives: [objective("o1", 0, 0), objective("o2", -width / 4, 0), objective("o3", width / 4, 0)],
    zones: edgeZones({ width, depth }, 12),
  };
}
