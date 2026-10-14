import {
  baseSizeInches,
  GEOMETRY_EPSILON,
  footprintContains,
  footprintsOverlap,
  type Footprint,
} from "./geometry";
import {
  modelHeight,
  terrainHeight,
  segmentBoxContact,
  segmentCylinderContact,
  segmentMeshContact,
  type LocalSegment,
  type Vec3,
} from "./terrain";
import type { BaseShape, GameState, Model, TerrainPiece, Token, Vec2 } from "./types";

export type GeometryRef = { kind: "model" | "terrain" | "token"; id: string };

/** Selection is entirely the package's decision; all solid kinds are geometry. */
export type GeometryBlocker =
  | { kind: "model" | "token"; id: string; shape: "body" | "footprint" }
  | { kind: "terrain"; id: string; shape: "solids"; solids?: readonly number[] }
  | { kind: "terrain"; id: string; shape: "hull" }
  | { kind: "terrain"; id: string; shape: "footprint" }
  | { kind: "terrain"; id: string; shape: "prism"; bottom: number; top: number };

export type SegmentHit = { object: GeometryRef; t: number; point: Vec3 };
export type SegmentHit2D = { object: GeometryRef; t: number; point: Vec2 };

export type SampleOptions = {
  mode: "body" | "height" | "footprint";
  blockers: readonly GeometryBlocker[];
  /** Absolute world inches; nonempty and unsupported in footprint mode. */
  eyes?: readonly Vec3[];
};

export type SampleMeasurement = {
  clear: number;
  total: number;
  fraction: number;
  anyClear: boolean;
  allClear: boolean;
  blockers: GeometryRef[];
};

/** Read-only geometry: no LOS, cover, allegiance, arc or unit aggregation policy. */
export type GeometryView = {
  segment(a: Vec3, b: Vec3, blockers: readonly GeometryBlocker[]): SegmentHit[];
  segment2D(a: Vec2, b: Vec2, blockers: readonly GeometryBlocker[]): SegmentHit2D[];
  sample(observer: string, target: string, options: SampleOptions): SampleMeasurement;
  contains(object: GeometryRef, point: Vec2): boolean;
  overlaps(a: GeometryRef, b: GeometryRef): boolean;
  height(object: GeometryRef): number;
};

type PhysicalObject = Model | Token | TerrainPiece;
type Band = { r: number; z0: number; z1: number };
type Shape = {
  object: PhysicalObject;
  footprint: Footprint;
  c: number;
  s: number;
  rx: number;
  ry: number;
  rectangular: boolean;
  z: number;
  height: number;
  bands?: readonly Band[];
  samples?: Samples;
};
type Samples = { eyes: Vec3[]; body: Vec3[]; heightEye: Vec3[]; height: Vec3[]; footprint: Vec3[] };
type Selection = { ref: GeometryRef; key: string; shape: Shape; blocker: GeometryBlocker };

// State/entity objects and their arrays are immutable. Cache only physical shape
// work, never caller selections, rays, measurement results or policy decisions.
const shapes = new WeakMap<PhysicalObject, Shape>();
const terrainIndexes = new WeakMap<TerrainPiece[], Map<string, TerrainPiece>>();

function finite(value: unknown, label: string): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`Invalid geometry ${label}`);
}

function nonnegative(value: unknown, label: string): asserts value is number {
  finite(value, label);
  if (value < 0) throw new Error(`Invalid geometry ${label}`);
}

function point2(point: Vec2): void {
  if (!point || typeof point !== "object") throw new Error("Invalid geometry point");
  finite(point.x, "x");
  finite(point.y, "y");
}

function point3(point: Vec3): void {
  point2(point);
  finite(point.z, "z");
}

function validateBase(base: BaseShape): void {
  if (!base || typeof base !== "object") throw new Error("Invalid geometry base");
  if (base.shape === "round") nonnegative(base.diameterMm, "base diameter");
  else if (base.shape === "oval" || base.shape === "rect") {
    nonnegative(base.widthMm, "base width");
    nonnegative(base.depthMm, "base depth");
  } else throw new Error("Invalid geometry base shape");
}

function shapeOf(object: PhysicalObject, terrain: boolean): Shape {
  const cached = shapes.get(object);
  if (cached) return cached;
  point2(object.position);
  finite(object.facing ?? 0, "facing");
  let footprint: Footprint;
  let z = 0;
  let height: number;
  let bands: readonly Band[] | undefined;
  if (terrain) {
    const piece = object as TerrainPiece;
    nonnegative(piece.width, "terrain width");
    nonnegative(piece.depth, "terrain depth");
    if (!Array.isArray(piece.solids)) throw new Error("Invalid geometry solids");
    for (const solid of piece.solids) {
      finite(solid.x, "solid x");
      finite(solid.y, "solid y");
      finite(solid.z, "solid z");
      nonnegative(solid.w, "solid width");
      nonnegative(solid.d, "solid depth");
      nonnegative(solid.h, "solid height");
    }
    if (piece.hull !== undefined) {
      if (!Array.isArray(piece.hull) || piece.hull.length % 9 !== 0)
        throw new Error("Invalid geometry hull triangles");
      for (const coordinate of piece.hull) finite(coordinate, "hull coordinate");
    }
    footprint = {
      position: piece.position,
      facing: piece.facing,
      base: { shape: "rect", widthMm: piece.width * 25.4, depthMm: piece.depth * 25.4 },
    };
    height = terrainHeight(piece);
  } else {
    const body = object as Model | Token;
    if (body.base !== undefined) validateBase(body.base);
    finite(body.z ?? 0, "base z");
    if (body.height !== undefined) nonnegative(body.height, "body height");
    if (body.bands !== undefined) {
      if (!Array.isArray(body.bands)) throw new Error("Invalid geometry body bands");
      for (const band of body.bands) {
        nonnegative(band.r, "band radius");
        nonnegative(band.z0, "band bottom");
        nonnegative(band.z1, "band top");
        if (band.z1 < band.z0) throw new Error("Invalid geometry band interval");
      }
      if (body.bands.length) bands = body.bands;
    }
    footprint = body;
    z = body.z ?? 0;
    // A token with no base/bands is a point even if it records a height.
    height = body.base || bands ? modelHeight(body) : 0;
  }
  const size = footprint.base ? baseSizeInches(footprint.base) : { width: 0, depth: 0 };
  const shape: Shape = {
    object,
    footprint,
    c: Math.cos(footprint.facing ?? 0),
    s: Math.sin(footprint.facing ?? 0),
    rx: size.width / 2,
    ry: size.depth / 2,
    rectangular: footprint.base?.shape === "rect",
    z,
    height,
    bands,
  };
  shapes.set(object, shape);
  return shape;
}

function compareRefs(a: GeometryRef, b: GeometryRef): number {
  if (a.kind !== b.kind) return a.kind < b.kind ? -1 : 1;
  return a.id === b.id ? 0 : a.id < b.id ? -1 : 1;
}

function copyRef(ref: GeometryRef): GeometryRef {
  return { kind: ref.kind, id: ref.id };
}

function contact(a: Vec2, b: Vec2, selection: Selection, ray: LocalSegment, aZ: number, bZ: number): number {
  const shape = selection.shape;
  const { position } = shape.footprint;
  const ax = a.x - position.x;
  const ay = a.y - position.y;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  ray.x = ax * shape.c - ay * shape.s;
  ray.y = ax * shape.s + ay * shape.c;
  ray.dx = dx * shape.c - dy * shape.s;
  ray.dy = dx * shape.s + dy * shape.c;
  ray.z = aZ - shape.z;
  ray.dz = bZ - aZ;
  const blocker = selection.blocker;
  if (blocker.shape === "footprint") {
    return shape.rectangular
      ? segmentBoxContact(ray, -shape.rx, shape.rx, -shape.ry, shape.ry)
      : segmentCylinderContact(ray, shape.rx, shape.ry);
  }
  if (blocker.kind !== "terrain") {
    if (shape.bands) {
      let nearest = Infinity;
      for (const band of shape.bands)
        nearest = Math.min(nearest, segmentCylinderContact(ray, band.r, band.r, band.z0, band.z1));
      return nearest;
    }
    return shape.rectangular
      ? segmentBoxContact(ray, -shape.rx, shape.rx, -shape.ry, shape.ry, 0, shape.height)
      : segmentCylinderContact(ray, shape.rx, shape.ry, 0, shape.height);
  }
  const piece = shape.object as TerrainPiece;
  if (blocker.shape === "hull") return segmentMeshContact(ray, piece.hull!);
  if (blocker.shape === "prism")
    return segmentBoxContact(ray, -shape.rx, shape.rx, -shape.ry, shape.ry, blocker.bottom, blocker.top);
  let nearest = Infinity;
  const indexes = blocker.solids;
  const count = indexes ? indexes.length : piece.solids.length;
  for (let i = 0; i < count; i++) {
    const solid = piece.solids[indexes ? indexes[i]! : i]!;
    nearest = Math.min(
      nearest,
      segmentBoxContact(
        ray,
        solid.x - solid.w / 2,
        solid.x + solid.w / 2,
        solid.y - solid.d / 2,
        solid.y + solid.d / 2,
        solid.z,
        solid.z + solid.h,
      ),
    );
  }
  return nearest;
}

function localPoint(shape: Shape, x: number, y: number, z: number): Vec3 {
  return {
    x: shape.footprint.position.x + x * shape.c + y * shape.s,
    y: shape.footprint.position.y - x * shape.s + y * shape.c,
    z: shape.z + z,
  };
}

/**
 * Sampling is a fixed finite measurement, not a visibility verdict:
 * - body: 5 eyes at 90% height (centre + 4 world-cardinal offsets at 70%
 *   of the larger base semiaxis). Target: 3 centres at 15/50/90% height,
 *   plus 8-point 85%-semiaxis rings at 25/75% height = 19 points. Bands
 *   instead each use 1 midpoint + two such radius rings = 17 per band.
 * - height: 1 top eye, target top/mid/bottom (min(0.05,height) above base).
 * - footprint: 1 centre eye, target centre + 8 rim points at 95% semiaxes;
 *   rectangles use edge midpoints/corners, ellipses equally spaced angles.
 * Rings and rectangular footprints honor facing; circular band rings are
 * world-aligned. Footprint rays are genuinely 2D, regardless of recorded z.
 */
function samplesOf(shape: Shape): Samples {
  if (shape.samples) return shape.samples;
  const { position } = shape.footprint;
  const eyeZ = shape.z + shape.height * 0.9;
  const eyes: Vec3[] = [{ x: position.x, y: position.y, z: eyeZ }];
  const radius = Math.max(shape.rx, shape.ry) * 0.7;
  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2;
    eyes.push({
      x: position.x + Math.cos(angle) * radius,
      y: position.y + Math.sin(angle) * radius,
      z: eyeZ,
    });
  }
  const body: Vec3[] = [];
  if (shape.bands) {
    for (const band of shape.bands) {
      body.push({ x: position.x, y: position.y, z: shape.z + (band.z0 + band.z1) / 2 });
      for (const fraction of [0.25, 0.75]) {
        for (let i = 0; i < 8; i++) {
          const angle = (i * Math.PI) / 4;
          body.push({
            x: position.x + Math.cos(angle) * band.r * 0.85,
            y: position.y + Math.sin(angle) * band.r * 0.85,
            z: shape.z + band.z0 + (band.z1 - band.z0) * fraction,
          });
        }
      }
    }
  } else {
    for (const fraction of [0.15, 0.5, 0.9]) body.push(localPoint(shape, 0, 0, shape.height * fraction));
    for (const fraction of [0.25, 0.75]) {
      for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI) / 4;
        body.push(
          localPoint(
            shape,
            Math.cos(angle) * shape.rx * 0.85,
            Math.sin(angle) * shape.ry * 0.85,
            shape.height * fraction,
          ),
        );
      }
    }
  }
  const footprint = [localPoint(shape, 0, 0, 0)];
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4;
    let x = Math.cos(angle);
    let y = Math.sin(angle);
    if (shape.rectangular) {
      const scale = Math.max(Math.abs(x), Math.abs(y));
      x /= scale;
      y /= scale;
    }
    footprint.push(localPoint(shape, x * shape.rx * 0.95, y * shape.ry * 0.95, 0));
  }
  const samples: Samples = {
    eyes,
    body,
    footprint,
    heightEye: [localPoint(shape, 0, 0, shape.height)],
    height: [shape.height, shape.height / 2, Math.min(0.05, shape.height)].map((z) =>
      localPoint(shape, 0, 0, z),
    ),
  };
  shape.samples = samples;
  return samples;
}

export function geometryView(state: GameState): GeometryView {
  function resolve(ref: GeometryRef): Shape {
    if (!ref || typeof ref !== "object" || typeof ref.id !== "string")
      throw new Error("Invalid geometry reference");
    let object: PhysicalObject | undefined;
    if (ref.kind === "model") {
      object = Object.hasOwn(state.models, ref.id) ? state.models[ref.id] : undefined;
      if ((object as Model | undefined)?.off) throw new Error(`Off-table geometry model: ${ref.id}`);
    } else if (ref.kind === "token")
      object = Object.hasOwn(state.tokens, ref.id) ? state.tokens[ref.id] : undefined;
    else if (ref.kind === "terrain") {
      let index = terrainIndexes.get(state.terrain);
      if (!index) {
        index = new Map(state.terrain.map((piece) => [piece.id, piece]));
        terrainIndexes.set(state.terrain, index);
      }
      object = index.get(ref.id);
    } else throw new Error("Invalid geometry reference kind");
    if (!object) throw new Error(`Missing geometry ${ref.kind}: ${ref.id}`);
    return shapeOf(object, ref.kind === "terrain");
  }

  function select(blockers: readonly GeometryBlocker[], twoD: boolean): Selection[] {
    if (!Array.isArray(blockers)) throw new Error("Invalid geometry blockers");
    return blockers.map((blocker) => {
      const shape = resolve(blocker);
      if (twoD ? blocker.shape !== "footprint" : blocker.shape === "footprint")
        throw new Error("Geometry blocker shape does not match query dimension");
      if (blocker.kind === "terrain") {
        const piece = shape.object as TerrainPiece;
        if (blocker.shape === "solids") {
          if (blocker.solids !== undefined) {
            if (!Array.isArray(blocker.solids)) throw new Error("Invalid geometry solid selection");
            for (const index of blocker.solids)
              if (!Number.isInteger(index) || index < 0 || index >= piece.solids.length)
                throw new Error("Invalid geometry solid index");
          }
        } else if (blocker.shape === "hull") {
          if (piece.hull === undefined) throw new Error(`Missing geometry hull: ${blocker.id}`);
        } else if (blocker.shape === "prism") {
          finite(blocker.bottom, "prism bottom");
          finite(blocker.top, "prism top");
          if (blocker.top < blocker.bottom) throw new Error("Invalid geometry prism interval");
        } else if (blocker.shape !== "footprint") throw new Error("Invalid terrain geometry shape");
      } else if (blocker.shape !== "body" && blocker.shape !== "footprint")
        throw new Error("Invalid body geometry shape");
      return {
        ref: { kind: blocker.kind, id: blocker.id },
        key: JSON.stringify([blocker.kind, blocker.id]),
        shape,
        blocker,
      };
    });
  }

  function intersections(
    a: Vec2,
    b: Vec2,
    blockers: readonly GeometryBlocker[],
    twoD: boolean,
    aZ: number,
    bZ: number,
  ) {
    const selected = select(blockers, twoD);
    const nearest = new Map<string, { ref: GeometryRef; t: number }>();
    // One scratch segment serves all selected objects; no per-object vectors.
    const ray: LocalSegment = {
      x: 0,
      y: 0,
      z: 0,
      dx: 0,
      dy: 0,
      dz: 0,
      tolerance: GEOMETRY_EPSILON / Math.max(GEOMETRY_EPSILON, Math.hypot(b.x - a.x, b.y - a.y, bZ - aZ)),
    };
    for (const selection of selected) {
      const t = contact(a, b, selection, ray, aZ, bZ);
      if (t === Infinity) continue;
      const prior = nearest.get(selection.key);
      if (!prior || t < prior.t) nearest.set(selection.key, { ref: selection.ref, t });
    }
    return Array.from(nearest.values()).sort((a, b) => a.t - b.t || compareRefs(a.ref, b.ref));
  }

  return {
    segment(a, b, blockers) {
      point3(a);
      point3(b);
      return intersections(a, b, blockers, false, a.z, b.z).map(({ ref, t }) => ({
        object: copyRef(ref),
        t,
        point: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t },
      }));
    },
    segment2D(a, b, blockers) {
      point2(a);
      point2(b);
      return intersections(a, b, blockers, true, 0, 0).map(({ ref, t }) => ({
        object: copyRef(ref),
        t,
        point: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t },
      }));
    },
    sample(observer, target, options) {
      if (!options || !["body", "height", "footprint"].includes(options.mode))
        throw new Error("Invalid geometry sample mode");
      const from = resolve({ kind: "model", id: observer });
      const to = resolve({ kind: "model", id: target });
      const twoD = options.mode === "footprint";
      if (options.eyes !== undefined) {
        if (twoD) throw new Error("Footprint samples do not accept eyes");
        if (!Array.isArray(options.eyes) || options.eyes.length === 0)
          throw new Error("Invalid geometry eyes");
        for (const eye of options.eyes) point3(eye);
      }
      const selected = select(options.blockers, twoD);
      const fromSamples = samplesOf(from);
      const toSamples = samplesOf(to);
      const eyes =
        options.eyes ??
        (twoD
          ? [fromSamples.footprint[0]!]
          : options.mode === "height"
            ? fromSamples.heightEye
            : fromSamples.eyes);
      const points = twoD
        ? toSamples.footprint
        : options.mode === "height"
          ? toSamples.height
          : toSamples.body;
      const seen = new Uint8Array(selected.length);
      // Reused for every ray and selected shape, never exposed to callers.
      const ray: LocalSegment = { x: 0, y: 0, z: 0, dx: 0, dy: 0, dz: 0, tolerance: 0 };
      let clear = 0;
      for (const eye of eyes) {
        for (const point of points) {
          ray.tolerance =
            GEOMETRY_EPSILON /
            Math.max(
              GEOMETRY_EPSILON,
              Math.hypot(point.x - eye.x, point.y - eye.y, twoD ? 0 : point.z - eye.z),
            );
          let blocked = false;
          // Do not stop at the first obstruction: every contacting object is reported.
          for (let i = 0; i < selected.length; i++) {
            if (contact(eye, point, selected[i]!, ray, twoD ? 0 : eye.z, twoD ? 0 : point.z) !== Infinity) {
              seen[i] = 1;
              blocked = true;
            }
          }
          if (!blocked) clear++;
        }
      }
      const blockers = new Map<string, GeometryRef>();
      for (let i = 0; i < selected.length; i++)
        if (seen[i]) blockers.set(selected[i]!.key, copyRef(selected[i]!.ref));
      const total = eyes.length * points.length;
      return {
        clear,
        total,
        fraction: clear / total,
        anyClear: clear > 0,
        allClear: clear === total,
        blockers: Array.from(blockers.values()).sort(compareRefs),
      };
    },
    contains(object, point) {
      point2(point);
      return footprintContains(resolve(object).footprint, point);
    },
    overlaps(a, b) {
      return footprintsOverlap(resolve(a).footprint, resolve(b).footprint);
    },
    height(object) {
      return resolve(object).height;
    },
  };
}
