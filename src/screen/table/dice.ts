// The dice tray's own little 3D scene: dice are thrown in, tumble, land on the result the record
// holds, then line up sorted. The result is decided before the throw (ADR-002); this is only how
// it is shown.
import {
  AmbientLight,
  CanvasTexture,
  Color,
  DirectionalLight,
  Euler,
  Mesh,
  MeshStandardMaterial,
  OrthographicCamera,
  PlaneGeometry,
  Quaternion,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from "three";
import { geometryOf, polyhedronFor } from "./polyhedra.ts";

function faceTexture(value: number, colour: string, ink: string): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const g = canvas.getContext("2d")!;
  g.fillStyle = colour;
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = ink;
  g.font = `bold ${value >= 100 ? 24 : value >= 10 ? 32 : 40}px system-ui, sans-serif`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(String(value), 32, 35);
  if (value === 6 || value === 9) g.fillRect(20, 52, 24, 4);
  const t = new CanvasTexture(canvas);
  t.colorSpace = SRGBColorSpace;
  return t;
}

interface Die {
  mesh: Mesh;
  from: Vector3;
  land: Vector3;
  line: Vector3;
  spin: Quaternion;
  rest: Quaternion;
  /** Lying as it does in the line: the result up, and its number upright for someone looking down at the tray. */
  upright: Quaternion;
}

const THROW = 1.1;
const LINE_UP = 0.45;

export class DiceTray {
  private renderer: WebGLRenderer;
  private scene = new Scene();
  private camera = new OrthographicCamera(-6, 6, 3, -3, 0.1, 100);
  private dice: Die[] = [];
  private clock = 0;
  private frame = 0;
  private last = performance.now();
  private done: (() => void) | null = null;
  /** Frames are only drawn while dice move, or after a change. */
  private dirty = true;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.scene.add(new AmbientLight("#ffffff", 1.6));
    const light = new DirectionalLight("#ffffff", 2);
    light.position.set(3, 10, 6);
    this.scene.add(light);
    const felt = new Mesh(new PlaneGeometry(40, 20), new MeshStandardMaterial({ color: new Color("#2c4a2a"), roughness: 1 }));
    felt.rotation.x = -Math.PI / 2;
    this.scene.add(felt);
    this.camera.position.set(0, 20, 6);
    this.camera.lookAt(0, 0, 0);
    this.fit();
    const loop = () => {
      const now = performance.now();
      const moving = this.tick(Math.min(0.05, (now - this.last) / 1000));
      this.last = now;
      if (moving || this.dirty) this.renderer.render(this.scene, this.camera);
      this.dirty = false;
      this.frame = requestAnimationFrame(loop);
    };
    loop();
  }

  fit() {
    const canvas = this.renderer.domElement;
    const w = canvas.clientWidth || 300;
    const h = canvas.clientHeight || 120;
    this.renderer.setSize(w, h, false);
    const half = 3.2;
    this.camera.left = (-half * w) / h;
    this.camera.right = (half * w) / h;
    this.camera.top = half;
    this.camera.bottom = -half;
    this.camera.updateProjectionMatrix();
    this.dirty = true;
  }

  /** Throws dice that land showing these results; calls back once they have lined up. */
  throw(results: number[], sides: number, colour: string, done: () => void) {
    this.clear();
    this.clock = 0;
    this.done = done;
    const n = results.length;
    const across = this.camera.right * 0.85;
    const perRow = Math.max(1, Math.floor((across * 2) / 1.3));
    const rows = Math.ceil(n / perRow);
    const size = Math.min(1.2, (across * 2) / Math.max(1, Math.min(n, perRow)) / 1.3, 5 / rows / 1.3);
    const sorted = [...results].sort((a, b) => a - b);
    const slots = new Map<number, number[]>();
    sorted.forEach((v, i) => slots.set(v, [...(slots.get(v) ?? []), i]));
    const ink = new Color(colour).getHSL({ h: 0, s: 0, l: 0 }).l > 0.6 ? "#111111" : "#ffffff";
    // One material per number, shared by every die in the throw: a thousand dice would otherwise
    // make thousands of textures and could lose the graphics context.
    const made = new Map<number, MeshStandardMaterial>();
    const face = (v: number) => {
      let m = made.get(v);
      if (!m) made.set(v, (m = new MeshStandardMaterial({ map: faceTexture(v, colour, ink), roughness: 0.5 })));
      return m;
    };
    results.forEach((value, i) => {
      // Any number of sides is drawn as the closest real die; its result is on the top face.
      const { shape, sides: real } = polyhedronFor(sides);
      let labels: number[];
      let up: number;
      if (sides === real) {
        labels = shape.labels;
        up = labels.indexOf(value);
      } else {
        // Not a real die: the result on top, with other numbers around it.
        up = 0;
        labels = shape.faces.map((_, f) => (f === 0 ? value : ((value + f * 7) % sides) + 1));
      }
      const top = shape.faces[up]!;
      const toUp = new Quaternion().setFromUnitVectors(top.normal, new Vector3(0, 1, 0));
      const radius = size * shape.fit;
      const half = shape.inradius * radius;
      const mesh = new Mesh(
        geometryOf(shape, radius),
        labels.map((v) => face(v)),
      );
      // The face showing the result turns to point up, with a random twist around the vertical.
      const rest = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), (Math.random() - 0.5) * 1.2).multiply(toUp);
      // Turned about the vertical until the number's top points away from the viewer.
      const turned = top.up.clone().applyQuaternion(toUp);
      const twist = Math.atan2(turned.z, turned.x) - Math.atan2(-1, 0);
      const upright = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), twist).multiply(toUp);
      const slot = slots.get(value)!.shift()!;
      const row = Math.floor(slot / perRow);
      const inRow = Math.min(perRow, n - row * perRow);
      const line = new Vector3(((slot % perRow) - (inRow - 1) / 2) * size * 1.3, half, (row - (rows - 1) / 2) * size * 1.3);
      const land = new Vector3((Math.random() - 0.5) * across * 1.6, half, (Math.random() - 0.5) * 3);
      const from = new Vector3(-across - 2 + Math.random(), 4 + Math.random() * 2, 2 + Math.random() * 2);
      const spin = new Quaternion().setFromEuler(new Euler(Math.random() * 9, Math.random() * 9, Math.random() * 9));
      mesh.position.copy(from);
      this.scene.add(mesh);
      this.dice.push({ mesh, from, land, line, spin, rest, upright });
    });
  }

  /** Moves the dice on; true while they are moving. */
  private tick(seconds: number): boolean {
    if (!this.dice.length || this.clock > THROW + LINE_UP) return false;
    this.clock += seconds;
    const t = Math.min(1, this.clock / THROW);
    const ease = 1 - (1 - t) ** 3;
    for (const d of this.dice) {
      if (this.clock <= THROW) {
        d.mesh.position.lerpVectors(d.from, d.land, ease);
        // Two bounces on the way down.
        d.mesh.position.y = d.land.y + Math.abs(Math.cos(t * Math.PI * 2.5)) * (1 - t) ** 2 * 3;
        d.mesh.quaternion.slerpQuaternions(d.spin, d.rest, ease);
      } else {
        const k = Math.min(1, (this.clock - THROW) / LINE_UP);
        d.mesh.position.lerpVectors(d.land, d.line, k * k * (3 - 2 * k));
        // Lining up, each die also turns to sit square and upright.
        d.mesh.quaternion.slerpQuaternions(d.rest, d.upright, k * k * (3 - 2 * k));
      }
    }
    if (this.clock > THROW + LINE_UP && this.done) {
      const done = this.done;
      this.done = null;
      done();
    }
    return true;
  }

  /** Takes the last throw's dice away, freeing their textures: a big roll makes many. */
  private clear() {
    for (const d of this.dice) {
      this.scene.remove(d.mesh);
      d.mesh.geometry.dispose();
      for (const m of d.mesh.material as MeshStandardMaterial[]) {
        m.map?.dispose();
        m.dispose();
      }
    }
    this.dice = [];
  }

  dispose() {
    this.clear();
    cancelAnimationFrame(this.frame);
    this.renderer.dispose();
  }
}
