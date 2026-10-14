import type { GameEvent, Intent, Rng } from "./actions";
import type { GameState, Vec2 } from "./types";

/** Cell `index` (left to right, then down) in a `cols` × `rows` image. */
export interface CardFace {
  url: string;
  cols: number;
  rows: number;
  index: number;
}

export type CardVisibility = "all" | string[];

/** Card data is replicated. Visibility is a presentation permission, not confidentiality. */
export interface Card {
  id: string;
  name: string;
  face?: CardFace;
  back?: CardFace;
  owner?: string | null;
  visibility: CardVisibility;
  faceUp: boolean;
  position?: Vec2;
  facing?: number;
}

/** Ordered membership only; packages give collections their roles. Index zero is the top. */
export interface CardCollection {
  id: string;
  name: string;
  cards: string[];
}

export type CardFields = Partial<Omit<Card, "id">>;
export type CardView = Omit<Card, "name" | "face"> & {
  name?: string;
  face?: CardFace;
  visible: boolean;
};

type CardEvent = Extract<
  GameEvent,
  {
    type:
      | "collection/add"
      | "collection/remove"
      | "card/add"
      | "cards/remove"
      | "cards/move"
      | "card/set"
      | "collection/shuffle";
  }
>;
type ShuffleEvent = Extract<CardEvent, { type: "collection/shuffle" }>;

export function canSeeCard(card: Card, player: string | null): boolean {
  return card.visibility === "all" || (player !== null && card.visibility.includes(player));
}

export function cardView(card: Card, player: string | null): CardView {
  const { name, face, ...rest } = card;
  const visible = canSeeCard(card, player);
  return { ...rest, ...(visible ? { name, ...(face ? { face } : {}) } : {}), visible };
}

export function cardsIn(state: GameState, collection: string, player: string | null): CardView[] {
  if (!Object.hasOwn(state.cardCollections, collection)) return [];
  return state.cardCollections[collection]!.cards.map((id) => cardView(state.cards[id]!, player));
}

const ID = /^[A-Za-z0-9_.:-]{1,64}$/;
const FIELDS: Readonly<Record<string, true>> = {
  name: true,
  face: true,
  back: true,
  owner: true,
  visibility: true,
  faceUp: true,
  position: true,
  facing: true,
};
const object = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === "object" && !Array.isArray(x);
const finite = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const id = (x: unknown): x is string =>
  typeof x === "string" && ID.test(x) && x !== "__proto__" && x !== "constructor" && x !== "prototype";

function faceProblem(face: unknown): string | undefined {
  if (
    !object(face) ||
    typeof face.url !== "string" ||
    face.url.length > 2000 ||
    !/^https?:\/\/[^\s"'()\\]+$/i.test(face.url)
  )
    return "card picture needs a safe HTTP(S) URL";
  if (
    !Number.isInteger(face.cols) ||
    !Number.isInteger(face.rows) ||
    (face.cols as number) < 1 ||
    (face.cols as number) > 10 ||
    (face.rows as number) < 1 ||
    (face.rows as number) > 10
  )
    return "card picture rows and columns must be integers from 1 to 10";
  if (
    !Number.isInteger(face.index) ||
    (face.index as number) < 0 ||
    (face.index as number) >= (face.cols as number) * (face.rows as number)
  )
    return "card picture index is outside the sheet";
  return undefined;
}

function fieldsProblem(fields: unknown, state?: GameState): string | undefined {
  if (!object(fields) || Object.keys(fields).some((key) => !Object.hasOwn(FIELDS, key)))
    return "invalid card fields";
  for (const [key, value] of Object.entries(fields)) {
    switch (key) {
      case "name":
        if (typeof value !== "string") return "card name must be a string";
        break;
      case "face":
      case "back": {
        const problem = faceProblem(value);
        if (problem) return problem;
        break;
      }
      case "owner":
        if (value !== null && (!id(value) || (state && !Object.hasOwn(state.players, value))))
          return "card owner must be a known player or null";
        break;
      case "visibility":
        if (
          value !== "all" &&
          (!Array.isArray(value) ||
            value.some((player) => !id(player) || (state && !Object.hasOwn(state.players, player))) ||
            new Set(value).size !== value.length)
        )
          return "card visibility must be all or a unique list of known players";
        break;
      case "faceUp":
        if (typeof value !== "boolean") return "card faceUp must be a boolean";
        break;
      case "position":
        if (!object(value) || !finite(value.x) || !finite(value.y)) return "card position must be finite";
        break;
      case "facing":
        if (!finite(value)) return "card facing must be finite";
        break;
    }
  }
  return undefined;
}

function cardProblem(card: unknown, state?: GameState): string | undefined {
  if (!object(card) || !id(card.id)) return "card needs a safe id";
  const { id: _id, ...fields } = card;
  if (
    !Object.hasOwn(fields, "name") ||
    !Object.hasOwn(fields, "visibility") ||
    !Object.hasOwn(fields, "faceUp")
  )
    return "card needs name, visibility and faceUp";
  return fieldsProblem(fields, state);
}

function idsProblem(ids: unknown): string | undefined {
  return !Array.isArray(ids) || ids.some((value) => !id(value)) || new Set(ids).size !== ids.length
    ? "card ids must be a unique list of safe ids"
    : undefined;
}

function collectionProblem(collection: unknown): string | undefined {
  if (!object(collection) || !id(collection.id) || typeof collection.name !== "string")
    return "collection needs a safe id and name";
  return idsProblem(collection.cards);
}

/** Validate a replacement card table, including exactly-one collection membership. */
export function cardLayoutProblem(layout: unknown, state?: GameState): string | undefined {
  if (!object(layout)) return "layout must be an object";
  if (!Array.isArray(layout.terrain) || !Array.isArray(layout.tokens) || !Array.isArray(layout.zones))
    return "layout needs terrain, tokens and zones arrays";
  const hasCards = Object.hasOwn(layout, "cards");
  const hasCollections = Object.hasOwn(layout, "cardCollections");
  if (!hasCards && !hasCollections) return undefined;
  if (!hasCards || !hasCollections || !Array.isArray(layout.cards) || !Array.isArray(layout.cardCollections))
    return "layout cards and cardCollections must be supplied together as arrays";
  const cards = new Set<string>();
  for (const card of layout.cards) {
    const problem = cardProblem(card, state);
    if (problem) return problem;
    const cid = (card as Card).id;
    if (cards.has(cid)) return "duplicate card id";
    cards.add(cid);
  }
  const collections = new Set<string>();
  const members = new Set<string>();
  for (const collection of layout.cardCollections) {
    const problem = collectionProblem(collection);
    if (problem) return problem;
    const c = collection as CardCollection;
    if (collections.has(c.id)) return "duplicate collection id";
    collections.add(c.id);
    for (const cid of c.cards) {
      if (!cards.has(cid)) return "collection references an unknown card";
      if (members.has(cid)) return "card belongs to more than one collection";
      members.add(cid);
    }
  }
  return members.size === cards.size ? undefined : "every card must belong to one collection";
}

function membershipProblem(state: GameState): string | undefined {
  const members = new Set<string>();
  for (const [key, collection] of Object.entries(state.cardCollections)) {
    if (key !== collection.id || collectionProblem(collection)) return "invalid card collection state";
    for (const cid of collection.cards) {
      if (!Object.hasOwn(state.cards, cid) || members.has(cid)) return "invalid card membership state";
      members.add(cid);
    }
  }
  return members.size === Object.keys(state.cards).length
    ? undefined
    : "every card must belong to one collection";
}

const insertionProblem = (index: unknown, length?: number): string | undefined =>
  index !== undefined &&
  (!Number.isInteger(index) || (index as number) < 0 || (length !== undefined && (index as number) > length))
    ? "card insertion index is out of range"
    : undefined;

/** Without state, checks shape only; with state, checks table mechanics and player references too. */
export function cardEventProblem(event: unknown, state?: GameState): string | undefined {
  if (!object(event)) return "not a card event";
  let problem: string | undefined;
  switch (event.type) {
    case "collection/add":
      problem = collectionProblem(event.collection);
      if (problem) return problem;
      if ((event.collection as CardCollection).cards.length) return "new collection must be empty";
      break;
    case "collection/remove":
      if (!id(event.id)) return "collection needs a safe id";
      break;
    case "card/add":
      problem =
        cardProblem(event.card, state) ??
        (!id(event.collection) ? "collection needs a safe id" : undefined) ??
        insertionProblem(event.index);
      if (problem) return problem;
      break;
    case "cards/remove":
    case "cards/move":
      problem = idsProblem(event.cards);
      if (problem) return problem;
      if (!(event.cards as string[]).length) return "card batch must not be empty";
      if (event.type === "cards/move") {
        if (!id(event.to)) return "destination collection needs a safe id";
        problem = insertionProblem(event.index);
        if (problem) return problem;
      }
      break;
    case "card/set":
      if (!id(event.card)) return "card needs a safe id";
      problem = fieldsProblem(event.set, state);
      if (problem) return problem;
      if (!Object.keys(event.set as CardFields).length) return "card/set needs fields";
      break;
    case "collection/shuffle":
      if (!id(event.collection)) return "collection needs a safe id";
      problem = idsProblem(event.order);
      if (problem) return problem;
      break;
    default:
      return "not a card event";
  }
  if (!state) return undefined;
  problem = membershipProblem(state);
  if (problem) return problem;
  const e = event as CardEvent;
  switch (e.type) {
    case "collection/add":
      return Object.hasOwn(state.cardCollections, e.collection.id) ? "collection already exists" : undefined;
    case "collection/remove": {
      const c = Object.hasOwn(state.cardCollections, e.id) ? state.cardCollections[e.id] : undefined;
      return !c ? "unknown collection" : c.cards.length ? "collection must be empty to remove" : undefined;
    }
    case "card/add": {
      if (Object.hasOwn(state.cards, e.card.id)) return "card already exists";
      const c = Object.hasOwn(state.cardCollections, e.collection)
        ? state.cardCollections[e.collection]
        : undefined;
      return !c ? "unknown collection" : insertionProblem(e.index, c.cards.length);
    }
    case "cards/remove":
    case "cards/move": {
      if (e.cards.some((cid) => !Object.hasOwn(state.cards, cid))) return "unknown card";
      if (e.type === "cards/remove") return undefined;
      const c = Object.hasOwn(state.cardCollections, e.to) ? state.cardCollections[e.to] : undefined;
      if (!c) return "unknown destination collection";
      const moved = new Set(e.cards);
      return insertionProblem(
        e.index,
        c.cards.reduce((length, cid) => length + (moved.has(cid) ? 0 : 1), 0),
      );
    }
    case "card/set":
      return Object.hasOwn(state.cards, e.card) ? undefined : "unknown card";
    case "collection/shuffle": {
      const c = Object.hasOwn(state.cardCollections, e.collection)
        ? state.cardCollections[e.collection]
        : undefined;
      if (!c) return "unknown collection";
      const order = new Set(e.order);
      return order.size === c.cards.length && c.cards.every((cid) => order.has(cid))
        ? undefined
        : "shuffle order must be a permutation of the collection";
    }
  }
}

/** Host-only Fisher-Yates; the reducer receives the resulting permutation, never an RNG. */
export function shuffleCollection(state: GameState, collection: string, rng: Rng): ShuffleEvent | null {
  if (!id(collection) || !Object.hasOwn(state.cardCollections, collection) || membershipProblem(state))
    return null;
  const order = [...state.cardCollections[collection]!.cards];
  for (let i = order.length - 1; i > 0; i--) {
    const random = rng();
    if (!finite(random) || random < 0 || random >= 1) return null;
    const j = Math.floor(random * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  return { type: "collection/shuffle", collection, order };
}

export function resolveCardIntent(intent: Intent, state: GameState, rng: Rng): GameEvent | null {
  if (intent.type === "collection/shuffle") return shuffleCollection(state, intent.collection, rng);
  return cardEventProblem(intent, state) === undefined ? (intent as CardEvent) : null;
}
