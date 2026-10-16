// How mouse and keyboard on the table become camera moves, selection, carrying and the ruler.
// Controls follow Tabletop Simulator's where it has one (ADR-017):
//   left-click selects; click again or double-click selects the whole unit; left-drag on the
//   table draws a box; left-drag on a model lifts and carries the selection; Q and E turn it;
//   right-drag or the arrow keys turn the camera; middle-drag or WASD slide it; the wheel zooms;
//   Z or a middle-click zooms to the pointer and back; P looks straight down and back; Space goes
//   back to your edge; F or a middle-click on a card flips it.
// Where it has none, the screen picks: hold Tab for the ruler; Space or right-click pins a
// waypoint; Page Up and Page Down (or Shift with the wheel) step between floors while carrying;
// Escape puts a carried selection back.
// Cards: click a deck to draw into your hand, Shift-click to draw face up; drag a card on the
// table onto a deck (Shift for its bottom), a discard pile, your hand or elsewhere; F flips the
// card under the pointer, as in Tabletop Simulator. T and H are kept as other keys for P and Space.
import { Plane, Raycaster, Vector2, Vector3, type Object3D } from "three";
import type { Action, FloorRef, Point, Table } from "../../record/index.ts";
import { distance, type Spot } from "../../measure/index.ts";
import { Guides, type Guide } from "./guides.ts";
import type { Cards } from "./cards.ts";
import { floorHeight, Pieces, type Place, type Thing } from "./pieces.ts";
import type { TableView } from "./view.ts";

/** What the table needs from the game around it. */
export interface Hooks {
  act(action: Action): Promise<boolean>;
  draw(deck: string, to: "hand" | "table"): void;
}

/** Where a dragged card would go if let go here. */
export type CardTarget =
  | { into: "deck"; deck: string }
  | { into: "discard"; deck: string }
  | { into: "hand" }
  | { into: "table"; at: Point };

interface Carry {
  /** The models carried, or the one terrain piece. */
  ids: string[];
  terrain: boolean;
  starts: Map<string, Place>;
  offsets: Map<string, Point>;
  waypoints: Map<string, Point[]>;
  turn: number;
  /** Steps from the floor the pointer is on: positive is down, negative is up. */
  floorStep: number;
  /** The floor the pointer is on, and the model it carries by. */
  aimFloor: FloorRef | null;
  by: string;
  grab: Point;
  moved: boolean;
}

type Spot3 = Point & { h: number };

interface Ruler {
  from: Spot;
  fromPoint: Spot3;
  via: Spot3[];
  to: Spot;
  toPoint: Spot3;
}

const sameFloor = (a: FloorRef | null, b: FloorRef | null) => a === b || (!!a && !!b && a.terrain === b.terrain && a.floor === b.floor);

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
  private press: { x: number; y: number; thing: Thing | null; detail: number; shift: boolean } | null = null;
  private cards: Cards;
  private cardCarry: { id: string; offset: Point } | null = null;
  private carriedCards = new Map<string, Point>();
  private hover: { clientX: number; clientY: number } | null = null;
  private box: HTMLDivElement | null = null;
  private orbit: { button: number; x: number; y: number; moved: number } | null = null;
  private pointer = new Vector2();
  private raycaster = new Raycaster();
  private off: (() => void)[] = [];

  constructor(view: TableView, pieces: Pieces, cards: Cards, hooks: Hooks) {
    this.view = view;
    this.cards = cards;
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
      this.view.camera.releaseKeys();
      this.rulerKey = false;
      this.ruler = null;
      this.redraw();
    });
  }

  /** A new moment to show. The latest move's paths stay drawn for everyone. */
  setTable(table: Table, me: string | null, readOnly: boolean, colour: string, lastMove: string[]) {
    this.table = table;
    this.me = me;
    this.readOnly = readOnly;
    this.colour = colour;
    for (const id of this.selected) if (!table.terrain[id] && (!table.models[id] || table.models[id].aside)) this.selected.delete(id);
    // Read-only now, or something carried was taken off the table by someone else: put it all back.
    if (this.carry && (readOnly || this.carry.ids.some((id) => !(table.models[id] && !table.models[id].aside) && !table.terrain[id])))
      this.cancelCarry();
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
    this.cards.sync(this.table, this.carriedCards);
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

  /** What is under the pointer: a model first, then a card, deck or pile, then terrain. */
  private thingAt(e: { clientX: number; clientY: number }, except?: string): Thing | null {
    this.aim(e);
    const hits = this.raycaster
      .intersectObjects([...this.pieces.objects(), ...this.cards.objects()], true)
      .map((h) => Pieces.pieceOf(h.object))
      .filter((h): h is Thing => !!h && h.id !== except);
    for (const kind of ["model", "card", "deck", "discard", "terrain"]) {
      const hit = hits.find((h) => h.kind === kind);
      if (hit) return hit;
    }
    return null;
  }

  private modelAt(e: PointerEvent): string | null {
    const thing = this.thingAt(e);
    return thing?.kind === "model" ? thing.id : null;
  }

  /** Where a card let go at this spot on screen would go. */
  targetAt(clientX: number, clientY: number, except?: string): CardTarget | null {
    if (document.elementFromPoint(clientX, clientY)?.closest(".hand")) return { into: "hand" };
    const thing = this.thingAt({ clientX, clientY }, except);
    if (thing?.kind === "deck") return { into: "deck", deck: thing.id };
    if (thing?.kind === "discard") return { into: "discard", deck: thing.id };
    const at = this.pointAt({ clientX, clientY });
    return at ? { into: "table", at } : null;
  }

  private pointAt(e: { clientX: number; clientY: number }, height = 0): Point | null {
    this.aim(e);
    const hit = this.raycaster.ray.intersectPlane(new Plane(new Vector3(0, 1, 0), -height), new Vector3());
    return hit ? { x: hit.x, y: -hit.z } : null;
  }

  /** The surface under the pointer: the nearest floor the pointer meets, or else the table. */
  private surfaceAt(e: { clientX: number; clientY: number }, except?: string): { point: Point; floor: FloorRef | null; h: number } | null {
    this.aim(e);
    const ray = this.raycaster.ray;
    let best: { point: Point; floor: FloorRef | null; h: number; d: number } | null = null;
    for (const t of Object.values(this.table?.terrain ?? {})) {
      if (t.id === except) continue;
      t.floors.forEach((f, i) => {
        const hit = ray.intersectPlane(new Plane(new Vector3(0, 1, 0), -f.height), new Vector3());
        if (!hit) return;
        const point = { x: hit.x, y: -hit.z };
        if (!inside(rotate({ x: point.x - t.position.x, y: point.y - t.position.y }, -t.facing), f.outline)) return;
        const d = hit.distanceTo(ray.origin);
        if (!best || d < best.d) best = { point, floor: { terrain: t.id, floor: i }, h: f.height, d };
      });
    }
    if (best) return best;
    const point = this.pointAt(e);
    return point ? { point, floor: null, h: 0 } : null;
  }

  // Pointer.

  private down(e: PointerEvent) {
    this.view.renderer.domElement.focus();
    if (this.carry && e.button !== 0) return;
    if (e.button === 2 && (this.carry || this.ruler)) return this.pin();
    if (e.button === 2 || e.button === 1) {
      this.orbit = { button: e.button, x: e.clientX, y: e.clientY, moved: 0 };
      return;
    }
    if (e.button !== 0 || !this.table) return;
    const thing = this.thingAt(e);
    const model = thing?.kind === "model" ? thing.id : null;
    if (this.rulerKey) {
      const at = this.spotAt(e, model);
      if (!at) return;
      this.ruler = { from: at.spot, fromPoint: at.point, via: [], to: at.spot, toPoint: at.point };
      this.redraw();
      return;
    }
    this.press = { x: e.clientX, y: e.clientY, thing, detail: e.detail, shift: e.shiftKey };
  }

  /** A spot for the ruler: the model under the pointer, or the surface there. */
  private spotAt(e: { clientX: number; clientY: number }, model: string | null): { spot: Spot; point: Spot3 } | null {
    const m = model ? this.table?.models[model] : undefined;
    if (m) return { spot: { model: m.id }, point: { ...m.position, h: floorHeight(this.table!, m.floor) } };
    const s = this.surfaceAt(e);
    return s ? { spot: s.point, point: { ...s.point, h: s.h } } : null;
  }

  private move(e: PointerEvent) {
    this.hover = { clientX: e.clientX, clientY: e.clientY };
    this.showLabelUnder(e);
    // A right button pressed while the left is held comes as a move, not a press.
    if (e.button === 2 && e.buttons & 2 && (this.carry || this.ruler)) return this.pin();
    if (this.orbit) {
      const dx = e.clientX - this.orbit.x;
      const dy = e.clientY - this.orbit.y;
      this.orbit.x = e.clientX;
      this.orbit.y = e.clientY;
      this.orbit.moved += Math.hypot(dx, dy);
      if (this.orbit.button === 2) this.view.camera.turn(dx, dy);
      else this.view.camera.slide(dx, dy);
      return;
    }
    if (this.ruler && e.buttons & 1) {
      const at = this.spotAt(e, this.modelAt(e));
      if (!at) return;
      this.ruler.to = at.spot;
      this.ruler.toPoint = at.point;
      this.redraw();
      return;
    }
    if (this.carry && !(e.buttons & 1)) return void this.setDown(); // Left let go while the right is held.
    if (this.carry) return this.carryTo(e);
    if (this.cardCarry) return this.carryCard(e);
    const press = this.press;
    if (!press || Math.hypot(e.clientX - press.x, e.clientY - press.y) < 5) return;
    const thing = press.thing;
    if (!thing) return this.drawBox(press, e);
    if (this.readOnly) return;
    if (thing.kind === "model" || thing.kind === "terrain") {
      if (!this.selected.has(thing.id)) this.selected = new Set([thing.id]);
      this.lift(press, thing);
      this.carryTo(e);
    } else if (thing.kind === "card") {
      const card = this.table?.cards[thing.id];
      const grab = this.pointAt({ clientX: press.x, clientY: press.y });
      if (card?.place.in !== "table" || !grab) return;
      this.cardCarry = { id: card.id, offset: { x: card.place.position.x - grab.x, y: card.place.position.y - grab.y } };
      this.carryCard(e);
    }
  }

  private up(e: PointerEvent) {
    if (this.orbit?.button === e.button) {
      // A middle-click that did not drag flips the card under it, or zooms to the pointer and back.
      if (this.orbit.button === 1 && this.orbit.moved < 5 && !this.flip()) this.zoomToPointer();
      this.orbit = null;
      return;
    }
    // Letting go of the left button sets down what is carried, even if the right is let go last.
    if (this.carry && !(e.buttons & 1)) {
      this.press = null;
      return void this.setDown();
    }
    if (e.button !== 0) return;
    const press = this.press;
    this.press = null;
    if (this.cardCarry) return void this.setCardDown(e);
    if (this.box && press) return this.finishBox(press, e);
    if (!press || !this.table) return;
    const thing = press.thing;
    if (thing?.kind === "deck") {
      if (!this.readOnly) this.hooks.draw(thing.id, press.shift ? "table" : "hand");
      return;
    }
    // A click: select a model, or its whole unit on a second click or a double-click.
    const model = thing?.kind === "model" ? thing.id : null;
    if (thing?.kind === "terrain") this.selected = new Set([thing.id]);
    else if (!model) this.selected.clear();
    else if (press.shift) {
      if (this.selected.has(model)) this.selected.delete(model);
      else this.selected.add(model);
    } else if (press.detail >= 2 || (this.selected.size === 1 && this.selected.has(model))) {
      const unit = this.table.models[model]?.unit;
      this.selected = new Set(
        Object.values(this.table.models)
          .filter((m) => m.unit === unit && !m.aside)
          .map((m) => m.id),
      );
    } else this.selected = new Set([model]);
    this.redraw();
  }

  private wheel(e: WheelEvent) {
    e.preventDefault();
    // With Shift held, some browsers turn the wheel sideways.
    if (this.carry && e.shiftKey) return this.stepFloor((e.deltaY || e.deltaX) > 0 ? 1 : -1);
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
      if (v.z > 1) continue; // Behind the camera.
      const sx = rect.left + ((v.x + 1) / 2) * rect.width;
      const sy = rect.top + ((1 - v.y) / 2) * rect.height;
      if (sx >= x0 && sx <= x1 && sy >= y0 && sy <= y1) this.selected.add(m.id);
    }
    this.redraw();
  }

  // Carrying.

  private lift(press: { x: number; y: number }, thing: Thing) {
    const table = this.table!;
    const piece = thing.kind === "terrain" ? table.terrain[thing.id] : undefined;
    const at = { clientX: press.x, clientY: press.y };
    const ground = this.pointAt(at);
    const surface = piece ? ground && { point: ground, floor: null, h: 0 } : this.surfaceAt(at);
    if (!surface) return;
    const grab = surface.point;
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
      aimFloor: surface.floor,
      by: thing.id,
      grab,
      moved: false,
    };
  }

  private carryTo(e: { clientX: number; clientY: number }) {
    const c = this.carry;
    if (!c) return;
    // Terrain is carried along the table itself; models onto the floor under the pointer.
    const ground = c.terrain ? this.pointAt(e) : null;
    const surface = c.terrain ? ground && { point: ground, floor: null, h: 0 } : this.surfaceAt(e);
    if (surface) {
      if (!sameFloor(surface.floor, c.aimFloor)) c.floorStep = 0;
      c.grab = surface.point;
      c.aimFloor = c.terrain ? null : surface.floor;
    }
    this.place();
  }

  /** The floors under a carried model, and which of them it is on before stepping. */
  private floorsFor(id: string, position: Point): { under: (FloorRef | null)[]; base: number } {
    const c = this.carry!;
    if (c.terrain) return { under: [null], base: 0 };
    const under = floorsUnder(this.table!, position);
    // On the floor the pointer is on if it is under this model; otherwise the highest one there.
    return {
      under,
      base: c.aimFloor
        ? Math.max(
            0,
            under.findIndex((f) => sameFloor(f, c.aimFloor)),
          )
        : 0,
    };
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
      const { under, base } = this.floorsFor(id, position);
      const floor = under[Math.min(Math.max(base + c.floorStep, 0), under.length - 1)] ?? null;
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
    const c = this.carry;
    const at = c && this.carried.get(c.by);
    if (!c || !at) return;
    // Only as far as there are floors under the model carried by.
    const { under, base } = this.floorsFor(c.by, at.position);
    c.floorStep = Math.min(Math.max(c.floorStep + by, -base), under.length - 1 - base);
    this.place();
  }

  private cancelCarry() {
    // The button may still be held: letting go of it now does nothing.
    this.press = null;
    this.carry = null;
    this.carried.clear();
    this.redraw();
  }

  /** Letting go sets the carried models down: one move action. */
  private async setDown() {
    const c = this.carry;
    this.carry = null;
    this.press = null;
    if (!c?.moved) return this.cancelCarry();
    const piece = c.terrain ? this.table?.terrain[c.ids[0]!] : undefined;
    if (c.terrain && !piece) return this.cancelCarry(); // Removed while carried.
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

  // Cards on the table.

  private carryCard(e: { clientX: number; clientY: number }) {
    const c = this.cardCarry!;
    const at = this.pointAt(e);
    if (at) this.carriedCards.set(c.id, { x: at.x + c.offset.x, y: at.y + c.offset.y });
    this.redraw();
  }

  private async setCardDown(e: PointerEvent) {
    const c = this.cardCarry!;
    this.cardCarry = null;
    const card = this.table?.cards[c.id];
    const target = this.targetAt(e.clientX, e.clientY, c.id);
    if (card?.place.in === "table" && target) {
      const faceUp = card.place.faceUp;
      await this.hooks.act(
        target.into === "table"
          ? { kind: "move card", card: c.id, to: { in: "table", position: this.carriedCards.get(c.id) ?? target.at, faceUp } }
          : cardMove(c.id, target, e.shiftKey, this.me, this.table),
      );
    }
    this.carriedCards.delete(c.id);
    this.redraw();
  }

  private me: string | null = null;

  /** A piece's label shows while the pointer is over it, and not while it is over a panel. */
  private showLabelUnder(e: PointerEvent) {
    const onTable = e.target === this.view.renderer.domElement;
    const thing = onTable && !this.orbit ? this.thingAt(e) : null;
    this.pieces.hover(thing && (thing.kind === "model" || thing.kind === "terrain") ? thing.id : null);
  }

  /** Turns the card under the pointer over. */
  private overPanel(): boolean {
    const over = this.hover && document.elementFromPoint(this.hover.clientX, this.hover.clientY);
    return !!over && !this.view.host.contains(over);
  }

  /** Flips the card under the pointer; false if there is none to flip. */
  private flip(): boolean {
    if (!this.hover || this.readOnly || this.overPanel()) return false;
    const thing = this.thingAt(this.hover);
    const card = thing?.kind === "card" ? this.table?.cards[thing.id] : undefined;
    if (card?.place.in !== "table") return false;
    void this.hooks.act({ kind: "move card", card: card.id, to: { ...card.place, faceUp: !card.place.faceUp } });
    return true;
  }

  /** Closes in on the surface under the pointer, or back out if already in. */
  private zoomToPointer() {
    const s = this.hover && this.table && !this.overPanel() ? this.surfaceAt(this.hover) : null;
    this.view.camera.toggleZoomTo(s ? new Vector3(s.point.x, s.h, -s.point.y) : null);
  }

  // The ruler.

  private rulerGuide(): Guide {
    const r = this.ruler!;
    const table = this.table!;
    let text = "";
    try {
      const via = r.via.map(({ x, y }) => ({ x, y }));
      const measured = distance(table, r.from, r.to, via);
      // Measure knows a model's floor but not a bare point's, so a point's height is the surface it is on.
      const up = "x" in r.from || "x" in r.to ? r.toPoint.h - r.fromPoint.h : measured.up;
      text = `${inches(measured.across)}${Math.abs(up) >= 0.05 ? `, ${inches(Math.abs(up))} ${up > 0 ? "up" : "down"}` : ""}`;
    } catch {
      text = "";
    }
    return {
      points: [r.fromPoint, ...r.via, r.toPoint],
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
      // Tab still moves between the panels' buttons; it is the ruler only while the table has focus.
      const focus = document.activeElement;
      if (focus && focus !== document.body && focus !== this.view.renderer.domElement) return;
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
    if (key === "f" || key === "F") return void this.flip();
    // Ctrl, Alt and Cmd with a letter are the browser's.
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    // A held P or Z repeats; each would toggle back.
    if (e.repeat && (key === "p" || key === "P" || key === "z" || key === "Z")) return;
    if (key === "z" || key === "Z") return this.zoomToPointer();
    if (key === " ") {
      if (this.rulerKey) return void e.preventDefault(); // About to measure; Space pins once the ruler is drawn.
      // Space on a focused button presses it; it is the camera's only while the table has focus.
      const focus = document.activeElement;
      if (focus && focus !== document.body && focus !== this.view.renderer.domElement) return;
      e.preventDefault();
    }
    if (key.startsWith("Arrow")) e.preventDefault();
    this.view.camera.keyDown(key, e.code);
  }

  private keyUp(e: KeyboardEvent) {
    if (e.key === "Tab") {
      this.rulerKey = false;
      this.ruler = null;
      this.redraw();
    }
    this.view.camera.keyUp(e.code);
  }

  dispose() {
    this.off.forEach((f) => f());
    this.guides.dispose();
    this.box?.remove();
  }
}

/**
 * The move card action for letting a card go on a deck, a discard pile or your hand. Only an
 * ordered deck has a top and a bottom; a card put into a shuffled deck is shuffled in.
 */
export function cardMove(
  card: string,
  target: Exclude<CardTarget, { into: "table" }>,
  bottom: boolean,
  me: string | null,
  table: Table | null,
): Action {
  if (target.into === "hand") return { kind: "move card", card, to: { in: "hand", player: me ?? "" } };
  if (target.into === "discard") return { kind: "move card", card, to: { in: "discard", deck: target.deck } };
  if (table?.decks[target.deck]?.order !== "ordered") return { kind: "move card", card, to: { in: "deck", deck: target.deck } };
  return bottom
    ? { kind: "move card", card, to: { in: "deck", deck: target.deck }, at: "bottom" }
    : { kind: "move card", card, to: { in: "deck", deck: target.deck }, at: 0 };
}
