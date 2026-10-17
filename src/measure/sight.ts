// Line of sight: from any part of one model's body to any part of another's, past every other body
// on the table. Bodies are triangles in inches: a model's mesh or stand-in standing on its base, and
// a terrain piece's mesh or simple solid. Bases are not bodies. Only adding, multiplying, dividing and
// square roots, which give the same results in every browser; turns use turnOf, not Math.cos.
import { turnOf } from "./distance.ts";
import type { Mesh, Point, Sight, SightTarget, Standing, TableShape } from "./index.ts";

const mmPerInch = 25.4;
/** How thick a base is, in inches: a model's body stands on top of it, as the screen draws it. */
const baseThickness = 0.12;
/** Each body is judged from at most this many cells a side of its box: one point in each cell its surface passes through. */
const cellsPerSide = 6;
/** A body's own surface is not in the way: crossings this close to either end of a line are ignored. */
const ends = 1e-6;
/** A point on a surface, such as a spot on a roof, is not hidden by that surface: crossings this close to it (inches) are ignored. */
const onSurface = 0.01;

type Vec = [number, number, number];

/** A body in its own inches (x across, y ahead, z up, centred across and standing on 0), ready to be looked through. */
interface Shape {
  /** Every triangle's nine corner coordinates, one after another. */
  corners: Float64Array;
  tree: Node;
  /** Points spread evenly over the surface, where sight lines start and end. */
  points: Vec[];
  low: Vec;
  high: Vec;
}

interface Node {
  low: Vec;
  high: Vec;
  /** The triangles of a leaf; empty for a branch. */
  triangles: number[];
  left?: Node;
  right?: Node;
}

/** A body placed on the table: its shape, turned and moved, raised to the floor it stands on. */
interface Placed {
  id: string;
  shape: Shape;
  x: number;
  y: number;
  z: number;
  cos: number;
  sin: number;
  low: Vec;
  high: Vec;
}

const own = <T>(record: Record<string, T>, id: string): T | undefined => (Object.hasOwn(record, id) ? record[id] : undefined);

// ---- Shapes ----------------------------------------------------------------------------------

/** Triangles on a ring of corners, an ellipse w wide and d deep, at heights z0 and z1, with ends. */
function prism(sides: number, w0: number, d0: number, w1: number, d1: number, z0: number, z1: number): number[] {
  const out: number[] = [];
  const ring = Array.from({ length: sides }, (_, i) => turnOf((360 * i) / sides));
  for (let i = 0; i < sides; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % sides]!;
    const p0: Vec = [(w0 / 2) * a.cos, (d0 / 2) * a.sin, z0];
    const q0: Vec = [(w0 / 2) * b.cos, (d0 / 2) * b.sin, z0];
    const p1: Vec = [(w1 / 2) * a.cos, (d1 / 2) * a.sin, z1];
    const q1: Vec = [(w1 / 2) * b.cos, (d1 / 2) * b.sin, z1];
    out.push(...p0, ...q0, ...q1, ...p0, ...q1, ...p1, 0, 0, z0, ...q0, ...p0, 0, 0, z1, ...p1, ...q1);
  }
  return out;
}

function box(w: number, d: number, h: number): number[] {
  const [x, y] = [w / 2, d / 2];
  const c: Vec[] = [
    [-x, -y, 0], [x, -y, 0], [x, y, 0], [-x, y, 0],
    [-x, -y, h], [x, -y, h], [x, y, h], [-x, y, h],
  ];
  const faces = [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]];
  return faces.flatMap(([a, b, e, f]) => [...c[a!]!, ...c[b!]!, ...c[e!]!, ...c[a!]!, ...c[e!]!, ...c[f!]!]);
}

/** A ramp: low at the back (-y), rising to its full height at the front (+y), as the screen draws it. */
function ramp(w: number, d: number, h: number): number[] {
  const [x, y] = [w / 2, d / 2];
  const c: Vec[] = [[-x, -y, 0], [x, -y, 0], [x, y, 0], [-x, y, 0], [x, y, h], [-x, y, h]];
  const quads = [[0, 1, 2, 3], [3, 2, 4, 5], [0, 1, 4, 5]];
  const sides = [[0, 3, 5], [1, 2, 4]];
  return [
    ...quads.flatMap(([a, b, e, f]) => [...c[a!]!, ...c[b!]!, ...c[e!]!, ...c[a!]!, ...c[e!]!, ...c[f!]!]),
    ...sides.flatMap(([a, b, e]) => [...c[a!]!, ...c[b!]!, ...c[e!]!]),
  ];
}

/** A mesh's triangles in the piece's own inches: x across, y ahead (mesh -z), z up (mesh y), scaled by s. */
function meshCorners(mesh: Mesh, fit: (low: Vec, high: Vec) => Vec): number[] {
  const raw = mesh.positions;
  const count = raw.length / 3;
  const low: Vec = [Infinity, Infinity, Infinity];
  const high: Vec = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < count; i++) {
    for (let a = 0; a < 3; a++) {
      low[a] = Math.min(low[a]!, raw[i * 3 + a]!);
      high[a] = Math.max(high[a]!, raw[i * 3 + a]!);
    }
  }
  const [sx, sy, sz] = fit(low, high);
  const mx = (low[0] + high[0]) / 2;
  const mz = (low[2] + high[2]) / 2;
  const corners = mesh.indices ? mesh.indices.length : count;
  const out: number[] = [];
  for (let i = 0; i + 2 < corners; i += 3) {
    for (let k = 0; k < 3; k++) {
      const j = mesh.indices ? mesh.indices[i + k]! : i + k;
      out.push((raw[j * 3]! - mx) * sx, -(raw[j * 3 + 2]! - mz) * sz, (raw[j * 3 + 1]! - low[1]) * sy);
    }
  }
  return out;
}

const stretch = (low: Vec, high: Vec, size: { width: number; depth: number; height: number }): Vec => {
  const s = (a: number, to: number) => (high[a]! > low[a]! ? to / (high[a]! - low[a]!) : 1);
  return [s(0, size.width), s(1, size.height), s(2, size.depth)];
};

const shapes = new Map<string, Shape>();
const meshShapes = new WeakMap<Mesh, Map<string, Shape>>();

function cached(key: string, make: () => number[], mesh?: Mesh): Shape {
  const store = mesh ? (meshShapes.get(mesh) ?? meshShapes.set(mesh, new Map()).get(mesh)!) : shapes;
  let shape = store.get(key);
  if (!shape) {
    shape = shapeOf(make());
    store.set(key, shape);
  }
  return shape;
}

/** A model's body: its mesh scaled evenly to its height, or a stand-in, standing on its base. */
function modelShape(model: TableShape["models"][string], mesh: Mesh | undefined): Shape {
  const h = model.height;
  if (mesh) {
    return cached(`model ${h}`, () => meshCorners(mesh, (low, high) => {
      const k = high[1] > low[1] ? h / (high[1] - low[1]) : 1;
      return [k, k, k];
    }), mesh);
  }
  // The stand-in the screen draws: a tapering post three tenths of the base's narrower side across.
  const r = (Math.min(model.base.width, model.base.depth) / mmPerInch) * 0.3;
  return cached(`stand-in ${r} ${h}`, () => prism(20, 2 * r, 2 * r, 1.5 * r, 1.5 * r, 0, h));
}

function terrainShape(terrain: TableShape["terrain"][string], mesh: Mesh | undefined): Shape {
  const s = terrain.shape;
  const size = `${s.width} ${s.depth} ${s.height}`;
  if (s.kind === "mesh") return cached(`terrain ${size}`, () => meshCorners(mesh!, (low, high) => stretch(low, high, s)), mesh);
  if (s.kind === "box") return cached(`box ${size}`, () => box(s.width, s.depth, s.height));
  if (s.kind === "cylinder") return cached(`cylinder ${size}`, () => prism(48, s.width, s.depth, s.width, s.depth, 0, s.height));
  return cached(`ramp ${size}`, () => ramp(s.width, s.depth, s.height));
}

// ---- Building a shape: its tree of boxes and its points ------------------------------------

function shapeOf(list: number[]): Shape {
  const corners = Float64Array.from(list);
  const count = corners.length / 9;
  const all = Array.from({ length: count }, (_, i) => i);
  const tree = build(corners, all);
  return { corners, tree, points: spread(corners, tree.low, tree.high), low: tree.low, high: tree.high };
}

function bounds(corners: Float64Array, triangles: number[]): { low: Vec; high: Vec } {
  const low: Vec = [Infinity, Infinity, Infinity];
  const high: Vec = [-Infinity, -Infinity, -Infinity];
  for (const t of triangles) {
    for (let k = 0; k < 3; k++) {
      for (let a = 0; a < 3; a++) {
        const v = corners[t * 9 + k * 3 + a]!;
        if (v < low[a]!) low[a] = v;
        if (v > high[a]!) high[a] = v;
      }
    }
  }
  if (triangles.length === 0) return { low: [0, 0, 0], high: [0, 0, 0] };
  return { low, high };
}

/** A tree of boxes around the triangles, split down the middle of the longest side, so a line meets few of them. */
function build(corners: Float64Array, triangles: number[]): Node {
  const { low, high } = bounds(corners, triangles);
  if (triangles.length <= 4) return { low, high, triangles };
  const extent = [high[0] - low[0], high[1] - low[1], high[2] - low[2]];
  const axis = extent[0]! >= extent[1]! && extent[0]! >= extent[2]! ? 0 : extent[1]! >= extent[2]! ? 1 : 2;
  const centre = (t: number) => corners[t * 9 + axis]! + corners[t * 9 + 3 + axis]! + corners[t * 9 + 6 + axis]!;
  const sorted = [...triangles].sort((a, b) => centre(a) - centre(b) || a - b);
  const half = sorted.length >> 1;
  return { low, high, triangles: [], left: build(corners, sorted.slice(0, half)), right: build(corners, sorted.slice(half)) };
}

/**
 * Points spread evenly over a surface: each triangle is dotted at least as finely as a cell, and in
 * each cell of the body's box the dot nearest the cell's middle is kept.
 */
function spread(corners: Float64Array, low: Vec, high: Vec): Vec[] {
  const extent: Vec = [high[0] - low[0], high[1] - low[1], high[2] - low[2]];
  const cell = Math.max(extent[0], extent[1], extent[2]) / cellsPerSide;
  if (!(cell > 0)) return corners.length ? [[corners[0]!, corners[1]!, corners[2]!]] : [];
  const kept = new Map<number, { p: Vec; d: number }>();
  const side = (a: number) => Math.max(1, Math.ceil(extent[a]! / cell));
  const [nx, ny, nz] = [side(0), side(1), side(2)];
  const at = (v: number, a: number, n: number) => Math.min(n - 1, Math.floor((v - low[a]!) / cell));
  const offer = (p: Vec) => {
    const [i, j, k] = [at(p[0], 0, nx), at(p[1], 1, ny), at(p[2], 2, nz)];
    const mid = [low[0] + (i + 0.5) * cell, low[1] + (j + 0.5) * cell, low[2] + (k + 0.5) * cell];
    const d = (p[0] - mid[0]!) ** 2 + (p[1] - mid[1]!) ** 2 + (p[2] - mid[2]!) ** 2;
    const key = (i * ny + j) * nz + k;
    const best = kept.get(key);
    if (!best || d < best.d) kept.set(key, { p, d });
  };
  for (let t = 0; t < corners.length; t += 9) {
    const a: Vec = [corners[t]!, corners[t + 1]!, corners[t + 2]!];
    const b: Vec = [corners[t + 3]!, corners[t + 4]!, corners[t + 5]!];
    const c: Vec = [corners[t + 6]!, corners[t + 7]!, corners[t + 8]!];
    const edge = Math.max(Math.sqrt(dist2(a, b)), Math.sqrt(dist2(b, c)), Math.sqrt(dist2(c, a)));
    const n = Math.max(1, Math.ceil((2 * edge) / cell));
    for (let i = 0; i <= n; i++) {
      for (let j = 0; i + j <= n; j++) {
        const u = i / n;
        const v = j / n;
        const w = 1 - u - v;
        offer([a[0] * w + b[0] * u + c[0] * v, a[1] * w + b[1] * u + c[1] * v, a[2] * w + b[2] * u + c[2] * v]);
      }
    }
  }
  return [...kept.entries()].sort((x, y) => x[0] - y[0]).map(([, v]) => v.p);
}

const dist2 = (a: Vec, b: Vec) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

// ---- Placing shapes on the table ------------------------------------------------------------

function place(id: string, shape: Shape, at: Point, facing: number, z: number): Placed {
  const { cos, sin } = turnOf(facing);
  const p: Placed = { id, shape, x: at.x, y: at.y, z, cos, sin, low: [Infinity, Infinity, Infinity], high: [-Infinity, -Infinity, -Infinity] };
  for (const cx of [shape.low[0], shape.high[0]]) {
    for (const cy of [shape.low[1], shape.high[1]]) {
      for (const cz of [shape.low[2], shape.high[2]]) {
        const w = toTable(p, [cx, cy, cz]);
        for (let a = 0; a < 3; a++) {
          p.low[a] = Math.min(p.low[a]!, w[a]!);
          p.high[a] = Math.max(p.high[a]!, w[a]!);
        }
      }
    }
  }
  return p;
}

/** Facing turns clockwise from +y: a piece's right is +x when it faces +y, as Measure's distances have it. */
const toTable = (p: Placed, v: Vec): Vec => [p.x + v[0] * p.cos + v[1] * p.sin, p.y - v[0] * p.sin + v[1] * p.cos, p.z + v[2]];
const toPiece = (p: Placed, v: Vec): Vec => {
  const dx = v[0] - p.x;
  const dy = v[1] - p.y;
  return [dx * p.cos - dy * p.sin, dx * p.sin + dy * p.cos, v[2] - p.z];
};

// ---- Lines through shapes --------------------------------------------------------------------

/** Whether the line from a to b passes through a box, by the slab method. */
function meetsBox(a: Vec, b: Vec, low: Vec, high: Vec): boolean {
  let t0 = 0;
  let t1 = 1;
  for (let k = 0; k < 3; k++) {
    const d = b[k]! - a[k]!;
    if (d === 0) {
      if (a[k]! < low[k]! || a[k]! > high[k]!) return false;
      continue;
    }
    let near = (low[k]! - a[k]!) / d;
    let far = (high[k]! - a[k]!) / d;
    if (near > far) [near, far] = [far, near];
    if (near > t0) t0 = near;
    if (far < t1) t1 = far;
    if (t0 > t1) return false;
  }
  return true;
}

/** Whether the line from a to b crosses a triangle between from and to, as shares of its length (Möller and Trumbore). */
function crosses(c: Float64Array, t: number, a: Vec, b: Vec, from: number, to: number): boolean {
  const o = t * 9;
  const e1 = [c[o + 3]! - c[o]!, c[o + 4]! - c[o + 1]!, c[o + 5]! - c[o + 2]!];
  const e2 = [c[o + 6]! - c[o]!, c[o + 7]! - c[o + 1]!, c[o + 8]! - c[o + 2]!];
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const p = [d[1]! * e2[2]! - d[2]! * e2[1]!, d[2]! * e2[0]! - d[0]! * e2[2]!, d[0]! * e2[1]! - d[1]! * e2[0]!];
  const det = e1[0]! * p[0]! + e1[1]! * p[1]! + e1[2]! * p[2]!;
  if (det === 0) return false;
  const s = [a[0] - c[o]!, a[1] - c[o + 1]!, a[2] - c[o + 2]!];
  const u = (s[0]! * p[0]! + s[1]! * p[1]! + s[2]! * p[2]!) / det;
  if (u < 0 || u > 1) return false;
  const q = [s[1]! * e1[2]! - s[2]! * e1[1]!, s[2]! * e1[0]! - s[0]! * e1[2]!, s[0]! * e1[1]! - s[1]! * e1[0]!];
  const v = (d[0]! * q[0]! + d[1]! * q[1]! + d[2]! * q[2]!) / det;
  if (v < 0 || u + v > 1) return false;
  const along = (e2[0]! * q[0]! + e2[1]! * q[1]! + e2[2]! * q[2]!) / det;
  return along > from && along < to;
}

/**
 * Whether a piece stands in the way of the line from a to b, both on the table, leaving out crossings
 * within slack of b (a share of its length). With no slack, the same either way round.
 */
function blocks(p: Placed, a: Vec, b: Vec, slack = ends): boolean {
  let [from, to] = [ends, 1 - slack];
  // Always worked out from the same end, so a line grazing an edge gives one answer both ways.
  if (a[0] > b[0] || (a[0] === b[0] && (a[1] > b[1] || (a[1] === b[1] && a[2] > b[2])))) [a, b, from, to] = [b, a, 1 - to, 1 - from];
  if (!meetsBox(a, b, p.low, p.high)) return false;
  const la = toPiece(p, a);
  const lb = toPiece(p, b);
  const stack: Node[] = [p.shape.tree];
  while (stack.length) {
    const node = stack.pop()!;
    if (!meetsBox(la, lb, node.low, node.high)) continue;
    if (node.left) stack.push(node.left, node.right!);
    else for (const t of node.triangles) if (crosses(p.shape.corners, t, la, lb, from, to)) return true;
  }
  return false;
}

// ---- The question ----------------------------------------------------------------------------

function modelOf(table: TableShape, id: string): TableShape["models"][string] {
  const model = own(table.models, id);
  if (!model) throw new Error(`There is no model "${id}".`);
  if (model.place.in !== "table") throw new Error(`Model "${id}" is not on the table.`);
  return model;
}

function floorHeight(table: TableShape, at: Standing): number {
  const f = at.floor;
  return f ? (own(table.terrain, f.terrain)?.floors[f.floor]?.height ?? 0) : 0;
}

function placeModel(table: TableShape, bodies: Record<string, Mesh>, id: string): Placed {
  const model = table.models[id]!;
  const at = model.place as Standing;
  const mesh = model.mesh ? own(bodies, id) : undefined;
  if (model.mesh && !mesh) throw new Error(`The mesh of model "${id}" has not been read.`);
  return place(id, modelShape(model, mesh), at.position, at.facing, floorHeight(table, at) + baseThickness);
}

function placeTerrain(table: TableShape, bodies: Record<string, Mesh>, id: string): Placed {
  const terrain = table.terrain[id]!;
  const mesh = terrain.shape.kind === "mesh" ? own(bodies, id) : undefined;
  if (terrain.shape.kind === "mesh" && !mesh) throw new Error(`The mesh of terrain "${id}" has not been read.`);
  return place(id, terrainShape(terrain, mesh), terrain.position, terrain.facing, 0);
}

const hundredths = (n: number) => Math.round(n * 100) / 100 + 0;

export function sightOf(table: TableShape, bodies: Record<string, Mesh>, from: { model: string }, to: SightTarget, ignore: string[] = []): Sight {
  modelOf(table, from.model);
  if ("model" in to) modelOf(table, to.model);
  // Every mesh on the table must be here, even an ignored one, so every browser answers alike.
  const skip = new Set([...ignore, from.model, ...("model" in to ? [to.model] : [])]);
  const looker = placeModel(table, bodies, from.model);
  const target = "model" in to ? placeModel(table, bodies, to.model) : undefined;
  const blockers: Placed[] = [];
  for (const id of Object.keys(table.terrain).sort()) {
    const p = placeTerrain(table, bodies, id);
    if (!skip.has(id)) blockers.push(p);
  }
  for (const id of Object.keys(table.models).sort()) {
    if (table.models[id]!.place.in !== "table" || id === from.model || ("model" in to && id === to.model)) continue;
    const p = placeModel(table, bodies, id);
    if (!skip.has(id)) blockers.push(p);
  }

  const eyes = looker.shape.points.map((v) => toTable(looker, v));
  const marks: Vec[] = target ? target.shape.points.map((v) => toTable(target, v)) : [["x" in to ? to.x : 0, "x" in to ? to.y : 0, "x" in to ? (to.z ?? 0) : 0]];
  // A point target may lie on a surface; a body's own points never need this.
  const slack = (a: Vec, b: Vec) => (target ? ends : Math.max(ends, onSurface / Math.sqrt(dist2(a, b))));
  const blocking = (a: Vec, b: Vec) => blockers.filter((p) => blocks(p, a, b, slack(a, b)));

  let seen = 0;
  let line: Sight["line"] = null;
  const hidden = new Set<string>();
  for (const mark of marks) {
    const eye = eyes.find((e) => !blockers.some((p) => blocks(p, e, mark, slack(e, mark))));
    if (eye) {
      seen++;
      line ??= [{ x: eye[0], y: eye[1], z: eye[2] }, { x: mark[0], y: mark[1], z: mark[2] }];
      continue;
    }
    // What hides this part: each piece that alone stands between some part of the looker and it,
    // or, where pieces overlap so none is alone, those in the way of the least hidden line.
    const lines = eyes.map((e) => blocking(e, mark));
    const alone = lines.filter((l) => l.length === 1).map((l) => l[0]!.id);
    if (alone.length) for (const id of alone) hidden.add(id);
    else {
      const fewest = lines.reduce((best, l) => (l.length < best.length ? l : best), lines[0] ?? []);
      for (const p of fewest) hidden.add(p.id);
    }
  }
  return { seen: marks.length ? hundredths(seen / marks.length) : 0, hiddenBy: [...hidden].sort(), line };
}
