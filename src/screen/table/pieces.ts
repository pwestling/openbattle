// What sits on the table, drawn from the record's table: terrain and models (decks and cards join later).
import {
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  Line,
  Mesh,
  MeshStandardMaterial,
  RingGeometry,
  Shape as Outline,
  Vector2,
  type Object3D,
} from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import type { FloorRef, Model, Point, Shape, Table, Terrain } from "../../record/index.ts";
import { fitted, standing, whenMesh, type ReadMesh } from "./meshes.ts";
import type { TableView } from "./view.ts";

export const MM = 1 / 25.4;

/** How long the pointer rests on a piece before its label shows, in milliseconds. */
export const LABEL_DELAY = 500;

/** Where a model or terrain piece is drawn: the record's place for it, or where it is being carried. */
export interface Place {
  position: Point;
  facing: number;
  floor: FloorRef | null;
  /** Extra height while lifted. */
  lift?: number;
}

/** The height of a floor on the table; the table itself is 0. */
export function floorHeight(table: Table, floor: FloorRef | null): number {
  if (!floor) return 0;
  return table.terrain[floor.terrain]?.floors[floor.floor]?.height ?? 0;
}

export function label(text: string, className = "label"): CSS2DObject {
  const el = document.createElement("div");
  el.className = className;
  el.textContent = text;
  return new CSS2DObject(el);
}

/** Takes an object off the table, with any labels on it, and frees what it held on the graphics card. */
export function drop(parent: Object3D, object: Object3D) {
  parent.remove(object);
  object.traverse((o) => {
    (o.userData.stop as (() => void) | undefined)?.();
    if (o instanceof CSS2DObject) o.element.remove();
    if ((o instanceof Mesh || o instanceof Line) && !o.userData.shared) {
      o.geometry.dispose();
      for (const m of [o.material].flat()) {
        if (m.userData.shared) continue;
        (m as { map?: { dispose(): void } }).map?.dispose();
        m.dispose();
      }
    }
  });
}

/** Shows a piece's stand-in, marked as missing, until its mesh file is here; then the mesh. */
function meshOrMissing(
  object: Group,
  standIn: Object3D,
  tag: CSS2DObject,
  fingerprint: string,
  view: TableView,
  shaped: (m: ReadMesh) => Object3D,
) {
  tag.element.classList.add("missing");
  tag.element.title = "This piece's mesh file hasn't arrived in this browser yet.";
  object.userData.stop = whenMesh(fingerprint, (mesh) => {
    drop(object, standIn);
    object.add(shaped(mesh));
    tag.element.classList.remove("missing");
    tag.element.removeAttribute("title");
    view.invalidate();
  });
}

/** A simple solid in its own inches: centred across, standing on 0. A ramp rises toward +y. */
export function solidGeometry(shape: Exclude<Shape, { kind: "mesh" }>): BufferGeometry {
  const { width: w, depth: d, height: h } = shape;
  if (shape.kind === "box") return new BoxGeometry(w, h, d).translate(0, h / 2, 0);
  if (shape.kind === "cylinder") return new CylinderGeometry(0.5, 0.5, h, 48).scale(w, 1, d).translate(0, h / 2, 0);
  // The ramp's side, across the depth, pushed out across the width. Turned a quarter, the side's
  // high end lands at three's -z, which is the table's +y.
  const side = new Outline([new Vector2(-d / 2, 0), new Vector2(d / 2, 0), new Vector2(d / 2, h)]);
  return new ExtrudeGeometry(side, { depth: w, bevelEnabled: false }).rotateY(Math.PI / 2).translate(-w / 2, 0, 0);
}

/** Something on the table a click or drag can land on. */
export interface Thing {
  kind: "model" | "terrain" | "deck" | "discard" | "card";
  id: string;
}

interface Drawn {
  object: Group;
  key: string;
  target: { x: number; y: number; z: number; facing: number };
  label: CSS2DObject;
  ring: Mesh;
}

const radians = (degrees: number) => (-degrees * Math.PI) / 180;

export class Pieces {
  private view: TableView;
  private drawn = new Map<string, Drawn>();
  private hovered: string | null = null;
  /** The piece whose label is showing: the one hovered for a moment. */
  private labelled: string | null = null;
  private labelTimer: ReturnType<typeof setTimeout> | undefined;
  private offTick: () => void;

  constructor(view: TableView) {
    this.view = view;
    // Pieces glide to where the record puts them, so a refused move settles back rather than jumping.
    this.offTick = view.onTick((seconds) => {
      const k = 1 - Math.exp(-seconds * 18);
      let moving = false;
      for (const d of this.drawn.values()) {
        const p = d.object.position;
        let turn = d.target.facing - d.object.rotation.y;
        turn = Math.atan2(Math.sin(turn), Math.cos(turn));
        if (Math.abs(d.target.x - p.x) + Math.abs(d.target.y - p.y) + Math.abs(d.target.z - p.z) + Math.abs(turn) < 1e-3) {
          if (p.x !== d.target.x || p.y !== d.target.y || p.z !== d.target.z) moving = true;
          p.set(d.target.x, d.target.y, d.target.z);
          continue;
        }
        moving = true;
        p.x += (d.target.x - p.x) * k;
        p.y += (d.target.y - p.y) * k;
        p.z += (d.target.z - p.z) * k;
        d.object.rotation.y += turn * k;
      }
      return moving;
    });
  }

  /** What a three.js object hit by a ray belongs to, if anything. */
  static pieceOf(object: Object3D | null): Thing | null {
    for (let o = object; o; o = o.parent) {
      for (const kind of ["model", "terrain", "deck", "discard", "card"] as const) {
        if (o.userData[kind]) return { kind, id: o.userData[kind] as string };
      }
    }
    return null;
  }

  /** The piece the pointer is over, whose label shows once the pointer has rested there a moment. */
  hover(id: string | null) {
    if (id === this.hovered) return;
    clearTimeout(this.labelTimer);
    this.drawn.get(this.labelled ?? "")?.label.element.classList.remove("pointed");
    this.labelled = null;
    this.hovered = id;
    if (id === null) return;
    this.labelTimer = setTimeout(() => {
      this.labelled = id;
      this.drawn.get(id)?.label.element.classList.add("pointed");
      this.view.invalidate();
    }, LABEL_DELAY);
  }

  objects(): Object3D[] {
    return [...this.drawn.values()].map((d) => d.object);
  }

  sync(table: Table, selected: ReadonlySet<string>, carried: ReadonlyMap<string, Place>) {
    this.view.invalidate();
    const seen = new Set<string>();
    const target = (place: Place, height: number) => ({
      x: place.position.x,
      y: height + (place.lift ?? 0),
      z: -place.position.y,
      facing: radians(place.facing),
    });
    for (const t of Object.values(table.terrain)) {
      seen.add(t.id);
      const key = JSON.stringify([t.shape, t.name]);
      const place = carried.get(t.id) ?? { ...t, floor: null };
      this.put(t.id, key, target(place, 0), selected.has(t.id), () => this.drawTerrain(t));
    }
    for (const m of Object.values(table.models)) {
      if (m.aside) continue;
      seen.add(m.id);
      const colour = table.players[table.units[m.unit]?.owner ?? ""]?.colour ?? "#999999";
      const key = JSON.stringify([m.base, m.height, m.mesh, colour, m.name]);
      const place = carried.get(m.id) ?? m;
      this.put(m.id, key, target(place, floorHeight(table, place.floor)), selected.has(m.id), () => this.drawModel(m, colour));
    }
    for (const [id, d] of this.drawn) {
      if (seen.has(id)) continue;
      drop(this.view.root, d.object);
      this.drawn.delete(id);
    }
  }

  private put(id: string, key: string, target: Drawn["target"], selected: boolean, draw: () => Omit<Drawn, "key" | "target">) {
    let d = this.drawn.get(id);
    if (d && d.key !== key) {
      drop(this.view.root, d.object);
      d = undefined;
    }
    if (!d) {
      d = { ...draw(), key, target };
      d.object.position.set(target.x, target.y, target.z);
      d.object.rotation.y = target.facing;
      this.view.root.add(d.object);
      this.drawn.set(id, d);
      d.label.element.classList.toggle("pointed", id === this.labelled);
    }
    d.target = target;
    d.ring.visible = selected;
    d.label.element.classList.toggle("selected", selected);
  }

  private ring(size: number): Mesh {
    const ring = new Mesh(new RingGeometry(0.5, 0.56, 48).scale(size, size, 1), new MeshStandardMaterial({ color: "#e2b04a" }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    ring.visible = false;
    return ring;
  }

  private drawTerrain(t: Terrain) {
    const object = new Group();
    object.userData.terrain = t.id;
    const { width, depth, height } = t.shape;
    if (t.shape.kind === "mesh") {
      // Until the mesh file is here, a faint box shows where the piece stands.
      const ghost = new Mesh(
        new BoxGeometry(width, height, depth).translate(0, height / 2, 0),
        new MeshStandardMaterial({ color: "#8a8478", transparent: true, opacity: 0.25 }),
      );
      object.add(ghost);
    } else object.add(new Mesh(solidGeometry(t.shape), new MeshStandardMaterial({ color: "#8a8478", roughness: 0.9 })));
    const ring = this.ring(Math.hypot(width, depth) + 0.4);
    object.add(ring);
    const tag = label(t.name, "label piece");
    tag.position.y = height + 0.3;
    object.add(tag);
    const shape = t.shape;
    if (shape.kind === "mesh") meshOrMissing(object, object.children[0]!, tag, shape.mesh, this.view, (mesh) => fitted(mesh, shape));
    return { object, label: tag, ring };
  }

  private drawModel(model: Model, colour: string) {
    const w = model.base.width * MM;
    const d = model.base.depth * MM;
    const object = new Group();
    object.userData.model = model.id;
    const baseMaterial = new MeshStandardMaterial({ color: "#2a2a2a", roughness: 0.7 });
    const base =
      model.base.shape === "rect"
        ? new Mesh(new BoxGeometry(w, 0.12, d), baseMaterial)
        : new Mesh(new CylinderGeometry(0.5, 0.5, 0.12, 40).scale(w, 1, d), baseMaterial);
    base.position.y = 0.06;
    object.add(base);
    const rim = new Mesh(
      model.base.shape === "rect"
        ? new BoxGeometry(w + 0.04, 0.03, d + 0.04)
        : new CylinderGeometry(0.5, 0.5, 0.03, 40).scale(w + 0.04, 1, d + 0.04),
      new MeshStandardMaterial({ color: colour }),
    );
    rim.position.y = 0.015;
    object.add(rim);
    // A stand-in body in the player's colour, replaced by the model's mesh once its file is here.
    const r = Math.min(w, d) * 0.3;
    const body = new Mesh(new CylinderGeometry(r * 0.75, r, model.height, 20), new MeshStandardMaterial({ color: colour, roughness: 0.6 }));
    body.position.y = 0.12 + model.height / 2;
    object.add(body);
    const ring = this.ring(Math.max(w, d) + 0.2);
    object.add(ring);
    const tag = label(model.name, "label piece");
    tag.position.y = 0.12 + model.height + 0.3;
    object.add(tag);
    if (model.mesh)
      meshOrMissing(object, body, tag, model.mesh, this.view, (mesh) => {
        const shaped = standing(mesh, model.height);
        shaped.position.y = 0.12;
        return shaped;
      });
    return { object, label: tag, ring };
  }

  dispose() {
    clearTimeout(this.labelTimer);
    this.offTick();
    for (const d of this.drawn.values()) drop(this.view.root, d.object);
    this.drawn.clear();
  }
}
