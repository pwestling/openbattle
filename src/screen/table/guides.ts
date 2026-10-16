// Lines drawn over the table: paths while carrying, the ruler, and the paths of the latest move.
import { BufferGeometry, Group, Line, LineBasicMaterial, Vector3 } from "three";
import type { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { drop, label } from "./pieces.ts";
import type { TableView } from "./view.ts";

export interface Guide {
  /** Points in table inches, with a height. */
  points: { x: number; y: number; h: number }[];
  colour: string;
  /** Text shown at the last point. */
  text?: string;
  /** A second line under the text: the total when this is one leg of several. */
  total?: string;
}

export class Guides {
  private group = new Group();
  private view: TableView;

  constructor(view: TableView) {
    this.view = view;
    view.scene.add(this.group);
  }

  show(guides: Guide[]) {
    this.view.invalidate();
    for (const child of [...this.group.children]) drop(this.group, child);
    for (const g of guides) {
      if (g.points.length < 2) continue;
      const line = new Line(
        new BufferGeometry().setFromPoints(g.points.map((p) => new Vector3(p.x, p.h + 0.08, -p.y))),
        new LineBasicMaterial({ color: g.colour, depthTest: false, transparent: true }),
      );
      line.renderOrder = 10;
      this.group.add(line);
      if (g.text) {
        const end = g.points.at(-1)!;
        const tag: CSS2DObject = label(g.text, "label distance");
        if (g.total) {
          const line = document.createElement("div");
          line.className = "total";
          line.textContent = g.total;
          tag.element.append(line);
        }
        tag.position.set(end.x, end.h + 0.6, -end.y);
        tag.center.set(0.5, 1.6);
        this.group.add(tag);
      }
    }
  }

  dispose() {
    this.show([]);
    this.view.scene.remove(this.group);
  }
}
