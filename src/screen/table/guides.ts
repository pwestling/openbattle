// Lines drawn over the table: paths while carrying, the ruler, and the paths of the latest move.
import { Group } from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import type { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { drop, label } from "./pieces.ts";
import type { TableView } from "./view.ts";

export interface Guide {
  /** Points in table inches, with a height. */
  points: { x: number; y: number; h: number }[];
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
      // A pale line over a dark one, so it stands out on the felt, on terrain and against the sky alike.
      const flat = g.points.flatMap((p) => [p.x, p.h + 0.08, -p.y]);
      const { clientWidth, clientHeight } = this.view.host;
      for (const [colour, width, order] of [["#1a1a1a", 6, 10], ["#fff2b0", 3, 11]] as const) {
        const geometry = new LineGeometry();
        geometry.setPositions(flat);
        const material = new LineMaterial({ color: colour, linewidth: width, depthTest: false, transparent: true });
        material.resolution.set(clientWidth, clientHeight);
        const line = new Line2(geometry, material);
        line.renderOrder = order;
        this.group.add(line);
      }
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
