// How mouse and keyboard on the table become camera moves, selection, carrying and the ruler.
// Controls follow Tabletop Simulator's where it has one (ADR-017):
//   left-click selects; click again or double-click selects the whole unit; left-drag on the
//   table draws a box; left-drag on a model lifts and carries the selection; Q and E turn it;
//   right-drag turns the camera; middle-drag or arrows slide it; the wheel zooms.
// Where it has none, the screen picks: hold Tab for the ruler; Space or right-click pins a
// waypoint; Page Up and Page Down (or Shift with the wheel) step between floors while carrying;
// Escape puts a carried selection back.
import { Plane, Raycaster, Vector2, Vector3, type Object3D } from "three";
import type { Action, FloorRef, Point, Table } from "../../record/index.ts";
import { distance, type Spot } from "../stand-ins.ts";
import { Guides, type Guide } from "./guides.ts";
import { floorHeight, Pieces, type Place } from "./pieces.ts";
import type { TableView } from "./view.ts";

/** What the table needs from the game around it. */
export interface Hooks {
  act(action: Action): Promise<boolean>;
}

interface Carry {
  /** The models carried, or the one terrain piece. */
  ids: string[];
  terrain: boolean;
  starts: Map<string, Place>;
  offsets: Map<string, Point>;
  waypoints: Map<string, Point[]>;
  turn: number;
  floorStep: number;
  grab: Point;
  moved: boolean;
}

interface Ruler {
  from: Spot;
  fromPoint: Point;
  via: Point[];
  to: Spot;
  toPoint: Point;
}

/** Turns a point clockwise (seen from above) about the origin, as facing turns. */
const rotate = (p: Point, degrees: number): Point => {
  const r = (degrees * Math.PI) / 180;
  return { x: p.x * Math.cos(r) + p.y * Math.sin(r), y: -p.x * Math.sin(r) + p.y * Math.cos(r) };
};

const inside = (p: Point, outline: Point[]) => {
  let hit = false;
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const a = outline[i]!;
    const b = outline[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) hit = !hit;
  }
  return hit;
};

/** The floors under a point, highest first, ending with the table itself. */
export function floorsUnder(table: Table, p: Point): (FloorRef | null)[] {
  const found: { ref: FloorRef; height: number }[] = [];
  for (const t of Object.values(table.terrain)) {
    const local = rotate({ x: p.x - t.position.x, y: p.y - t.position.y }, -t.facing);
    t.floors.forEach((f, i) => {
      if (inside(local, f.outline)) found.push({ ref: { terrain: t.id, floor: i }, height: f.height });
    });
  }
  found.sort((a, b) => b.height - a.height);
  return [...found.map((f) => f.ref), null];
}

const inches = (n: number) => `${Math.round(n * 10) / 10}″`;

export class Gestures {
  private view: TableView;
  private pieces: Pieces;
  private guides: Guides;
  private hooks: Hooks;
  private table: Table | null = null;
  private readOnly = true;
  private colour = "#e2b04a";
  private lastMove: Guide[] = [];
  private selected = new Set<string>();
  private carried = new Map<string, Place>();
  private carry: Carry | null = null;
  private ruler: Ruler | null = null;
  private rulerKey = false;
  private press: { x: number; y: number; model: string | null; terrain: string | null; detail: number; shift: boolean } | null = null;
  private box: HTMLDivElement | null = null;
  private orbit: { button: number; x: number; y: number } | null = null;
  private pointer = new Vector2();
  private raycaster = new Raycaster();
  private off: (() => void)[] = [];

  constructor(view: TableView, pieces: Pieces, hooks: Hooks) {
    this.view = view;
    this.pieces = pieces;
    this.hooks = hooks;
    this.guides = new Guides(view);
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
    on(window, "keyup", (e) => this.keyUp(e));
    on(window, "blur", () => {
      this.rulerKey = false;
      this.ruler = null;
      this.redraw();
    });
  }

  /** A new moment to show. The latest move's paths stay drawn for everyone. */
  setTable(table: Table, readOnly: boolean, colour: string, lastMove: string[]) {
    this.table = table;
    this.readOnly = readOnly;
    this.colour = colour;
    for (const id of this.selected) if (!table.terrain[id] && (!table.models[id] || table.models[id].aside)) this.selected.delete(id);
    if (readOnly && this.carry) this.cancelCarry();
    this.lastMove = lastMove.flatMap((id) => {
      const m = table.models[id];
      if (!m || m.aside || m.path.length < 2) return [];
      const owner = table.players[table.units[m.unit]?.owner ?? ""];
      const h = floorHeight(table, m.floor);
      return [{ points: m.path.map((p) => ({ ...p, h })), colour: owner?.colour ?? "#ffffff" }];
    });
    this.redraw();
  }

  private redraw() {
    if (!this.table) return;
    this.pieces.sync(this.table, this.selected, this.carried);
    const guides: Guide[] = [...this.lastMove];
    if (this.carry?.moved) guides.push(...this.carryGuides());
    if (this.ruler) guides.push(this.rulerGuide());
    this.guides.show(guides);
  }

  // Where the pointer is.

  private aim(e: { clientX: number; clientY: number }) {
    const rect = this.view.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.view.camera.camera);
  }

  /** The model under the pointer, or failing that the terrain piece. */
  private pieceAt(e: PointerEvent): { model: string } | { terrain: string } | null {
    this.aim(e);
    const hits = this.raycaster.intersectObjects(this.pieces.objects(), true).map((h) => Pieces.pieceOf(h.object));
    return hits.find((h) => h && "model" in h) ?? hits.find((h) => h) ?? null;
  }

  private modelAt(e: PointerEvent): string | null {
    const piece = this.pieceAt(e);
    return piece && "model" in piece ? piece.model : null;
  }

  private pointAt(e: { clientX: number; clientY: number }, height = 0): Point | null {
    this.aim(e);
    const hit = this.raycaster.ray.intersectPlane(new Plane(new Vector3(0, 1, 0), -height), new Vector3());
    return hit ? { x: hit.x, y: -hit.z } : null;
  }

  // Pointer.

  private down(e: PointerEvent) {
    this.view.renderer.domElement.focus();
    if (e.button === 2 && (this.carry || this.ruler)) return this.pin();
    if (e.button === 2 || e.button === 1) {
      this.orbit = { button: e.button, x: e.clientX, y: e.clientY };
      return;
    }
    if (e.button !== 0 || !this.table) return;
    const piece = this.pieceAt(e);
    const model = piece && "model" in piece ? piece.model : null;
    if (this.rulerKey) {
      const point = this.pointAt(e);
      if (!point) return;
      const at = model ? this.table.models[model]?.position : undefined;
      const from: Spot = model ? { model } : point;
      this.ruler = { from, fromPoint: at ?? point, via: [], to: point, toPoint: point };
      this.redraw();
      return;
    }
    this.press = {
      x: e.clientX,
      y: e.clientY,
      model,
      terrain: piece && "terrain" in piece ? piece.terrain : null,
      detail: e.detail,
      shift: e.shiftKey,
    };
  }

  private move(e: PointerEvent) {
    if (this.orbit) {
      const dx = e.clientX - this.orbit.x;
      const dy = e.clientY - this.orbit.y;
      this.orbit.x = e.clientX;
      this.orbit.y = e.clientY;
      if (this.orbit.button === 2) this.view.camera.turn(dx, dy);
      else this.view.camera.slide(dx, dy);
      return;
    }
    if (this.ruler && e.buttons & 1) {
      const point = this.pointAt(e);
      if (!point || !this.table) return;
      const model = this.modelAt(e);
      this.ruler.to = model ? { model } : point;
      this.ruler.toPoint = model ? this.table.models[model]!.position : point;
      this.redraw();
      return;
    }
    if (this.carry) return this.carryTo(e);
    const press = this.press;
    if (!press || Math.hypot(e.clientX - press.x, e.clientY - press.y) < 5) return;
    if (press.model && !this.readOnly) {
      if (!this.selected.has(press.model)) this.selected = new Set([press.model]);
      this.lift(press);
      this.carryTo(e);
    } else if (press.terrain && !this.readOnly) {
      this.selected = new Set([press.terrain]);
      this.lift(press);
      this.carryTo(e);
    } else if (!press.model && !press.terrain) this.drawBox(press, e);
  }

  private up(e: PointerEvent) {
    if (this.orbit?.button === e.button) {
      this.orbit = null;
      return;
    }
    if (e.button !== 0) return;
    const press = this.press;
    this.press = null;
    if (this.carry) return void this.setDown();
    if (this.box && press) return this.finishBox(press, e);
    if (!press || !this.table) return;
    // A click: select a model, or its whole unit on a second click or a double-click.
    if (press.terrain && !press.model) this.selected = new Set([press.terrain]);
    else if (!press.model) this.selected.clear();
    else if (press.shift) {
      if (this.selected.has(press.model)) this.selected.delete(press.model);
      else this.selected.add(press.model);
    } else if (press.detail >= 2 || (this.selected.size === 1 && this.selected.has(press.model))) {
      const unit = this.table.models[press.model]?.unit;
      this.selected = new Set(
        Object.values(this.table.models)
          .filter((m) => m.unit === unit && !m.aside)
          .map((m) => m.id),
      );
    } else this.selected = new Set([press.model]);
    this.redraw();
  }

  private wheel(e: WheelEvent) {
    e.preventDefault();
    if (this.carry && e.shiftKey) return this.stepFloor(e.deltaY > 0 ? 1 : -1);
    this.view.camera.zoom(e.deltaY);
  }

  // Box selection.

  private drawBox(press: { x: number; y: number }, e: PointerEvent) {
    if (!this.box) {
      this.box = document.createElement("div");
      this.box.className = "select-box";
      this.view.host.append(this.box);
    }
    const rect = this.view.host.getBoundingClientRect();
    Object.assign(this.box.style, {
      left: `${Math.min(press.x, e.clientX) - rect.left}px`,
      top: `${Math.min(press.y, e.clientY) - rect.top}px`,
      width: `${Math.abs(e.clientX - press.x)}px`,
      height: `${Math.abs(e.clientY - press.y)}px`,
    });
  }

  private finishBox(press: { x: number; y: number }, e: PointerEvent) {
    this.box?.remove();
    this.box = null;
    if (!this.table) return;
    const rect = this.view.renderer.domElement.getBoundingClientRect();
    const [x0, x1] = [Math.min(press.x, e.clientX), Math.max(press.x, e.clientX)];
    const [y0, y1] = [Math.min(press.y, e.clientY), Math.max(press.y, e.clientY)];
    this.selected = new Set();
    for (const m of Object.values(this.table.models)) {
      if (m.aside) continue;
      const v = new Vector3(m.position.x, floorHeight(this.table, m.floor), -m.position.y).project(this.view.camera.camera);
      const sx = rect.left + ((v.x + 1) / 2) * rect.width;
      const sy = rect.top + ((1 - v.y) / 2) * rect.height;
      if (sx >= x0 && sx <= x1 && sy >= y0 && sy <= y1) this.selected.add(m.id);
    }
    this.redraw();
  }

  // Carrying.

  private lift(press: { x: number; y: number }) {
    const table = this.table!;
    const grab = this.pointAt({ clientX: press.x, clientY: press.y });
    if (!grab) return;
    const piece = [...this.selected].map((id) => table.terrain[id]).find((t) => t);
    const ids = piece ? [piece.id] : [...this.selected].filter((id) => table.models[id] && !table.models[id].aside);
    const starts = new Map<string, Place>();
    const offsets = new Map<string, Point>();
    for (const id of ids) {
      const m = table.models[id] ?? { ...table.terrain[id]!, floor: null };
      starts.set(id, { position: m.position, facing: m.facing, floor: m.floor });
      offsets.set(id, { x: m.position.x - grab.x, y: m.position.y - grab.y });
    }
    this.carry = {
      ids,
      terrain: !!piece,
      starts,
      offsets,
      waypoints: new Map(ids.map((id) => [id, []])),
      turn: 0,
      floorStep: 0,
      grab,
      moved: false,
    };
  }

  private carryTo(e: { clientX: number; clientY: number }) {
    const point = this.pointAt(e);
    if (point && this.carry) this.carry.grab = point;
    this.place();
  }

  /** Works out where each carried model is from the grab point, the turn and the chosen floor. */
  private place() {
    const c = this.carry;
    const table = this.table;
    if (!c || !table) return;
    c.moved = true;
    for (const id of c.ids) {
      const start = c.starts.get(id)!;
      const offset = rotate(c.offsets.get(id)!, c.turn);
      const position = { x: c.grab.x + offset.x, y: c.grab.y + offset.y };
      const under = c.terrain ? [null] : floorsUnder(table, position);
      const floor = under[Math.min(c.floorStep, under.length - 1)] ?? null;
      this.carried.set(id, { position, facing: (((start.facing + c.turn) % 360) + 360) % 360, floor, lift: 0.5 });
    }
    this.redraw();
  }

  private carryGuides(): Guide[] {
    const c = this.carry!;
    if (c.terrain) return [];
    const table = this.table!;
    return c.ids.map((id) => {
      const start = c.starts.get(id)!;
      const now = this.carried.get(id)!;
      const via = c.waypoints.get(id)!;
      const { across } = distance(table, start.position, now.position, via);
      const up = floorHeight(table, now.floor) - floorHeight(table, start.floor);
      const h0 = floorHeight(table, start.floor);
      const owner = table.players[table.units[table.models[id]!.unit]?.owner ?? ""];
      return {
        points: [{ ...start.position, h: h0 }, ...via.map((p) => ({ ...p, h: h0 })), { ...now.position, h: floorHeight(table, now.floor) }],
        colour: owner?.colour ?? this.colour,
        text: `${inches(across)}${Math.abs(up) >= 0.05 ? ` ${up > 0 ? "↑" : "↓"}${inches(Math.abs(up))}` : ""}`,
      };
    });
  }

  private pin() {
    if (this.carry) {
      for (const id of this.carry.ids) {
        const at = this.carried.get(id);
        if (at) this.carry.waypoints.get(id)!.push(at.position);
      }
    } else if (this.ruler) this.ruler.via.push(this.ruler.toPoint);
    this.redraw();
  }

  private stepFloor(by: number) {
    if (!this.carry) return;
    this.carry.floorStep = Math.max(0, this.carry.floorStep + by);
    this.place();
  }

  private cancelCarry() {
    this.carry = null;
    this.carried.clear();
    this.redraw();
  }

  /** Letting go sets the carried models down: one move action. */
  private async setDown() {
    const c = this.carry;
    this.carry = null;
    if (!c?.moved) return this.cancelCarry();
    const piece = c.terrain ? this.table?.terrain[c.ids[0]!] : undefined;
    if (piece) {
      const at = this.carried.get(piece.id)!;
      this.carried.set(piece.id, { ...at, lift: 0 });
      this.redraw();
      await this.hooks.act({ kind: "place terrain", terrain: { ...piece, position: at.position, facing: at.facing } });
      this.carried.delete(piece.id);
      return this.redraw();
    }
    const moves = c.ids.map((id) => {
      const at = this.carried.get(id)!;
      this.carried.set(id, { ...at, lift: 0 });
      return {
        model: id,
        position: at.position,
        facing: at.facing,
        floor: at.floor,
        path: [c.starts.get(id)!.position, ...c.waypoints.get(id)!, at.position],
      };
    });
    this.redraw();
    await this.hooks.act({ kind: "move", moves });
    // Accepted, the record now has them there; refused, they glide back to where they were.
    for (const id of c.ids) this.carried.delete(id);
    this.redraw();
  }

  // The ruler.

  private rulerGuide(): Guide {
    const r = this.ruler!;
    const table = this.table!;
    let text = "";
    try {
      const { across, up } = distance(table, r.from, r.to, r.via);
      text = `${inches(across)}${Math.abs(up) >= 0.05 ? `, ${inches(Math.abs(up))} ${up > 0 ? "up" : "down"}` : ""}`;
    } catch {
      text = "";
    }
    const h = (s: Spot) => ("model" in s ? floorHeight(table, table.models[s.model]?.floor ?? null) : 0);
    return {
      points: [{ ...r.fromPoint, h: h(r.from) }, ...r.via.map((p) => ({ ...p, h: 0 })), { ...r.toPoint, h: h(r.to) }],
      colour: "#ffffff",
      text,
    };
  }

  // Keys.

  private typing(e: KeyboardEvent) {
    const t = e.target as HTMLElement | null;
    return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
  }

  private keyDown(e: KeyboardEvent) {
    if (this.typing(e)) return;
    const key = e.key;
    if (key === "Tab") {
      e.preventDefault();
      this.rulerKey = true;
      return;
    }
    if (key === " " && (this.carry || this.ruler)) {
      e.preventDefault();
      return this.pin();
    }
    if (this.carry) {
      if (key === "q" || key === "Q") return void ((this.carry.turn -= 15), this.place());
      if (key === "e" || key === "E") return void ((this.carry.turn += 15), this.place());
      if (key === "PageUp") return void (e.preventDefault(), this.stepFloor(-1));
      if (key === "PageDown") return void (e.preventDefault(), this.stepFloor(1));
      if (key === "Escape") return this.cancelCarry();
    }
    if (key.startsWith("Arrow")) e.preventDefault();
    this.view.camera.keyDown(key);
  }

  private keyUp(e: KeyboardEvent) {
    if (e.key === "Tab") {
      this.rulerKey = false;
      this.ruler = null;
      this.redraw();
    }
    this.view.camera.keyUp(e.key);
  }

  dispose() {
    this.off.forEach((f) => f());
    this.guides.dispose();
    this.box?.remove();
  }
}
