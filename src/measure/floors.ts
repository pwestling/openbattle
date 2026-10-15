// The flat floors of a mesh: its upward-facing flat areas, in the piece's own inches.
// The mesh is read as three.js reads it: +y is up and a triangle's corners run anticlockwise seen
// from the side it faces. Mesh x is the piece's width and mesh -z its depth (table y), so a mesh
// looks the same way round on the table as in a 3D editor. The mesh is stretched to the piece's size.
// No trigonometry: the same mesh and size give the same floors in every browser.
import type { Floor, Mesh, Point } from "./index.ts";

/** How nearly upright a triangle's normal must be for it to count as flat: within 2°, so ramps are not floors. */
const flatEnough = 0.9994;
/** Flat areas within this height of each other (inches) are one floor. */
const sameHeight = 0.05;
/** Separate flat areas at one height this close together (inches) are merged into one floor. */
const nearby = 0.1;
/** Separate areas merge only if the outline around them all covers at most this much more than they do. */
const mostlyCovered = 1.1;
/** A flat area smaller than this (square inches) is a ledge or a detail, too small to stand on. */
const smallest = 0.25;
/** Corners closer than this (inches) are the same corner, so separate triangles join up. */
const weld = 1e-4;

interface Area {
  triangles: number[];
  height: number;
  size: number;
  low: Point;
  high: Point;
}

const thousandths = (n: number) => Math.round(n * 1000) / 1000 + 0;

export function floorsOf(mesh: Mesh, size: { width: number; depth: number; height: number }): Floor[] {
  const raw = mesh.positions;
  const corners = raw.length / 3;
  const index = (i: number) => (mesh.indices ? mesh.indices[i]! : i);
  const triangleCount = Math.floor((mesh.indices ? mesh.indices.length : corners) / 3);
  if (triangleCount === 0) return [];

  // Stretch the mesh to the piece's size, centred across and standing on height 0.
  const low = [Infinity, Infinity, Infinity];
  const high = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < corners; i++) {
    for (let a = 0; a < 3; a++) {
      low[a] = Math.min(low[a]!, raw[i * 3 + a]!);
      high[a] = Math.max(high[a]!, raw[i * 3 + a]!);
    }
  }
  const scale = (a: number, to: number) => (high[a]! > low[a]! ? to / (high[a]! - low[a]!) : 1);
  const sx = scale(0, size.width);
  const sy = scale(1, size.height);
  const sz = scale(2, size.depth);
  const mid = [(low[0]! + high[0]!) / 2, 0, (low[2]! + high[2]!) / 2];
  // Each corner on the table: x across, y into the table (mesh -z), h up.
  const xs = new Float64Array(corners);
  const ys = new Float64Array(corners);
  const hs = new Float64Array(corners);
  for (let i = 0; i < corners; i++) {
    xs[i] = (raw[i * 3]! - mid[0]!) * sx;
    hs[i] = (raw[i * 3 + 1]! - low[1]!) * sy;
    ys[i] = -(raw[i * 3 + 2]! - mid[2]!) * sz;
  }
  // Corners at the same place are one corner.
  const welded = new Map<string, number>();
  const corner = new Int32Array(corners);
  for (let i = 0; i < corners; i++) {
    const key = `${Math.round(xs[i]! / weld)},${Math.round(ys[i]! / weld)},${Math.round(hs[i]! / weld)}`;
    let id = welded.get(key);
    if (id === undefined) welded.set(key, (id = i));
    corner[i] = id;
  }

  // The flat, upward-facing triangles, and the height and size of each.
  const flat: number[] = [];
  const heightOf = new Float64Array(triangleCount);
  const sizeOf = new Float64Array(triangleCount);
  const real = (i: number) => Number.isInteger(i) && i >= 0 && i < corners;
  for (let t = 0; t < triangleCount; t++) {
    const [a, b, c] = [index(t * 3), index(t * 3 + 1), index(t * 3 + 2)];
    if (!real(a) || !real(b) || !real(c)) continue;
    const ux = xs[b]! - xs[a]!, uy = ys[b]! - ys[a]!, uh = hs[b]! - hs[a]!;
    const vx = xs[c]! - xs[a]!, vy = ys[c]! - ys[a]!, vh = hs[c]! - hs[a]!;
    // The normal, with h up; table x, y and h are a right-handed set, like mesh x, -z and y.
    const nx = uy * vh - uh * vy;
    const ny = uh * vx - ux * vh;
    const nh = ux * vy - uy * vx;
    const length = Math.sqrt(nx * nx + ny * ny + nh * nh);
    // Written so that a normal that is not a number (a broken mesh) never counts as flat.
    if (!(nh / length >= flatEnough)) continue;
    // A triangle that rises more than a floor may is part of a slope, however gentle.
    if (Math.max(hs[a]!, hs[b]!, hs[c]!) - Math.min(hs[a]!, hs[b]!, hs[c]!) > sameHeight) continue;
    flat.push(t);
    heightOf[t] = (hs[a]! + hs[b]! + hs[c]!) / 3;
    sizeOf[t] = nh / 2;
  }

  // Flat triangles sharing an edge are one area, as long as the whole area stays within one
  // floor's height: otherwise a gentle slope of nearly flat triangles would chain into a floor.
  const parent = new Map<number, number>(flat.map((t) => [t, t]));
  const lowest = new Map<number, number>();
  const highest = new Map<number, number>();
  for (const t of flat) {
    const [a, b, c] = [index(t * 3), index(t * 3 + 1), index(t * 3 + 2)];
    lowest.set(t, Math.min(hs[a]!, hs[b]!, hs[c]!));
    highest.set(t, Math.max(hs[a]!, hs[b]!, hs[c]!));
  }
  const root = (t: number): number => {
    let r = t;
    while (parent.get(r) !== r) r = parent.get(r)!;
    parent.set(t, r);
    return r;
  };
  const join = (a: number, b: number) => {
    const [ra, rb] = [root(a), root(b)];
    if (ra === rb) return;
    const lo = Math.min(lowest.get(ra)!, lowest.get(rb)!);
    const hi = Math.max(highest.get(ra)!, highest.get(rb)!);
    if (hi - lo > sameHeight) return;
    const [keep, gone] = [Math.min(ra, rb), Math.max(ra, rb)];
    parent.set(gone, keep);
    lowest.set(keep, lo);
    highest.set(keep, hi);
  };
  const edgeKey = (p: number, q: number) => (p < q ? `${p}:${q}` : `${q}:${p}`);
  const edgeOwner = new Map<string, number>();
  const cornersOf = (t: number) => [corner[index(t * 3)]!, corner[index(t * 3 + 1)]!, corner[index(t * 3 + 2)]!] as const;
  for (const t of flat) {
    const [a, b, c] = cornersOf(t);
    for (const [p, q] of [[a, b], [b, c], [c, a]] as const) {
      const key = edgeKey(p, q);
      const other = edgeOwner.get(key);
      if (other === undefined) edgeOwner.set(key, t);
      else join(other, t);
    }
  }
  const byRoot = new Map<number, number[]>();
  for (const t of flat) {
    const r = root(t);
    const list = byRoot.get(r);
    if (list) list.push(t);
    else byRoot.set(r, [t]);
  }
  let areas: Area[] = [...byRoot.values()].map((triangles) => {
    let size = 0;
    let weighted = 0;
    const lo = { x: Infinity, y: Infinity };
    const hi = { x: -Infinity, y: -Infinity };
    for (const t of triangles) {
      size += sizeOf[t]!;
      weighted += sizeOf[t]! * heightOf[t]!;
      for (const p of cornersOf(t)) {
        lo.x = Math.min(lo.x, xs[p]!);
        lo.y = Math.min(lo.y, ys[p]!);
        hi.x = Math.max(hi.x, xs[p]!);
        hi.y = Math.max(hi.y, ys[p]!);
      }
    }
    return { triangles, height: size > 0 ? weighted / size : heightOf[triangles[0]!]!, size, low: lo, high: hi };
  });

  // Nearby areas at almost the same height are one floor, unless the outline around them would
  // take in empty space, such as the inside corner of an L-shaped walkway made of two plates.
  areas.sort((a, b) => a.height - b.height || a.triangles[0]! - b.triangles[0]!);
  const group = areas.map((_, i) => i);
  const top = (i: number): number => (group[i] === i ? i : (group[i] = top(group[i]!)));
  const around = areas.map((area) => hull(area.triangles.flatMap((t) => cornersOf(t).map((p) => ({ x: xs[p]!, y: ys[p]! })))));
  const covered = areas.map((area) => area.size);
  const floorOf = areas.map((area) => ({ lo: area.height, hi: area.height }));
  for (let i = 0; i < areas.length; i++) {
    const a = areas[i]!;
    for (let j = i + 1; j < areas.length && areas[j]!.height - a.height <= sameHeight; j++) {
      const b = areas[j]!;
      const gapX = Math.max(a.low.x - b.high.x, b.low.x - a.high.x);
      const gapY = Math.max(a.low.y - b.high.y, b.low.y - a.high.y);
      if (gapX > nearby || gapY > nearby) continue;
      const [ti, tj] = [top(i), top(j)];
      if (ti === tj) continue;
      const lo = Math.min(floorOf[ti]!.lo, floorOf[tj]!.lo);
      const hi = Math.max(floorOf[ti]!.hi, floorOf[tj]!.hi);
      const outline = hull([...around[ti]!, ...around[tj]!]);
      const size = covered[ti]! + covered[tj]!;
      if (hi - lo > sameHeight || Math.abs(signedArea(outline)) > size * mostlyCovered) continue;
      const [keep, gone] = [Math.min(ti, tj), Math.max(ti, tj)];
      group[gone] = keep;
      around[keep] = outline;
      covered[keep] = size;
      floorOf[keep] = { lo, hi };
    }
  }
  const merged = new Map<number, Area[]>();
  areas.forEach((area, i) => {
    const list = merged.get(top(i));
    if (list) list.push(area);
    else merged.set(top(i), [area]);
  });
  const parts = new Map<Area, number>();
  areas = [...merged.values()].map((list) => {
    const size = list.reduce((s, a) => s + a.size, 0);
    const area: Area = {
      triangles: list.flatMap((a) => a.triangles),
      height: size > 0 ? list.reduce((s, a) => s + a.height * a.size, 0) / size : list[0]!.height,
      size,
      low: { x: Math.min(...list.map((a) => a.low.x)), y: Math.min(...list.map((a) => a.low.y)) },
      high: { x: Math.max(...list.map((a) => a.high.x)), y: Math.max(...list.map((a) => a.high.y)) },
    };
    parts.set(area, list.length);
    return area;
  });

  const floors = areas
    .filter((area) => area.size >= smallest)
    .map((area) => {
      const points = parts.get(area) === 1 ? edgeOf(area.triangles, cornersOf, xs, ys) : null;
      const outline = points ?? hull(area.triangles.flatMap((t) => cornersOf(t).map((p) => ({ x: xs[p]!, y: ys[p]! }))));
      return { height: thousandths(area.height), outline: tidy(outline) };
    });
  const centre = (f: Floor) => f.outline.reduce((s, p) => ({ x: s.x + p.x, y: s.y + p.y }), { x: 0, y: 0 });
  return floors.sort((a, b) => a.height - b.height || centre(a).x - centre(b).x || centre(a).y - centre(b).y);
}

/** The outer edge of a joined-up area: the longest loop of edges used by only one of its triangles. */
function edgeOf(
  triangles: number[],
  cornersOf: (t: number) => readonly [number, number, number],
  xs: Float64Array,
  ys: Float64Array,
): Point[] | null {
  const uses = new Map<string, number>();
  const directed: [number, number][] = [];
  for (const t of triangles) {
    const [a, b, c] = cornersOf(t);
    for (const [p, q] of [[a, b], [b, c], [c, a]] as const) {
      directed.push([p, q]);
      const key = p < q ? `${p}:${q}` : `${q}:${p}`;
      uses.set(key, (uses.get(key) ?? 0) + 1);
    }
  }
  const next = new Map<number, number[]>();
  for (const [p, q] of directed) {
    if (uses.get(p < q ? `${p}:${q}` : `${q}:${p}`) !== 1) continue;
    const list = next.get(p);
    if (list) list.push(q);
    else next.set(p, [q]);
  }
  let best: Point[] | null = null;
  let bestArea = 0;
  for (const start of [...next.keys()]) {
    while (next.get(start)?.length) {
      const loop = [start];
      let at = next.get(start)!.shift()!;
      while (at !== start && next.get(at)?.length) {
        loop.push(at);
        at = next.get(at)!.shift()!;
      }
      if (at !== start) return null;
      const points = loop.map((p) => ({ x: xs[p]!, y: ys[p]! }));
      const area = Math.abs(signedArea(points));
      if (area > bestArea) [best, bestArea] = [points, area];
    }
  }
  return best;
}

function signedArea(points: Point[]): number {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i]!;
    const q = points[(i + 1) % points.length]!;
    area += p.x * q.y - q.x * p.y;
  }
  return area / 2;
}

/** The convex hull, anticlockwise (Andrew's monotone chain). */
function hull(points: Point[]): Point[] {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: Point, a: Point, b: Point) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const half = (list: Point[]) => {
    const out: Point[] = [];
    for (const p of list) {
      while (out.length >= 2 && cross(out[out.length - 2]!, out[out.length - 1]!, p) <= 0) out.pop();
      out.push(p);
    }
    out.pop();
    return out;
  };
  return [...half(sorted), ...half([...sorted].reverse())];
}

/** Rounded to a thousandth of an inch, without repeated or in-line corners, anticlockwise, from the lowest corner. */
function tidy(outline: Point[]): Point[] {
  let points = outline.map((p) => ({ x: thousandths(p.x), y: thousandths(p.y) }));
  for (let changed = true; changed && points.length > 3; ) {
    changed = false;
    for (let i = 0; i < points.length; i++) {
      const a = points[(i + points.length - 1) % points.length]!;
      const b = points[i]!;
      const c = points[(i + 1) % points.length]!;
      const inLine = Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) < 1e-9;
      if ((a.x === b.x && a.y === b.y) || inLine) {
        points.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  if (signedArea(points) < 0) points.reverse();
  let lowest = 0;
  points.forEach((p, i) => {
    const l = points[lowest]!;
    if (p.y < l.y || (p.y === l.y && p.x < l.x)) lowest = i;
  });
  return [...points.slice(lowest), ...points.slice(0, lowest)];
}
