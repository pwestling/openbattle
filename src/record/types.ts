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
  position: Point;
  facing: number;
  floor: FloorRef | null;
  /** The waypoints of this model's latest move, so everyone can see the path it took. */
  path: Point[];
  aside: boolean;
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

/** A counter or mark target: a model, unit, group or player id, or "game". */
export type Target = string;

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
 * guestSignature is the other player's signature over the seal and guestValue (ADR-022), so the host
 * cannot change guestValue. The record keeps it but never checks it: Session does.
 */
export interface Sealed {
  seal: string;
  hostValue: string;
  guestValue: string;
  guestSignature: string;
}

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

export interface NewCard {
  id: CardId;
  name: string;
  text?: string;
  picture?: Fingerprint;
}

/** The nineteen kinds of action (ADR-015). Adding a kind is an escalation. */
export type Action =
  | { kind: "join"; name: string; colour: string; publicKey: string }
  | { kind: "rename"; name: string; colour: string }
  | { kind: "place terrain"; terrain: Terrain }
  | { kind: "remove terrain"; terrain: TerrainId }
  | {
      kind: "add to army";
      units: { id: UnitId; name: string }[];
      models: (NewModel & { unit: UnitId })[];
      groups: { id: GroupId; name: string; members: (UnitId | GroupId)[] }[];
    }
  | { kind: "move"; moves: { model: ModelId; position: Point; facing: number; floor: FloorRef | null; path: Point[] }[] }
  | { kind: "set aside"; models: ModelId[] }
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
  | { kind: "undo" };

export interface Entry {
  /** Numbered from 1. */
  n: number;
  by: PlayerId;
  action: Action;
}

export interface Log {
  size: Size;
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
  phase: Phase;
  counters: Record<Target, Record<string, number>>;
  marks: Record<Target, string[]>;
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
