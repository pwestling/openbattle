// The camera: right-drag turns around the table, middle-drag or the arrow keys slide, the wheel
// zooms, T looks straight down and H goes back to your table edge (ADR-017). It is yours alone:
// nothing here becomes an action.
import { MathUtils, PerspectiveCamera, Vector3 } from "three";

export class Camera {
  readonly camera = new PerspectiveCamera(45, 1, 0.1, 2000);
  private target = new Vector3();
  private yaw = 0;
  private pitch = 0.9;
  private distance = 60;
  private held = new Set<string>();
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
    this.apply();
  }

  /** Straight down onto the table. */
  topDown() {
    this.pitch = Math.PI / 2 - 0.0001;
    this.apply();
  }

  turn(dx: number, dy: number) {
    this.yaw -= dx * 0.006;
    this.pitch = MathUtils.clamp(this.pitch + dy * 0.006, 0.08, Math.PI / 2 - 0.0001);
    this.apply();
  }

  /** Slide by a screen-space amount, scaled to how far away the table is. */
  slide(dx: number, dy: number) {
    const k = this.distance * 0.0016;
    const right = new Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const forward = new Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    this.target.addScaledVector(right, -dx * k).addScaledVector(forward, dy * k);
    this.target.x = MathUtils.clamp(this.target.x, -20, this.size.width + 20);
    this.target.z = MathUtils.clamp(this.target.z, -this.size.depth - 20, 20);
    this.apply();
  }

  zoom(delta: number) {
    this.distance = MathUtils.clamp(this.distance * Math.exp(delta * 0.001), 3, 400);
    this.apply();
  }

  keyDown(key: string) {
    if (key === "t" || key === "T") this.topDown();
    else if (key === "h" || key === "H") this.home();
    else if (key.startsWith("Arrow")) this.held.add(key);
  }

  keyUp(key: string) {
    this.held.delete(key);
  }

  /** Called every frame: slides while arrow keys are held. */
  tick(seconds: number) {
    const s = 600 * seconds;
    if (this.held.has("ArrowLeft")) this.slide(s, 0);
    if (this.held.has("ArrowRight")) this.slide(-s, 0);
    if (this.held.has("ArrowUp")) this.slide(0, s);
    if (this.held.has("ArrowDown")) this.slide(0, -s);
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
