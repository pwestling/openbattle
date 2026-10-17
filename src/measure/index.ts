// Measure: distances, floors and line of sight. Realizes design/surfaces/measure.html.
// Measure knows no other module, so it names only the parts of a table it reads.
// The record's Table has this shape, so the screen hands one straight in.

import { measure } from "./distance.ts";
import { floorsOf } from "./floors.ts";
import { sightOf } from "./sight.ts";

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
      /** The body: a mesh named by its file's fingerprint, or a stand-in of this height in inches. */
      mesh?: string;
      height: number;
    }
  >;
  terrain: Record<
    string,
    {
      position: Point;
      facing: number;
      floors: Floor[];
      shape: { kind: "box" | "cylinder" | "ramp" | "mesh"; width: number; depth: number; height: number };
    }
  >;
}

/** A point in inches, a model, or a unit (its closest model). */
export type Spot = Point | { model: string } | { unit: string };

/**
 * Triangles in the mesh's own units, as three.js reads them: +y is up, corners run anticlockwise seen
 * from outside, mesh x is the piece's width and mesh -z its depth. size says how big the piece is on
 * the table, in inches.
 */
export interface Mesh {
  positions: Float32Array;
  indices?: Uint32Array;
}

/** up is how far the base at the to end stands above the base at the from end; negative when below. */
export function distance(table: TableShape, from: Spot, to: Spot, via?: Point[]): { across: number; up: number } {
  return measure(table, from, to, via);
}

export function floors(mesh: Mesh, size: { width: number; depth: number; height: number }): Floor[] {
  return floorsOf(mesh, size);
}

/** A point on the table in inches, z above the table top (0 when left out), or a model. */
export type SightTarget = { model: string } | { x: number; y: number; z?: number };

/** A point in inches, with its height above the table top. */
export interface Point3 {
  x: number;
  y: number;
  z: number;
}

export interface Sight {
  /** How much of the target some part of the looker can see, from 0 to 1, to a hundredth. */
  seen: number;
  /** The pieces in the way of the parts of the target the looker can't see, by id. */
  hiddenBy: string[];
  /** One clear sight line, from the looker to the target, when anything is seen. */
  line: [Point3, Point3] | null;
}

/**
 * Line of sight from a model to a model or a point. bodies holds, by piece id, the mesh of every model
 * and terrain piece that has one, read from its file; ignore lists pieces that don't count as in the way.
 */
export function sight(table: TableShape, bodies: Record<string, Mesh>, from: { model: string }, to: SightTarget, ignore?: string[]): Sight {
  return sightOf(table, bodies, from, to, ignore);
}
