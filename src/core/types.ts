import type { BranchInfo } from "./branch";
import type { Secrets } from "./secrets";
import type { Card, CardCollection } from "./cards";
import type { MacroState } from "./macro";

/**
 * Core game-state types. Everything in `src/core` is pure TypeScript with no
 * DOM, three.js or networking imports, so it runs identically on every peer.
 *
 * The core knows physical things: players, units of models, tokens and terrain
 * on a table, cards, hidden values, dice, and a pointer saying where the game
 * is up to. It knows nothing about any game's rules. Games add named
 * quantities (`q`) and tags to these things, and a rules module (a package
 * running in the sandbox) turns its actions into the primitive events here.
 *
 * Units: positions are in inches (1 world unit = 1"). Base sizes stay in
 * millimetres because that is how bases are specified.
 */

export type PlayerId = string;
export type ModelId = string;
export type UnitId = string;
export type TokenId = string;

export interface Vec2 {
  x: number;
  y: number;
}

/** Plain data: what a log can hold and every peer can hash. */
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

/** An entity's open quantities and attributes: whatever its game registers (wounds, CP, a profile). */
export type Bag = Record<string, Json>;

export interface Player {
  id: PlayerId;
  name: string;
  color: string;
  /** Recorded nonnegative integer identifier; its meaning belongs to the game. Missing means unseated. */
  seat?: number;
  /** Says it is ready (advisory: nothing waits on it). */
  ready?: boolean;
  q?: Bag;
  tags?: string[];
}

/**
 * Base footprint. Width runs along the model's facing-perpendicular axis
 * (its frontage); depth runs front to back.
 */
export type BaseShape =
  | { shape: "round"; diameterMm: number }
  | { shape: "oval"; widthMm: number; depthMm: number }
  | { shape: "rect"; widthMm: number; depthMm: number };

interface BodyBand {
  r: number;
  z0: number;
  z1: number;
}

export interface Model {
  id: ModelId;
  owner: PlayerId;
  label: string;
  /** Centre of the base on the table, in inches. (0,0) is the table centre. */
  position: Vec2;
  /** Facing in radians; 0 faces +y (towards the far table edge). */
  facing: number;
  base: BaseShape;
  /** The unit this model belongs to, if any. */
  unitId?: UnitId;
  /** Off the table (removed, in reserve): retained in state, unavailable to geometry queries. */
  off?: boolean;
  /** Height of the base above the table, in inches (standing on a terrain floor). */
  z?: number;
  /** Physical body height in inches; defaults to the larger base dimension. */
  height?: number;
  /**
   * Physical body volume: stacked cylinders of radius `r`, from `z0` to
   * `z1` above the base. Without bands, the base is extruded to `height`:
   * a rectangular prism or an elliptic cylinder. This is not a sight rule.
   */
  bands?: BodyBand[];
  q?: Bag;
  tags?: string[];
}

export interface Unit {
  id: UnitId;
  owner: PlayerId;
  name: string;
  modelIds: ModelId[];
  q?: Bag;
  tags?: string[];
}

/** A marker on the table: an objective, a template, a card, a counter. Whatever the game says `kind` is. */
export interface Token {
  id: TokenId;
  kind: string;
  owner?: PlayerId;
  position: Vec2;
  facing?: number;
  z?: number;
  /** Omitted means a point, not a miniature-sized proxy. */
  base?: BaseShape;
  /** Physical body height in inches; with a base, defaults to its larger dimension. */
  height?: number;
  bands?: BodyBand[];
  label?: string;
  q?: Bag;
  tags?: string[];
}

/** The things that carry quantities and tags. */
export type EntityKind = "player" | "unit" | "model" | "token";

export interface EntityRef {
  kind: EntityKind;
  id: string;
}

/**
 * A change to a quantity that is kept as a record, never as a result. The
 * quantity's value is worked out from its base and these (core/quantity.ts).
 * With `until`, it holds only while the pointer's `field` still equals `is`.
 */
export interface Mod {
  id: string;
  target: EntityRef;
  q: string;
  op: "add" | "set" | "min" | "max";
  value: number;
  /** Who put it there, for the log and for taking it off ("Aura of Courage"). */
  source?: string;
  until?: { field: string; is: Json };
}

export interface DiceRoll {
  by: PlayerId;
  sides: number;
  results: number[];
  /** What the roll was for, for the log: "charge". The core attaches no meaning to it. */
  label?: string;
  /** Named faces (a scatter or artillery die): each result is a 1-based index into these. */
  faces?: string[];
}

/**
 * A box in a terrain piece's local space: x/y are the centre on the
 * footprint (x = right, y = forward), z the bottom, and w/d/h the size in
 * inches. Terrain is made of these, so the same shapes can be drawn and
 * measured. There is no physics or implicit sight classification.
 */
export interface TerrainSolid {
  /** Descriptive only: the package explicitly selects which boxes a query intersects. */
  kind: "wall" | "floor" | "block" | "foliage";
  x: number;
  y: number;
  z: number;
  w: number;
  d: number;
  h: number;
}

/** What a game calls a piece of terrain ("ruin", "wood"); the core attaches no meaning to it. */
type TerrainCategory = string;

/** A terrain piece: a rectangular footprint, rotated by `facing`, with solids on it. */
export interface TerrainPiece {
  id: string;
  name: string;
  category: TerrainCategory;
  position: Vec2;
  width: number;
  depth: number;
  facing: number;
  solids: TerrainSolid[];
  /**
   * Optional triangle surface in local inches, z up:
   * [x,y,z, x,y,z, x,y,z, ...]. A query explicitly chooses mesh or solids;
   * neither automatically replaces the other.
   */
  hull?: number[];
  /** Package-defined classification and rules data, never interpreted by geometry. */
  q?: Bag;
  tags?: string[];
}

/** A convex polygon associated with a seat identifier; its purpose belongs to the game. */
export interface Zone {
  seat: number;
  points: Vec2[];
}

/**
 * Where the game is up to. The core only stores it: a rules module decides
 * what the fields mean and what comes next. `round`, `seat` and `phase` are
 * conventional fields; a module may add more (a step, an activation counter).
 */
export interface Pointer {
  round: number;
  /** A nonnegative integer identifier whose meaning belongs to the game. */
  seat: number;
  phase: string | null;
  [field: string]: Json;
}

export interface Table {
  /** Width (x) in inches. */
  width: number;
  /** Depth (y) in inches. */
  depth: number;
}

export interface GameState {
  /** Sequence number of the last event folded into this state (0 = none). */
  seq: number;
  table: Table;
  players: Record<PlayerId, Player>;
  units: Record<UnitId, Unit>;
  models: Record<ModelId, Model>;
  tokens: Record<TokenId, Token>;
  terrain: TerrainPiece[];
  zones: Zone[];
  pointer: Pointer;
  /** Active modifiers, in the order they were added. */
  mods: Mod[];
  /** The rules module this game plays (the id its package names); none until one is chosen. */
  system?: string;
  /** The code this game runs: the latest game/packages event. */
  packages?: GamePackages;
  /** The macro running, if any, waiting on a player (core/macro.ts). */
  macro?: MacroState | null;
  /** Rules modules' own state: module id → key → value. */
  modules?: Record<string, Record<string, Json>>;
  /** Players' committed secrets (core/secrets.ts): commitments, and values once revealed. */
  secrets?: Secrets;
  /** Replicated card identities and ordered collections (core/cards.ts). */
  cards: Record<string, Card>;
  cardCollections: Record<string, CardCollection>;
  /** This game branched from another one's history (core/branch.ts). */
  branch?: BranchInfo;
}

/** A 44" x 60" board. */
export const DEFAULT_TABLE: Table = { width: 60, depth: 44 };

export function createInitialState(table: Table = DEFAULT_TABLE): GameState {
  return {
    seq: 0,
    table,
    players: {},
    units: {},
    models: {},
    tokens: {},
    cards: {},
    cardCollections: {},
    terrain: [],
    zones: [],
    pointer: { round: 0, seat: 0, phase: null },
    mods: [],
  };
}

/** A rules package as a game names it: identity is the hash of its bytes. */
export interface PackageRef {
  id: string;
  name: string;
  version: string;
  author?: string;
  hash: string;
  bytes: number;
  /** "system": the package is a whole game, not rules added to one. */
  kind?: "system";
}

export interface GamePackages {
  /** App version + commit: covers the reducer. */
  app: string;
  /** The module id the game plays. */
  system: string;
  packages: PackageRef[];
}
