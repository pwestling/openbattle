import { baseSizeInches, GEOMETRY_EPSILON } from "./geometry";
import type { Model, TerrainPiece, Token } from "./types";

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** A reusable local-space segment; direction is b-a, never normalized. */
export interface LocalSegment {
  x: number;
  y: number;
  z: number;
  dx: number;
  dy: number;
  dz: number;
  /** 1e-9 inches divided by world segment length, computed once per ray. */
  tolerance: number;
}

/** Physical height, without interpreting game data or guessing a miniature profile. */
export function modelHeight(model: Model | Token): number {
  if (model.height !== undefined) return model.height;
  if (model.bands?.length) {
    let top = -Infinity;
    for (const band of model.bands) top = Math.max(top, band.z1);
    return top;
  }
  if (!model.base) return 0;
  const { width, depth } = baseSizeInches(model.base);
  return Math.max(width, depth);
}

/** Highest recorded solid top or mesh vertex; an empty piece has height zero. */
export function terrainHeight(piece: TerrainPiece): number {
  let top = -Infinity;
  for (const solid of piece.solids) top = Math.max(top, solid.z + solid.h);
  if (piece.hull) for (let i = 2; i < piece.hull.length; i += 3) top = Math.max(top, piece.hull[i]!);
  return top === -Infinity ? 0 : top;
}

/**
 * Closed box slab intersection. Infinity means no contact, including for the
 * other contact functions below. Endpoints and tangencies count; starting in
 * the volume returns zero. Parallel lengths and slab boundaries use 1e-9 inch.
 */
export function segmentBoxContact(
  ray: LocalSegment,
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
  minZ = -Infinity,
  maxZ = Infinity,
): number {
  let lo = 0;
  let hi = 1;
  for (let axis = 0; axis < 3; axis++) {
    const a = axis === 0 ? ray.x : axis === 1 ? ray.y : ray.z;
    const d = axis === 0 ? ray.dx : axis === 1 ? ray.dy : ray.dz;
    const min = axis === 0 ? minX : axis === 1 ? minY : minZ;
    const max = axis === 0 ? maxX : axis === 1 ? maxY : maxZ;
    if (Math.abs(d) <= GEOMETRY_EPSILON) {
      if (a < min - GEOMETRY_EPSILON || a > max + GEOMETRY_EPSILON) return Infinity;
    } else {
      const t0 = (min - a) / d;
      const t1 = (max - a) / d;
      lo = Math.max(lo, Math.min(t0, t1));
      hi = Math.min(hi, Math.max(t0, t1));
      if (lo > hi + ray.tolerance) return Infinity;
    }
  }
  return lo > 1 + ray.tolerance || hi < -ray.tolerance ? Infinity : Math.max(0, Math.min(1, lo));
}

/** Exact upright elliptic cylinder, optionally unbounded in z for a footprint. */
export function segmentCylinderContact(
  ray: LocalSegment,
  rx: number,
  ry: number,
  bottom = -Infinity,
  top = Infinity,
): number {
  // Zero-width geometry is a line/point, not an invented small volume.
  if (rx === 0 || ry === 0) return segmentBoxContact(ray, -rx, rx, -ry, ry, bottom, top);
  let lo = 0;
  let hi = 1;
  if (Math.abs(ray.dz) <= GEOMETRY_EPSILON) {
    if (ray.z < bottom - GEOMETRY_EPSILON || ray.z > top + GEOMETRY_EPSILON) return Infinity;
  } else {
    const t0 = (bottom - ray.z) / ray.dz;
    const t1 = (top - ray.z) / ray.dz;
    lo = Math.max(lo, Math.min(t0, t1));
    hi = Math.min(hi, Math.max(t0, t1));
    if (lo > hi + ray.tolerance) return Infinity;
  }
  const x = ray.x / rx;
  const y = ray.y / ry;
  const dx = ray.dx / rx;
  const dy = ray.dy / ry;
  const a = dx * dx + dy * dy;
  const b = 2 * (x * dx + y * dy);
  const c = x * x + y * y - 1;
  const radialTolerance = GEOMETRY_EPSILON / Math.min(rx, ry);
  if (a === 0) return c <= 2 * radialTolerance ? Math.max(0, Math.min(1, lo)) : Infinity;
  let discriminant = b * b - 4 * a * c;
  if (discriminant < -8 * a * radialTolerance) return Infinity;
  discriminant = Math.max(0, discriminant);
  // Stable quadratic roots avoid catastrophic cancellation near an endpoint.
  const q = -0.5 * (b + (b >= 0 ? 1 : -1) * Math.sqrt(discriminant));
  const t0 = discriminant === 0 ? -b / (2 * a) : q / a;
  const t1 = discriminant === 0 ? t0 : c / q;
  lo = Math.max(lo, Math.min(t0, t1));
  hi = Math.min(hi, Math.max(t0, t1));
  if (lo > hi + ray.tolerance || lo > 1 + ray.tolerance || hi < -ray.tolerance) return Infinity;
  return Math.max(0, Math.min(1, lo));
}

/** Immutable hulls cache triangle origins/edges, not rays or game decisions. */
const meshEdges = new WeakMap<readonly number[], Float64Array>();

function edgesOf(mesh: readonly number[]): Float64Array {
  const cached = meshEdges.get(mesh);
  if (cached) return cached;
  const edges = new Float64Array(mesh.length);
  for (let i = 0; i < mesh.length; i += 9) {
    for (let axis = 0; axis < 3; axis++) {
      edges[i + axis] = mesh[i + axis]!;
      edges[i + 3 + axis] = mesh[i + 3 + axis]! - mesh[i + axis]!;
      edges[i + 6 + axis] = mesh[i + 6 + axis]! - mesh[i + axis]!;
    }
  }
  meshEdges.set(mesh, edges);
  return edges;
}

/**
 * Triangle surface contact only (Möller–Trumbore), not a filled mesh volume.
 * Coplanar rays are ignored at determinant tolerance 1e-12. No temporary
 * vectors or triangle slices are allocated in this per-ray hot loop.
 */
export function segmentMeshContact(ray: LocalSegment, mesh: readonly number[]): number {
  const edges = edgesOf(mesh);
  let nearest = Infinity;
  for (let i = 0; i < edges.length; i += 9) {
    const e1x = edges[i + 3]!,
      e1y = edges[i + 4]!,
      e1z = edges[i + 5]!;
    const e2x = edges[i + 6]!,
      e2y = edges[i + 7]!,
      e2z = edges[i + 8]!;
    const px = ray.dy * e2z - ray.dz * e2y;
    const py = ray.dz * e2x - ray.dx * e2z;
    const pz = ray.dx * e2y - ray.dy * e2x;
    const det = e1x * px + e1y * py + e1z * pz;
    if (Math.abs(det) <= 1e-12) continue;
    const inv = 1 / det;
    const tx = ray.x - edges[i]!,
      ty = ray.y - edges[i + 1]!,
      tz = ray.z - edges[i + 2]!;
    const u = (tx * px + ty * py + tz * pz) * inv;
    if (u < -GEOMETRY_EPSILON || u > 1 + GEOMETRY_EPSILON) continue;
    const qx = ty * e1z - tz * e1y;
    const qy = tz * e1x - tx * e1z;
    const qz = tx * e1y - ty * e1x;
    const v = (ray.dx * qx + ray.dy * qy + ray.dz * qz) * inv;
    if (v < -GEOMETRY_EPSILON || u + v > 1 + GEOMETRY_EPSILON) continue;
    const t = (e2x * qx + e2y * qy + e2z * qz) * inv;
    if (t >= -ray.tolerance && t <= 1 + ray.tolerance)
      nearest = Math.min(nearest, Math.max(0, Math.min(1, t)));
  }
  return nearest;
}
