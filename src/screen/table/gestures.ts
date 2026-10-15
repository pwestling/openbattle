// How mouse and keyboard on the table become camera moves and, later, actions.
import type { TableView } from "./view.ts";

export class Gestures {
  private orbit: { button: number; x: number; y: number } | null = null;
  private off: (() => void)[] = [];

  private view: TableView;

  constructor(view: TableView) {
    this.view = view;
    const el = view.renderer.domElement;
    const on = <K extends keyof HTMLElementEventMap>(
      target: HTMLElement | Window,
      type: K,
      handler: (e: HTMLElementEventMap[K]) => void,
      options?: AddEventListenerOptions,
    ) => {
      target.addEventListener(type, handler as EventListener, options);
      this.off.push(() => target.removeEventListener(type, handler as EventListener));
    };
    on(el, "contextmenu", (e) => e.preventDefault());
    on(el, "pointerdown", (e) => this.down(e));
    on(window, "pointermove", (e) => this.move(e));
    on(window, "pointerup", (e) => this.up(e));
    on(el, "wheel", (e) => this.wheel(e), { passive: false });
    on(window, "keydown", (e) => this.keyDown(e));
    on(window, "keyup", (e) => this.view.camera.keyUp(e.key));
  }

  private typing(e: KeyboardEvent) {
    const t = e.target as HTMLElement | null;
    return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
  }

  private down(e: PointerEvent) {
    this.view.renderer.domElement.focus();
    if (e.button === 2 || e.button === 1) this.orbit = { button: e.button, x: e.clientX, y: e.clientY };
  }

  private move(e: PointerEvent) {
    if (!this.orbit) return;
    const dx = e.clientX - this.orbit.x;
    const dy = e.clientY - this.orbit.y;
    this.orbit.x = e.clientX;
    this.orbit.y = e.clientY;
    if (this.orbit.button === 2) this.view.camera.turn(dx, dy);
    else this.view.camera.slide(dx, dy);
  }

  private up(e: PointerEvent) {
    if (this.orbit?.button === e.button) this.orbit = null;
  }

  private wheel(e: WheelEvent) {
    e.preventDefault();
    this.view.camera.zoom(e.deltaY);
  }

  private keyDown(e: KeyboardEvent) {
    if (this.typing(e)) return;
    if (e.key.startsWith("Arrow")) e.preventDefault();
    this.view.camera.keyDown(e.key);
  }

  dispose() {
    this.off.forEach((f) => f());
  }
}
