// The plain data of a game. Realizes design/surfaces/record.html and the concepts it names.
// Positions and sizes on the table are inches; base sizes are millimetres, as on real bases.
// The table's corner is (0, 0); x runs along its width and y along its depth. Up is height.

/** Every id is chosen by whoever takes the action that creates the thing, unique within the game. */
export type PlayerId = string;
export type TerrainId = string;
export type UnitId = string;
export type ModelId = string;
export type GroupId = string;
export type DeckId = string;
export type CardId = string;
export type ItemId = string;
export type MarkerId = string;

/** The hex SHA-256 of a file's bytes: a mesh or a card picture. */
export type Fingerprint = string;

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  depth: number;
}

/** A flat outline a model can stand on, in the piece's own inches, centred on the piece. */
export interface Floor {
  height: number;
  outline: Point[];
}

/** Which floor of which terrain piece a model stands on; null means the table itself. */
export interface FloorRef {
  terrain: TerrainId;
  floor: number;
}

export type Shape =
  | { kind: "box" | "cylinder" | "ramp"; width: number; depth: number; height: number }
  | { kind: "mesh"; mesh: Fingerprint; width: number; depth: number; height: number };

export interface Terrain {
  id: TerrainId;
  name: string;
  shape: Shape;
  position: Point;
  /** Degrees, clockwise from facing +y. */
  facing: number;
  floors: Floor[];
  /** Locked by a player, so nobody picks it up or selects it on the table. Kept when the piece is placed again. */
  locked?: boolean;
}

export interface Base {
  shape: "round" | "oval" | "rect";
  /** Millimetres. A round base has width equal to depth. */
  width: number;
  depth: number;
}

export interface Model {
  id: ModelId;
  unit: UnitId;
  name: string;
  base: Base;
  /** The body: a mesh, or a stand-in of this height in inches when mesh is absent. */
  mesh?: Fingerprint;
  height: number;
  place: ModelPlace;
  /** The waypoints of this model's latest move, so everyone can see the path it took. */
  path: Point[];
}

/**
 * Where a model is (ADR-032): on the table, standing on the table or a floor, or set aside, either in
 * reserve waiting to come onto the table (ADR-025) or removed. Only a model on the table has a position.
 */
export type ModelPlace =
  | { in: "table"; position: Point; facing: number; floor: FloorRef | null }
  | { in: "reserve" }
  | { in: "removed" };

/** Gear a model carries, such as a weapon (ADR-027). It goes where its model goes and has no position. */
export interface Item {
  id: ItemId;
  name: string;
  /** The model that carries it, or the item that holds it. */
  carrier: ModelId | ItemId;
}

/** A flat shape lying on the table that belongs to nobody, such as an objective or a zone (ADR-025). */
export interface Marker {
  id: MarkerId;
  name: string;
  colour: string;
  shape: "disc" | "rect";
  /** Inches. A disc's width is its diameter, and equals its depth. */
  width: number;
  depth: number;
  position: Point;
  facing: number;
}

/** Who the game is waiting on next, and what for (ADR-026). Nobody, when players is empty. */
export interface Priority {
  players: PlayerId[];
  note: string;
}

export interface Unit {
  id: UnitId;
  owner: PlayerId;
  name: string;
}

export interface Group {
  id: GroupId;
  owner: PlayerId;
  name: string;
  /** Units and other groups. */
  members: (UnitId | GroupId)[];
}

export interface Player {
  id: PlayerId;
  name: string;
  colour: string;
  /** The public half of the player's browser key (ADR-022), from their join. */
  publicKey: string;
}

export interface Phase {
  round: number;
  turn: PlayerId | null;
  name: string;
}

/** What a counter or mark is on, saying what kind of thing it is (ADR-032). */
export type Target =
  | { model: ModelId }
  | { unit: UnitId }
  | { group: GroupId }
  | { player: PlayerId }
  | { terrain: TerrainId }
  | { marker: MarkerId }
  | { item: ItemId }
  | { game: true };

/** Something kept for each kind of target: by id for each kind of thing, and once for the game. */
export interface ByTarget<T> {
  model: Record<ModelId, T>;
  unit: Record<UnitId, T>;
  group: Record<GroupId, T>;
  player: Record<PlayerId, T>;
  terrain: Record<TerrainId, T>;
  marker: Record<MarkerId, T>;
  item: Record<ItemId, T>;
  game: T;
}

export type CardPlace =
  | { in: "deck"; deck: DeckId }
  | { in: "hand"; player: PlayerId }
  | { in: "table"; position: Point; faceUp: boolean }
  | { in: "discard"; deck: DeckId };

export interface Card {
  id: CardId;
  name: string;
  text?: string;
  picture?: Fingerprint;
  place: CardPlace;
}

export interface Deck {
  id: DeckId;
  name: string;
  owner: PlayerId | null;
  order: "ordered" | "shuffled";
  /** The cards in the deck. Top first when ordered; no meaning to the order when shuffled. */
  cards: CardId[];
  position: Point;
}

/**
 * Both random values of the sealed exchange (ADR-008). The host commits to hostValue by sending
 * seal = hex SHA-256 of hostValue; the other player then sends guestValue; the host opens the seal.
 * The outcome is derived from both values by the record, the same in every browser.
 * guestBy is the player who sent guestValue, and guestSignature their signature over guestStatement
 * (ADR-022), so the host cannot change guestValue. link is the game the exchange was signed in, so a
 * signature from one game can't be replayed in another. The record keeps the signature but never checks it:
 * Session does, and shows a roll or draw whose signature is wrong as tampered. An empty one is refused.
 * When nobody else is connected, the host may take it alone (ADR-023): guestBy is null, there is no
 * signature, and the host made guestValue too, so the roll or draw is marked as taken alone.
 */
export type Sealed = {
  link: string;
  seal: string;
  hostValue: string;
  guestValue: string;
} & ({ guestBy: PlayerId; guestSignature: string } | { guestBy: null; guestSignature?: undefined });

export interface Roll {
  /** The log number of the roll action. */
  at: number;
  by: PlayerId;
  dice: number;
  sides: number;
  label?: string;
  result: number[];
  /** The seal did not match the host's value. */
  tampered: boolean;
  /** The host rolled with nobody else taking part (ADR-023), so the result is not tamper-evident. */
  alone: boolean;
}

export interface Draw {
  /** The log number of the draw action. */
  at: number;
  by: PlayerId;
  deck: DeckId;
  cards: CardId[];
  to: "hand" | "table";
  /** From a shuffled deck, the seal did not match the host's value. Never true for an ordered deck. */
  tampered: boolean;
  /** From a shuffled deck, the host drew with nobody else taking part (ADR-023). Never true for an ordered deck. */
  alone: boolean;
}

export interface NewModel {
  id: ModelId;
  name: string;
  base: Base;
  mesh?: Fingerprint;
  height: number;
  position: Point;
  facing: number;
  floor: FloorRef | null;
}

/** Counters and marks a new unit, model or item comes with (ADR-027). */
export interface Stats {
  counters?: Record<string, number>;
  marks?: string[];
}

export interface NewItem extends Stats {
  id: ItemId;
  name: string;
  carrier: ModelId | ItemId;
}

export interface NewCard {
  id: CardId;
  name: string;
  text?: string;
  picture?: Fingerprint;
}

/** The twenty-six kinds of action (ADR-015, ADR-024 to ADR-027, ADR-029). Adding a kind is an escalation. */
export type Action = Kind & {
  /** Why, in a line, shown in the log beside the action (ADR-029). A roll's label is its note, so a roll has none. */
  note?: string;
};

export type Kind =
  | { kind: "join"; name: string; colour: string; publicKey: string }
  | { kind: "rename"; name: string; colour: string }
  | { kind: "place terrain"; terrain: Terrain }
  | { kind: "remove terrain"; terrain: TerrainId }
  | { kind: "lock terrain"; terrain: TerrainId[]; locked: boolean }
  | {
      kind: "add to army";
      units: ({ id: UnitId; name: string } & Stats)[];
      models: (NewModel & { unit: UnitId } & Stats)[];
      items?: NewItem[];
      groups: { id: GroupId; name: string; members: (UnitId | GroupId)[] }[];
    }
  | { kind: "move"; moves: { model: ModelId; position: Point; facing: number; floor: FloorRef | null; path: Point[] }[] }
  | { kind: "set aside"; models: ModelId[]; to?: "removed" | "reserve" }
  | { kind: "return"; models: { model: ModelId; position: Point; facing: number; floor: FloorRef | null }[] }
  | { kind: "group"; group: GroupId; name: string; members: (UnitId | GroupId)[] }
  | { kind: "ungroup"; group: GroupId }
  | { kind: "phase"; phase: Phase }
  | { kind: "counter"; target: Target; name: string; value: number | null }
  | { kind: "mark"; target: Target; name: string; on: boolean }
  | ({ kind: "roll"; dice: number; sides: number; label?: string } & Sealed)
  | {
      kind: "add deck";
      deck: DeckId;
      name: string;
      owner: PlayerId | null;
      order: "ordered" | "shuffled";
      /** Top first, when ordered. */
      cards: NewCard[];
      position: Point;
    }
  | { kind: "shuffle"; deck: DeckId }
  /** From an ordered deck, the top cards, with no random values. */
  | { kind: "draw"; deck: DeckId; cards: number; to: "hand" | "table" }
  /** From a shuffled deck, with all three values of the sealed exchange. */
  | ({ kind: "draw"; deck: DeckId; cards: number; to: "hand" | "table" } & Sealed)
  | {
      kind: "move card";
      card: CardId;
      to: CardPlace;
      /** Into an ordered deck: 0 is the top, "bottom" the bottom. */
      at?: number | "bottom";
    }
  | { kind: "item"; item: Item }
  | { kind: "remove item"; item: ItemId }
  | { kind: "place marker"; marker: Marker }
  | { kind: "remove marker"; marker: MarkerId }
  | { kind: "priority"; players: PlayerId[]; note?: string }
  /** The game's rules package by name, or none (ADR-029). */
  | { kind: "rules"; name: string | null }
  | { kind: "undo" };

/** A roll: the action whose values the other player signs. */
export type RollAction = Extract<Action, { kind: "roll" }>;

/** A draw from a shuffled deck: the other kind of action whose values the other player signs. */
export type ShuffledDrawAction = Extract<Action, { kind: "draw" } & Sealed>;

export interface Entry {
  /** Numbered from 1. */
  n: number;
  by: PlayerId;
  action: Action;
}

export interface Log {
  size: Size;
  /** The game's link. Entries copied from a saved file keep the link of the game they were taken in. */
  link: string;
  /** The host of this game. Opening a saved file starts a new game, with its own link and host. */
  host: PlayerId;
  /**
   * How many of the first entries were copied from a saved file. They keep the links they were signed
   * with and are not checked again; every entry after them was checked in this game, against its link.
   */
  copied: number;
  entries: Entry[];
}

/** One moment of the game: everything on the table, plus the hands, decks, rolls and draws. */
export interface Table {
  size: Size;
  players: Record<PlayerId, Player>;
  terrain: Record<TerrainId, Terrain>;
  units: Record<UnitId, Unit>;
  models: Record<ModelId, Model>;
  groups: Record<GroupId, Group>;
  items: Record<ItemId, Item>;
  markers: Record<MarkerId, Marker>;
  phase: Phase;
  priority: Priority;
  /** The rules package the game uses, by name, or null. */
  rules: string | null;
  counters: ByTarget<Record<string, number>>;
  marks: ByTarget<string[]>;
  rolls: Roll[];
  draws: Draw[];
  decks: Record<DeckId, Deck>;
  cards: Record<CardId, Card>;
  /** Log numbers of the actions undo has cancelled. */
  cancelled: number[];
}

/** Why an action can't be appended, in plain words. */
export interface Problem {
  problem: string;
}
