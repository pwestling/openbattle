// Reading mesh files (.glb, .gltf, .obj, .stl) into three.js, and fitting them to a piece's size.
// A mesh is read with +y up, x across and -z into the table, as Measure reads it.
import { Box3, BufferGeometry, Group, Mesh, MeshStandardMaterial, Vector3, type Object3D } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import type { Mesh as Mesh3 } from "../../measure/index.ts";
import type { Fingerprint } from "../../record/index.ts";
import { getFile } from "../stand-ins.ts";

export interface ReadMesh {
  object: Object3D;
  /** Every triangle's corners, in the file's own units, for Measure. */
  positions: Float32Array;
  /** How big the mesh is in inches, as the file means it (STL files are millimetres). */
  natural: { width: number; depth: number; height: number };
}

const stone = () => new MeshStandardMaterial({ color: "#8a8478", roughness: 0.9 });

/** Reads a mesh file, telling the format from its bytes. Rejects if it is not a readable mesh. */
export async function readMesh(file: Blob): Promise<ReadMesh> {
  try {
    return await read(file);
  } catch {
    throw new Error("That file is not a readable mesh.");
  }
}

async function read(file: Blob): Promise<ReadMesh> {
  const bytes = await file.arrayBuffer();
  const head = new TextDecoder().decode(bytes.slice(0, 512));
  let object: Object3D;
  let inches = 1;
  if (head.startsWith("glTF") || head.trimStart().startsWith("{")) {
    const gltf = await new GLTFLoader().parseAsync(head.startsWith("glTF") ? bytes : new TextDecoder().decode(bytes), "");
    object = gltf.scene;
  } else if (/^\s*(v|vn|vt|o|g|f|mtllib|usemtl|#)\s/m.test(head) && !head.trimStart().startsWith("solid")) {
    object = new OBJLoader().parse(new TextDecoder().decode(bytes));
  } else {
    const geometry = new STLLoader().parse(bytes);
    if (!geometry.getAttribute("position")?.count) throw new Error("That file is not a readable mesh.");
    object = new Mesh(geometry, stone());
    inches = 1 / 25.4;
  }
  object.updateMatrixWorld(true);
  const corners: number[] = [];
  const v = new Vector3();
  object.traverse((o) => {
    if (!(o instanceof Mesh)) return;
    const g = o.geometry as BufferGeometry;
    const position = g.getAttribute("position");
    const index = g.getIndex();
    const count = index ? index.count : position.count;
    for (let i = 0; i < count; i++) {
      v.fromBufferAttribute(position, index ? index.getX(i) : i).applyMatrix4(o.matrixWorld);
      corners.push(v.x, v.y, v.z);
    }
  });
  if (corners.length < 9) throw new Error("That file is not a readable mesh.");
  const size = new Box3().setFromObject(object).getSize(new Vector3());
  return {
    object,
    positions: new Float32Array(corners),
    natural: { width: size.x * inches, depth: size.z * inches, height: size.y * inches },
  };
}

const cache = new Map<Fingerprint, Promise<ReadMesh | null>>();

/** The mesh a fingerprint names, once this browser has its file; null if it hasn't. */
export function meshOf(fingerprint: Fingerprint): Promise<ReadMesh | null> {
  let found = cache.get(fingerprint);
  if (!found) {
    found = getFile(fingerprint)
      .then((f) => (f ? readMesh(f) : null))
      .catch(() => null);
    void found.then((m) => !m && cache.delete(fingerprint));
    cache.set(fingerprint, found);
  }
  return found;
}

/** A copy of a mesh stretched to a size, centred across and standing on 0, as Measure stretches it. */
export function fitted(mesh: ReadMesh, size: { width: number; depth: number; height: number }): Object3D {
  const copy = mesh.object.clone(true);
  const box = new Box3().setFromObject(copy);
  const s = box.getSize(new Vector3());
  const centre = box.getCenter(new Vector3());
  copy.position.set(-centre.x, -box.min.y, -centre.z);
  const holder = new Group();
  holder.add(copy);
  holder.scale.set(s.x ? size.width / s.x : 1, s.y ? size.height / s.y : 1, s.z ? size.depth / s.z : 1);
  const outer = new Group();
  outer.add(holder);
  return outer;
}

/** A copy of a mesh scaled evenly to a height, centred on its base. */
export function standing(mesh: ReadMesh, height: number): Object3D {
  const s = new Box3().setFromObject(mesh.object).getSize(new Vector3());
  const k = s.y ? height / s.y : 1;
  return fitted(mesh, { width: s.x * k, depth: s.z * k, height });
}

/** A geometry's triangles, as Measure reads a mesh. */
export function trianglesOf(geometry: BufferGeometry): Mesh3 {
  const position = geometry.getAttribute("position");
  const index = geometry.getIndex();
  const positions = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) positions.set([position.getX(i), position.getY(i), position.getZ(i)], i * 3);
  return index ? { positions, indices: new Uint32Array(index.array) } : { positions };
}
