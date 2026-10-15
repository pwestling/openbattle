// Measure: distances and floors. Realizes design/surfaces/measure.html.
// Measure knows no other module, so it names only the parts of a table it reads.
// The record's Table has this shape, so the screen hands one straight in.

import { measure } from "./distance.ts";

export interface Point {
  x: number;
  y: number;
}

export interface Floor {
  height: number;
  outline: Point[];
}

export interface TableShape {
  models: Record<
    string,
    {
      unit: string;
      base: { shape: "round" | "oval" | "rect"; width: number; depth: number };
      position: Point;
      facing: number;
      floor: { terrain: string; floor: number } | null;
      aside: boolean;
    }
  >;
  terrain: Record<string, { position: Point; facing: number; floors: Floor[] }>;
}

/** A point in inches, a model, or a unit (its closest model). */
export type Spot = Point | { model: string } | { unit: string };

/** Triangles in the mesh's own units; size says how big the piece is on the table, in inches. */
export interface Mesh {
  positions: Float32Array;
  indices?: Uint32Array;
}

const notYet = (op: string): never => {
  throw new Error(`measure.${op} is not built yet`);
};

/** up is how far the base at the to end stands above the base at the from end; negative when below. */
export function distance(table: TableShape, from: Spot, to: Spot, via?: Point[]): { across: number; up: number } {
  return measure(table, from, to, via);
}

export function floors(mesh: Mesh, size: { width: number; depth: number; height: number }): Floor[] {
  return notYet("floors");
}
