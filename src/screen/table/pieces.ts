// What sits on the table, drawn from the record's table: models now; terrain, decks and cards join later.
import { BoxGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial, RingGeometry, type Object3D } from "three";
import { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import type { FloorRef, Model, Point, Table } from "../../record/index.ts";
import type { TableView } from "./view.ts";

export const MM = 1 / 25.4;

/** Where a model is drawn: the record's place for it, or where it is being carried. */
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

interface Drawn {
  object: Group;
  key: string;
  target: { x: number; y: number; z: number; facing: number };
  label: CSS2DObject;
  ring: Mesh;
}

/** Takes an object off the table, with any labels on it. */
export function drop(parent: Object3D, object: Object3D) {
  parent.remove(object);
  object.traverse((o) => {
    if (o instanceof CSS2DObject) o.element.remove();
  });
}

const radians = (degrees: number) => (-degrees * Math.PI) / 180;

export class Pieces {
  private view: TableView;
  private models = new Map<string, Drawn>();
  private offTick: () => void;

  constructor(view: TableView) {
    this.view = view;
    // Pieces glide to where the record puts them, so a refused move settles back rather than jumping.
    this.offTick = view.onTick((seconds) => {
      const k = 1 - Math.exp(-seconds * 18);
      for (const d of this.models.values()) {
        const p = d.object.position;
        p.x += (d.target.x - p.x) * k;
        p.y += (d.target.y - p.y) * k;
        p.z += (d.target.z - p.z) * k;
        let turn = d.target.facing - d.object.rotation.y;
        turn = Math.atan2(Math.sin(turn), Math.cos(turn));
        d.object.rotation.y += turn * k;
      }
    });
  }

  /** The model under a three.js object hit by a ray, if any. */
  static modelOf(object: Object3D | null): string | null {
    for (let o = object; o; o = o.parent) if (o.userData.model) return o.userData.model as string;
    return null;
  }

  modelObjects(): Object3D[] {
    return [...this.models.values()].map((d) => d.object);
  }

  sync(table: Table, selected: ReadonlySet<string>, carried: ReadonlyMap<string, Place>) {
    const seen = new Set<string>();
    for (const model of Object.values(table.models)) {
      if (model.aside) continue;
      seen.add(model.id);
      const colour = table.players[table.units[model.unit]?.owner ?? ""]?.colour ?? "#999999";
      const key = JSON.stringify([model.base, model.height, model.mesh, colour, model.name]);
      let d = this.models.get(model.id);
      if (d && d.key !== key) {
        drop(this.view.root, d.object);
        d = undefined;
      }
      const place = carried.get(model.id) ?? model;
      const target = {
        x: place.position.x,
        y: floorHeight(table, place.floor) + (carried.get(model.id)?.lift ?? 0),
        z: place.position.y,
        facing: radians(place.facing),
      };
      if (!d) {
        d = this.drawModel(model, colour, key, target);
        this.models.set(model.id, d);
      }
      d.target = target;
      d.ring.visible = selected.has(model.id);
      d.label.element.classList.toggle("selected", selected.has(model.id));
    }
    for (const [id, d] of this.models) {
      if (seen.has(id)) continue;
      drop(this.view.root, d.object);
      this.models.delete(id);
    }
  }

  private drawModel(model: Model, colour: string, key: string, target: Drawn["target"]): Drawn {
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
    // A stand-in body in the player's colour. Meshes replace it once they can be loaded.
    const r = Math.min(w, d) * 0.3;
    const body = new Mesh(new CylinderGeometry(r * 0.75, r, model.height, 20), new MeshStandardMaterial({ color: colour, roughness: 0.6 }));
    body.position.y = 0.12 + model.height / 2;
    object.add(body);
    const ring = new Mesh(
      new RingGeometry(0.5, 0.58, 48).scale(Math.max(w, d) + 0.2, Math.max(w, d) + 0.2, 1),
      new MeshStandardMaterial({ color: "#e2b04a" }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    ring.visible = false;
    object.add(ring);
    const tag = label(model.name);
    tag.position.y = 0.12 + model.height + 0.3;
    object.add(tag);
    object.position.set(target.x, target.y, target.z);
    object.rotation.y = target.facing;
    this.view.root.add(object);
    return { object, key, target, label: tag, ring };
  }

  dispose() {
    this.offTick();
    for (const d of this.models.values()) drop(this.view.root, d.object);
    this.models.clear();
  }
}
