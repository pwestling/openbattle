// The camera, with Tabletop Simulator's keys (ADR-017): right-drag or the arrow keys turn around
// the table, middle-drag or WASD slide, the wheel zooms, Z (or a middle-click) zooms to the pointer
// and back, P toggles straight down and Space goes back to your table edge. T and H do the same as
// P and Space. It is yours alone: nothing here becomes an action.
import { MathUtils, PerspectiveCamera, Vector3 } from "three";

export class Camera {
  readonly camera = new PerspectiveCamera(45, 1, 0.1, 2000);
  private target = new Vector3();
  private yaw = 0;
  private pitch = 0.9;
  private distance = 60;
  private held = new Set<string>();
  /** Where the view was before P looked straight down, or Z zoomed to the pointer. */
  private beforeTopDown: number | null = null;
  private beforeZoomIn: { target: Vector3; distance: number } | null = null;
  private changed = true;
  private size: { width: number; depth: number };
  /** Which table edge is yours: +1 is the far edge (y = depth), -1 the near edge (y = 0), 0 a side. */
  private edge: number;

  constructor(size: { width: number; depth: number }, edge: number) {
    this.size = size;
    this.edge = edge;
    this.home();
  }

  setEdge(edge: number) {
    if (edge === this.edge) return;
    this.edge = edge;
    this.home();
  }

  /** Back to your table edge, looking across the table. */
  home() {
    // A little toward your edge, so your decks and the strip in front of the table are in view.
    this.target.set(this.size.width / 2, 0, -this.size.depth / 2 - this.edge * 0.12 * this.size.depth);
    this.yaw = this.edge < 0 ? 0 : this.edge > 0 ? Math.PI : Math.PI / 2;
    this.pitch = 0.9;
    this.distance = Math.max(this.size.width, this.size.depth) * 1.15;
    this.beforeTopDown = null;
    this.beforeZoomIn = null;
    this.apply();
  }

  /** Straight down onto the table. */
  topDown() {
    this.beforeTopDown = null;
    this.pitch = Math.PI / 2 - 0.0001;
    this.apply();
  }

  /** Straight down, or back to the angle from before. */
  toggleTopDown() {
    if (this.beforeTopDown !== null) {
      this.pitch = this.beforeTopDown;
      this.beforeTopDown = null;
      return this.apply();
    }
    const was = this.pitch;
    this.topDown();
    this.beforeTopDown = was;
  }

  /** Close in on a spot (three coordinates), or back out to where the view was. */
  toggleZoomTo(spot: Vector3 | null) {
    if (this.beforeZoomIn) {
      this.target.copy(this.beforeZoomIn.target);
      this.distance = this.beforeZoomIn.distance;
      this.beforeZoomIn = null;
      return this.apply();
    }
    if (!spot) return;
    this.beforeZoomIn = { target: this.target.clone(), distance: this.distance };
    this.target.copy(spot);
    this.distance = Math.max(3, this.distance * 0.3);
    this.apply();
  }

  turn(dx: number, dy: number) {
    if (dy) this.beforeTopDown = null;
    this.yaw -= dx * 0.006;
    this.pitch = MathUtils.clamp(this.pitch + dy * 0.006, 0.08, Math.PI / 2 - 0.0001);
    this.apply();
  }

  /** Slide by a screen-space amount, scaled to how far away the table is. */
  slide(dx: number, dy: number) {
    this.beforeZoomIn = null;
    const k = this.distance * 0.0016;
    const right = new Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const forward = new Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    this.target.addScaledVector(right, -dx * k).addScaledVector(forward, dy * k);
    this.apply();
  }

  zoom(delta: number) {
    this.beforeZoomIn = null;
    // No farthest zoom (ADR-020); H always brings the view home.
    this.distance = Math.max(3, this.distance * Math.exp(delta * 0.001));
    this.apply();
  }

  /** A key by what it types, and where it is: WASD go by place, so other layouts and Option still work. */
  keyDown(key: string, code: string) {
    const k = key.length === 1 ? key.toLowerCase() : key;
    if (k === "t") this.topDown();
    else if (k === "p") this.toggleTopDown();
    else if (k === "h" || k === " ") this.home();
    else if (held.has(code)) this.held.add(code);
  }

  keyUp(code: string) {
    this.held.delete(code);
  }

  /** Forgets held keys, as when the window loses focus and their release goes unseen. */
  releaseKeys() {
    this.held.clear();
  }

  /** Called every frame: slides while WASD are held, turns while the arrow keys are. */
  tick(seconds: number) {
    const s = 600 * seconds;
    if (this.held.has("KeyA")) this.slide(s, 0);
    if (this.held.has("KeyD")) this.slide(-s, 0);
    if (this.held.has("KeyW")) this.slide(0, s);
    if (this.held.has("KeyS")) this.slide(0, -s);
    const r = 250 * seconds;
    if (this.held.has("ArrowLeft")) this.turn(-r, 0);
    if (this.held.has("ArrowRight")) this.turn(r, 0);
    if (this.held.has("ArrowUp")) this.turn(0, r);
    if (this.held.has("ArrowDown")) this.turn(0, -r);
  }

  aspect(width: number, height: number) {
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
    this.changed = true;
  }

  /** Whether the camera moved since this was last asked. */
  takeChanged(): boolean {
    const was = this.changed;
    this.changed = false;
    return was;
  }

  private apply() {
    this.changed = true;
    // Far enough to see the table from however far out the camera is.
    const far = Math.max(2000, (this.distance + Math.hypot(this.size.width, this.size.depth)) * 2);
    if (far !== this.camera.far) {
      this.camera.far = far;
      this.camera.updateProjectionMatrix();
    }
    const c = Math.cos(this.pitch);
    // yaw 0 looks from the near edge (y = 0) across the table.
    this.camera.position.set(
      this.target.x + this.distance * c * Math.sin(this.yaw),
      this.target.y + this.distance * Math.sin(this.pitch),
      this.target.z + this.distance * c * Math.cos(this.yaw),
    );
    // Looking straight down, "up" on screen is away from your edge.
    if (this.pitch < Math.PI / 2 - 0.01) this.camera.up.set(0, 1, 0);
    else this.camera.up.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    this.camera.lookAt(this.target);
  }
}

/** The keys that move the camera while held. */
const held = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]);
