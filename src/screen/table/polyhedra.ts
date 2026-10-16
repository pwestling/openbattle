// The solid shapes real dice come in (d4, d6, d8, d10, d12, d20), built as faces so each face can
// carry its own number. A die of any other number of sides is drawn as the closest real shape.
import { BufferGeometry, Float32BufferAttribute, Vector3 } from "three";

export interface Face {
  /** Corners, anticlockwise seen from outside, on a shape of circumradius 1. */
  corners: Vector3[];
  normal: Vector3;
  centre: Vector3;
  /** Which way a number on this face reads as upright, lying in the face. */
  up: Vector3;
  right: Vector3;
}

export interface Polyhedron {
  faces: Face[];
  /** How far every face is from the middle: the height the shape stands at when resting on a face. */
  inradius: number;
  /** The numbers 1 to the face count laid out as on a real die: opposite faces add up to one more than the count. */
  labels: number[];
  /** What to multiply the die's nominal size by to get this shape's circumradius. */
  fit: number;
}

const PHI = (1 + Math.sqrt(5)) / 2;
const unit = (v: Vector3) => v.clone().normalize();

/** A face from corners in any order: put anticlockwise seen from outside, with its own up and right. */
function face(corners: Vector3[], normal: Vector3): Face {
  const centre = corners.reduce((sum, v) => sum.add(v), new Vector3()).divideScalar(corners.length);
  const e1 = corners[0]!.clone().sub(centre).normalize();
  const e2 = normal.clone().cross(e1);
  const angle = (v: Vector3) => Math.atan2(v.clone().sub(centre).dot(e2), v.clone().sub(centre).dot(e1));
  const ordered = [...corners].sort((a, b) => angle(a) - angle(b));
  const up = ordered[0]!.clone().add(ordered[1]!).multiplyScalar(0.5).sub(centre).normalize();
  return { corners: ordered, normal, centre, up, right: up.clone().cross(normal) };
}

/** The faces of a convex solid given its corners and the direction each face looks. */
function fromNormals(corners: Vector3[], normals: Vector3[]): Face[] {
  return normals.map((n) => {
    const normal = unit(n);
    const reach = Math.max(...corners.map((v) => v.dot(normal)));
    return face(
      corners.filter((v) => v.dot(normal) > reach - 1e-6),
      normal,
    );
  });
}

function solid(faces: Face[], fit: number): Polyhedron {
  const labels = new Array<number>(faces.length).fill(0);
  const opposite = faces.map((f) => faces.findIndex((g) => g.normal.dot(f.normal) < -0.999));
  let next = 1;
  faces.forEach((_, i) => {
    if (labels[i]) return;
    labels[i] = next++;
    // Opposite faces of a real die add up to one more than its number of faces.
    if (opposite[i]! >= 0) labels[opposite[i]!] = faces.length + 1 - labels[i]!;
  });
  return { faces, inradius: faces[0]!.centre.length(), labels, fit };
}

function tetrahedron(): Polyhedron {
  const corners = [new Vector3(1, 1, 1), new Vector3(1, -1, -1), new Vector3(-1, 1, -1), new Vector3(-1, -1, 1)].map(unit);
  return solid(fromNormals(corners, corners.map((v) => v.clone().negate())), 0.7);
}

function cube(): Polyhedron {
  const corners = Array.from({ length: 8 }, (_, i) => new Vector3(i & 1 ? 1 : -1, i & 2 ? 1 : -1, i & 4 ? 1 : -1).normalize());
  const axes = [new Vector3(1, 0, 0), new Vector3(-1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, -1, 0), new Vector3(0, 0, 1), new Vector3(0, 0, -1)];
  return solid(fromNormals(corners, axes), 0.866);
}

function octahedron(): Polyhedron {
  const corners = [new Vector3(1, 0, 0), new Vector3(-1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, -1, 0), new Vector3(0, 0, 1), new Vector3(0, 0, -1)];
  const normals: Vector3[] = [];
  for (const x of [1, -1]) for (const y of [1, -1]) for (const z of [1, -1]) normals.push(new Vector3(x, y, z));
  return solid(fromNormals(corners, normals), 0.66);
}

function icosahedronCorners(): Vector3[] {
  const corners: Vector3[] = [];
  for (const a of [1, -1]) {
    for (const b of [PHI, -PHI]) corners.push(new Vector3(0, a, b), new Vector3(a, b, 0), new Vector3(b, 0, a));
  }
  return corners.map(unit);
}

function icosahedron(): Polyhedron {
  const corners = icosahedronCorners();
  const edge = 2 / Math.sqrt(1 + PHI * PHI);
  const normals: Vector3[] = [];
  for (let i = 0; i < 12; i++)
    for (let j = i + 1; j < 12; j++)
      for (let k = j + 1; k < 12; k++) {
        const [a, b, c] = [corners[i]!, corners[j]!, corners[k]!];
        if ([a.distanceTo(b), b.distanceTo(c), a.distanceTo(c)].every((d) => Math.abs(d - edge) < 1e-6)) normals.push(a.clone().add(b).add(c));
      }
  return solid(fromNormals(corners, normals), 0.6);
}

function dodecahedron(): Polyhedron {
  // Its corners are the directions of the icosahedron's faces, and its faces those of its corners.
  const ico = icosahedron();
  const corners = ico.faces.map((f) => f.normal);
  return solid(fromNormals(corners, icosahedronCorners()), 0.6);
}

/** The ten kite faces of a pentagonal trapezohedron: two apexes and a zigzag ring between them. */
function trapezohedron(): Polyhedron {
  // The ring sits this far above and below the middle so each kite is flat.
  const h = 0.10557;
  const ring = Array.from({ length: 10 }, (_, k) => new Vector3(Math.cos((k * Math.PI) / 5), k % 2 === 0 ? h : -h, Math.sin((k * Math.PI) / 5)));
  const top = new Vector3(0, 1, 0);
  const bottom = new Vector3(0, -1, 0);
  const kites: Vector3[][] = [];
  for (let i = 0; i < 5; i++) {
    kites.push([top, ring[2 * i]!, ring[2 * i + 1]!, ring[(2 * i + 2) % 10]!]);
    kites.push([bottom, ring[2 * i + 1]!, ring[(2 * i + 2) % 10]!, ring[(2 * i + 3) % 10]!]);
  }
  const faces = kites.map((corners) => {
    const [a, b, c] = [corners[1]!, corners[2]!, corners[3]!];
    const normal = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
    if (normal.dot(corners[0]!.clone().add(b)) < 0) normal.negate();
    return face(corners, normal);
  });
  return solid(faces, 0.62);
}

const real: [number, () => Polyhedron][] = [
  [4, tetrahedron],
  [6, cube],
  [8, octahedron],
  [10, trapezohedron],
  [12, dodecahedron],
  [20, icosahedron],
];
const made = new Map<number, Polyhedron>();

/** The real die closest to this many sides, and how many sides it really has; a tie goes to the bigger. */
export function polyhedronFor(sides: number): { shape: Polyhedron; sides: number } {
  let best = real[0]!;
  for (const r of real) if (Math.abs(r[0] - sides) <= Math.abs(best[0] - sides)) best = r;
  let shape = made.get(best[0]);
  if (!shape) made.set(best[0], (shape = best[1]()));
  return { shape, sides: best[0] };
}

/**
 * A solid's triangles, one group per face so each face takes its own material. A face's picture is
 * laid out upright around its middle, a little larger than the face.
 */
export function geometryOf(shape: Polyhedron, radius: number): BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const geometry = new BufferGeometry();
  let start = 0;
  shape.faces.forEach((f, index) => {
    const reach = Math.max(...f.corners.map((v) => v.distanceTo(f.centre)));
    const scale = 1 / (reach * 2.1);
    let count = 0;
    const push = (v: Vector3) => {
      positions.push(v.x * radius, v.y * radius, v.z * radius);
      normals.push(f.normal.x, f.normal.y, f.normal.z);
      const d = v.clone().sub(f.centre);
      uvs.push(0.5 + d.dot(f.right) * scale, 0.5 + d.dot(f.up) * scale);
      count++;
    };
    for (let i = 1; i < f.corners.length - 1; i++) {
      push(f.corners[0]!);
      push(f.corners[i]!);
      push(f.corners[i + 1]!);
    }
    geometry.addGroup(start, count, index);
    start += count;
  });
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new Float32BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  return geometry;
}
