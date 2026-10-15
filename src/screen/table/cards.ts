// Decks, discard piles and cards on the table. Decks are face-down stacks with a count; a shuffled
// deck says so. Each deck's discard pile lies just beside it. Face-up cards show their name
// and picture; face-down ones show the back.
import { BoxGeometry, CanvasTexture, Group, Mesh, MeshStandardMaterial, PlaneGeometry, SRGBColorSpace, type Object3D } from "three";
import type { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import type { Card, Deck, Point, Table } from "../../record/index.ts";
import { getFile } from "../../archive/index.ts";
import { drop, label } from "./pieces.ts";
import type { TableView } from "./view.ts";

export const CARD = { width: 2.5, depth: 3.5 };

/** Where a deck's discard pile lies. */
export const discardAt = (deck: Deck): Point => ({ x: deck.position.x + CARD.width + 1, y: deck.position.y });

const back = new MeshStandardMaterial({ color: "#2b3a6b", roughness: 0.8 });

function faceTexture(card: Card, picture?: HTMLImageElement): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 250;
  canvas.height = 350;
  const g = canvas.getContext("2d")!;
  g.fillStyle = "#f4efe3";
  g.fillRect(0, 0, 250, 350);
  g.strokeStyle = "#8c8170";
  g.lineWidth = 6;
  g.strokeRect(6, 6, 238, 338);
  if (picture) g.drawImage(picture, 16, 54, 218, 150);
  g.fillStyle = "#1c1c1c";
  g.font = "bold 26px system-ui, sans-serif";
  g.fillText(card.name, 18, 40, 214);
  g.font = "18px system-ui, sans-serif";
  const words = (card.text ?? "").split(/\s+/);
  let line = "";
  let y = picture ? 232 : 80;
  for (const w of words) {
    if (g.measureText(`${line} ${w}`).width > 214) {
      g.fillText(line, 18, y);
      line = w;
      y += 24;
    } else line = line ? `${line} ${w}` : w;
  }
  g.fillText(line, 18, y);
  const t = new CanvasTexture(canvas);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/** A card lying flat, face up or down. Pictures arrive later, once their file is here. */
function cardMesh(card: Card, faceUp: boolean, loaded: () => void): Mesh {
  const geometry = new PlaneGeometry(CARD.width, CARD.depth).rotateX(-Math.PI / 2);
  if (!faceUp) return new Mesh(geometry, back);
  const material = new MeshStandardMaterial({ map: faceTexture(card), roughness: 0.8 });
  const mesh = new Mesh(geometry, material);
  if (card.picture) {
    void getFile(card.picture).then((blob) => {
      if (!blob) return;
      const img = new Image();
      img.onload = () => {
        material.map = faceTexture(card, img);
        material.needsUpdate = true;
        loaded();
      };
      img.src = URL.createObjectURL(blob);
    });
  }
  return mesh;
}

interface Drawn {
  object: Object3D;
  key: string;
  tag: CSS2DObject;
}

export class Cards {
  private view: TableView;
  private drawn = new Map<string, Drawn>();

  constructor(view: TableView) {
    this.view = view;
  }

  objects(): Object3D[] {
    return [...this.drawn.values()].map((d) => d.object);
  }

  sync(table: Table, carried: ReadonlyMap<string, Point>) {
    this.view.invalidate();
    const seen = new Set<string>();
    const put = (id: string, key: string, at: Point, height: number, draw: () => Drawn) => {
      seen.add(id);
      let d = this.drawn.get(id);
      if (d && d.key !== key) {
        drop(this.view.root, d.object);
        d = undefined;
      }
      if (!d) {
        d = draw();
        this.view.root.add(d.object);
        this.drawn.set(id, d);
      }
      d.object.position.set(at.x, height, -at.y);
    };
    const cards = Object.values(table.cards);
    for (const deck of Object.values(table.decks)) {
      const count = deck.cards.length;
      const text = `${deck.name} · ${count}${deck.order === "shuffled" ? " · shuffled" : ""}`;
      put(`deck:${deck.id}`, text, deck.position, 0, () => {
        const object = new Group();
        object.userData.deck = deck.id;
        const h = Math.max(0.03, count * 0.02);
        const faint = new MeshStandardMaterial({ color: "#2b3a6b", transparent: true, opacity: 0.3 });
        const stack = new Mesh(new BoxGeometry(CARD.width, h, CARD.depth).translate(0, h / 2, 0), count === 0 ? faint : back);
        object.add(stack);
        const tag = label(text, "label deck");
        tag.position.y = h + 0.3;
        object.add(tag);
        return { object, key: text, tag };
      });
      const discarded = cards.filter((c) => c.place.in === "discard" && c.place.deck === deck.id);
      const top = discarded.at(-1);
      const pileText = `Discard · ${discarded.length}`;
      put(`discard:${deck.id}`, `${pileText}|${top?.id}`, discardAt(deck), 0, () => {
        const object = new Group();
        object.userData.discard = deck.id;
        const pile = top
          ? cardMesh(top, true, () => this.view.invalidate())
          : new Mesh(
              new PlaneGeometry(CARD.width, CARD.depth).rotateX(-Math.PI / 2),
              new MeshStandardMaterial({ color: "#555555", transparent: true, opacity: 0.25 }),
            );
        pile.position.y = 0.01 + discarded.length * 0.005;
        object.add(pile);
        const tag = label(pileText, "label deck");
        tag.position.y = 0.3;
        object.add(tag);
        return { object, key: `${pileText}|${top?.id}`, tag };
      });
    }
    for (const card of cards) {
      if (card.place.in !== "table") continue;
      const faceUp = card.place.faceUp;
      const key = `${card.id}|${faceUp}`;
      const at = carried.get(card.id) ?? card.place.position;
      put(`card:${card.id}`, key, at, carried.has(card.id) ? 0.4 : 0.01, () => {
        const object = new Group();
        object.userData.card = card.id;
        object.add(cardMesh(card, faceUp, () => this.view.invalidate()));
        const tag = label(faceUp ? card.name : "Card", "label card");
        tag.position.y = 0.2;
        object.add(tag);
        return { object, key, tag };
      });
    }
    for (const [id, d] of this.drawn) {
      if (seen.has(id)) continue;
      drop(this.view.root, d.object);
      this.drawn.delete(id);
    }
  }

  dispose() {
    for (const d of this.drawn.values()) drop(this.view.root, d.object);
    this.drawn.clear();
  }
}
