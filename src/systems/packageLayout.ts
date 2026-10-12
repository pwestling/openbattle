import type { Layout, TerrainPiece } from "../core";

/**
 * A package game's layout as the app takes it: missing lists empty.
 */
export function expandLayout(layout: unknown): Layout {
  const l = (layout ?? {}) as {
    terrain?: unknown[];
    objectives?: Layout["objectives"];
    zones?: Layout["zones"];
  };
  return {
    terrain: (l.terrain ?? []) as TerrainPiece[],
    objectives: l.objectives ?? [],
    zones: l.zones ?? [],
  };
}
