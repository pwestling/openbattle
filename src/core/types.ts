import type { SharedDice } from "./sharedDice";
import type { BranchInfo } from "./branch";
import type { Secrets } from "./secrets";
import type { CardDeck, CardPile } from "./cards";
import type { RankedState } from "./ranked";
import type { MacroState } from "./macro";

/**
 * Core game-state types. Everything in `src/core` is pure TypeScript with no
 * DOM, three.js or networking imports, so it runs identically on every peer.
 *
 * The core knows physical things: players, units of models, tokens and terrain
 * on a table, decks, hidden values, dice, and a pointer saying where the game
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
  /** Table side: 0 sits at the +y edge, 1 at the -y edge. */
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

interface SightBand {
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
  /** Off the table (removed, in reserve): it keeps its place in the state, but blocks and sees nothing. */
  off?: boolean;
  /** Height of the base above the table, in inches (standing on a terrain floor). */
  z?: number;
  /** Height of the miniature in inches, for line of sight. Defaults from the base size. */
  height?: number;
  /**
   * Line-of-sight shape: 1-4 stacked bands, each a cylinder of radius `r`
   * from `z0` to `z1` (inches above the base). Without it the model is one
   * cylinder of its base size.
   */
  bands?: SightBand[];
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
 * inches. Terrain is made of these, so the same shapes are drawn on the
 * table and used for line of sight and floors. There is no physics.
 */
export interface TerrainSolid {
  /** wall and block stop line of sight; floor also gives models a level to stand on; foliage is only visual. */
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
  /** Stand-in height for "heights" line of sight; defaults to the top of its tallest solid. */
  losHeight?: number;
  /**
   * How this piece blocks sight, overriding the game's setting: "heights" makes
   * it a block of its stand-in height even in a true line of sight game;
   * "true" uses its shape in a "heights" game.
   */
  sight?: "true" | "heights";
  /**
   * For "footprint" line of sight: open terrain does nothing, obscuring terrain
   * gives cover when it lies between the two bases' centres, and blocking
   * terrain stops sight across its footprint. Defaults from the piece's height.
   */
  visibility?: "open" | "obscuring" | "blocking";
  /**
   * Optional low-poly line-of-sight mesh: triangles as flat
   * [x,y,z, x,y,z, x,y,z, ...] in local inches, z up. When present it blocks
   * sight instead of the solids; floors still come from the solids.
   */
  hull?: number[];
}

/** A deployment or scoring area as a convex polygon owned by a seat. */
export interface Zone {
  seat: number;
  points: Vec2[];
}

/**
 * Where the game is up to. The core only stores it: a rules module decides
 * what the fields mean and what comes next. `round`, `seat` and `phase` are
 * the conventional ones (and what clocks and ladders read); a module may add
 * more (a step, an activation counter).
 */
export interface Pointer {
  round: number;
  /** The seat whose turn it is. */
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
  /** The table's card decks (core/cards.ts), and each player's discards from them. */
  decks?: CardDeck[];
  cardPiles?: Record<PlayerId, Record<string, CardPile>>;
  /** This game branched from another one's history (core/branch.ts). */
  branch?: BranchInfo;
  /** A ranked game: the players' keys (core/ranked.ts). */
  ranked?: RankedState;
  /** A ranked game's shared dice for this stretch (core/sharedDice.ts). */
  sharedDice?: SharedDice;
  /** Table options the players agreed on. */
  settings: GameSettings;
}

export interface GameSettings {
  /** Whether models from other units block line of sight. */
  modelsBlock: boolean;
  /**
   * Which models block, where not all: only the enemy's, and a target with
   * one of the `tall` tags only behind a model whose unit has one too.
   */
  blockers?: { enemiesOnly?: boolean; tall?: string[] };
  /**
   * How line of sight works. "true" traces the model and terrain shapes.
   * "heights" uses stand-in heights: every terrain piece is a flat-topped
   * block of its stand-in height, every model a cylinder of its height.
   * "footprint" ignores height: lines run across the table from the centre of
   * the observer's base, and each piece is open, obscuring or blocking (see
   * TerrainPiece.visibility). Missing means "true".
   */
  los?: "true" | "heights" | "footprint";
  /** Vision arc in degrees, centred on each model's facing. Missing means models see all around. */
  visionArc?: number;
  /** Players per side (2 for a 2v2). Missing means one each. */
  teamSize?: number;
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
    terrain: [],
    zones: [],
    pointer: { round: 0, seat: 0, phase: null },
    mods: [],
    settings: { modelsBlock: true },
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
