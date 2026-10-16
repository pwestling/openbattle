// Decks, discard piles and cards on the table. Decks are face-down stacks with a count; a shuffled
// deck says so. Each deck's discard pile lies just beside it. Face-up cards show their name
// and picture; face-down ones show the back.
import { BoxGeometry, CanvasTexture, Group, Mesh, MeshStandardMaterial, PlaneGeometry, SRGBColorSpace, type Object3D } from "three";
import type { CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import type { Card, Deck, Point, Table } from "../../record/index.ts";
import { getFile } from "../../archive/index.ts";
import { drop, label, LABEL_DELAY } from "./pieces.ts";
import type { TableView } from "./view.ts";

export const CARD = { width: 2.5, depth: 3.5 };

/** Where a deck's discard pile lies. */
export const discardAt = (deck: Deck): Point => ({ x: deck.position.x + CARD.width + 1, y: deck.position.y });

/** A card is a thin slab, as in a real game, so it has an edge and stacks have height. */
const THICK = 0.02;

/** The back of a card: a deep blue with a lighter border and a diamond lattice. */
function backTexture(): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 250;
  canvas.height = 350;
  const g = canvas.getContext("2d")!;
  g.fillStyle = "#2b3a6b";
  g.fillRect(0, 0, 250, 350);
  g.strokeStyle = "rgba(255,255,255,0.18)";
  g.lineWidth = 2;
  for (let i = -350; i < 350; i += 28) {
    g.beginPath();
    g.moveTo(0, i);
    g.lineTo(250, i + 250);
    g.moveTo(250, i);
    g.lineTo(0, i + 250);
    g.stroke();
  }
  g.strokeStyle = "#d8d2c0";
  g.lineWidth = 8;
  g.strokeRect(10, 10, 230, 330);
  const t = new CanvasTexture(canvas);
  t.colorSpace = SRGBColorSpace;
  return t;
}

const backFace = new MeshStandardMaterial({ map: backTexture(), roughness: 0.8 });
const backEdge = new MeshStandardMaterial({ color: "#1d2748", roughness: 0.8 });
const faceEdge = new MeshStandardMaterial({ color: "#e8e2d2", roughness: 0.9 });

/** A slab's faces in three's order (+x, -x, up, down, +z, -z): the given top, the back underneath. */
const slab = (top: MeshStandardMaterial, edge: MeshStandardMaterial) => [edge, edge, top, backFace, edge, edge];

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

/** A card slab with its face on top and its back underneath. Pictures arrive later, once their file is here. */
function cardMesh(card: Card, loaded: () => void): Mesh {
  const geometry = new BoxGeometry(CARD.width, THICK, CARD.depth).translate(0, THICK / 2, 0);
  const material = new MeshStandardMaterial({ map: faceTexture(card), roughness: 0.8 });
  const mesh = new Mesh(geometry, slab(material, faceEdge));
  if (card.picture) {
    void getFile(card.picture).then((blob) => {
      if (!blob) return;
      const img = new Image();
      const url = URL.createObjectURL(blob);
      img.onload = () => {
        URL.revokeObjectURL(url);
        material.map?.dispose();
        material.map = faceTexture(card, img);
        material.needsUpdate = true;
        loaded();
      };
      img.onerror = () => URL.revokeObjectURL(url);
      img.src = url;
    });
  }
  return mesh;
}

interface Drawn {
  object: Object3D;
  key: string;
  tag: CSS2DObject;
  /** A card on the table: what turns it over, and which way up it is now. */
  pivot?: Group;
  faceUp?: boolean;
}

/** How long turning a card over takes, in seconds. */
const FLIP = 0.4;

export class Cards {
  private view: TableView;
  private drawn = new Map<string, Drawn>();
  private hovered: string | null = null;
  private labelled: string | null = null;
  private labelTimer: ReturnType<typeof setTimeout> | undefined;
  private flips = new Map<string, { pivot: Group; from: number; to: number; t: number }>();
  private offTick: () => void;

  constructor(view: TableView) {
    this.view = view;
    this.offTick = view.onTick((seconds) => {
      for (const [id, f] of this.flips) {
        f.t = Math.min(1, f.t + seconds / FLIP);
        const ease = f.t * f.t * (3 - 2 * f.t);
        f.pivot.rotation.x = f.from + (f.to - f.from) * ease;
        // Up and over: the card rises as it turns.
        f.pivot.position.y = THICK / 2 + Math.sin(f.t * Math.PI) * 1.6;
        if (f.t === 1) this.flips.delete(id);
      }
      return this.flips.size > 0;
    });
  }

  /** The deck, pile or card the pointer is over ("deck:id", "discard:id" or "card:id"), whose label shows after a moment. */
  hover(key: string | null) {
    if (key === this.hovered) return;
    clearTimeout(this.labelTimer);
    this.drawn.get(this.labelled ?? "")?.tag.element.classList.remove("pointed");
    this.labelled = null;
    this.hovered = key;
    if (key === null) return;
    this.labelTimer = setTimeout(() => {
      this.labelled = key;
      this.drawn.get(key)?.tag.element.classList.add("pointed");
      this.view.invalidate();
    }, LABEL_DELAY);
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
        d.tag.element.classList.toggle("pointed", id === this.labelled);
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
        const h = Math.max(THICK, count * THICK);
        const faint = new MeshStandardMaterial({ color: "#2b3a6b", transparent: true, opacity: 0.3 });
        const stack = new Mesh(new BoxGeometry(CARD.width, h, CARD.depth).translate(0, h / 2, 0), count === 0 ? faint : slab(backFace, backEdge));
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
          ? cardMesh(top, () => this.view.invalidate())
          : new Mesh(
              new PlaneGeometry(CARD.width, CARD.depth).rotateX(-Math.PI / 2),
              new MeshStandardMaterial({ color: "#555555", transparent: true, opacity: 0.25 }),
            );
        pile.position.y = Math.max(0, discarded.length - 1) * THICK;
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
      // The same object across a flip, so it can be seen turning over.
      const key = card.id;
      const at = carried.get(card.id) ?? card.place.position;
      put(`card:${card.id}`, key, at, carried.has(card.id) ? 0.4 : 0, () => {
        const object = new Group();
        object.userData.card = card.id;
        const pivot = new Group();
        pivot.position.y = THICK / 2;
        pivot.rotation.x = faceUp ? 0 : Math.PI;
        const mesh = cardMesh(card, () => this.view.invalidate());
        mesh.position.y = -THICK / 2;
        pivot.add(mesh);
        object.add(pivot);
        const tag = label(faceUp ? card.name : "Card", "label table-card");
        tag.position.y = THICK + 0.2;
        object.add(tag);
        return { object, key, tag, pivot, faceUp };
      });
      const d = this.drawn.get(`card:${card.id}`)!;
      if (d.pivot && d.faceUp !== faceUp) {
        d.faceUp = faceUp;
        d.tag.element.textContent = faceUp ? card.name : "Card";
        this.flips.set(card.id, { pivot: d.pivot, from: d.pivot.rotation.x, to: faceUp ? 0 : Math.PI, t: 0 });
      }
    }
    for (const [id, d] of this.drawn) {
      if (seen.has(id)) continue;
      drop(this.view.root, d.object);
      this.drawn.delete(id);
      this.flips.delete(id.replace(/^card:/, ""));
    }
  }

  dispose() {
    clearTimeout(this.labelTimer);
    this.offTick();
    for (const d of this.drawn.values()) drop(this.view.root, d.object);
    this.drawn.clear();
  }
}
