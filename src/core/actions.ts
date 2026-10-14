import type { Args } from "../sdk";
import type { BranchEvent } from "./branch";
import { resolveCardIntent, type Card, type CardCollection, type CardFields } from "./cards";
import { die } from "./dice";
import { inputAnswerProblem } from "./input";
import { eventProblem, jsonProblem } from "./validate";
import { codeActionWhy, startMacro, stepMacro, type LogNote, type MacroStep, type ModuleSet } from "./macro";
import type {
  DiceRoll,
  EntityRef,
  GamePackages,
  GameState,
  Json,
  Mod,
  Model,
  ModelId,
  PackageRef,
  Player,
  PlayerId,
  Pointer,
  Table,
  TerrainPiece,
  Token,
  TokenId,
  Unit,
  UnitId,
  Vec2,
  Zone,
} from "./types";

/** The table layout: terrain, tokens and areas. */
export interface Layout {
  /** The table's size, when the layout brings one. */
  table?: Table;
  terrain: TerrainPiece[];
  tokens: Token[];
  zones: Zone[];
  /** Both arrays replace the card table together; omitting both leaves it unchanged. */
  cards?: Card[];
  cardCollections?: CardCollection[];
}

/** Where a model went in a move: its new place, and the corners it went round on its way (kept in the event for rules that measure). */
interface ModelMove {
  id: ModelId;
  to: Vec2;
  /** Height of the base; omitted means unchanged. */
  z?: number;
  /** A new facing; omitted means unchanged. */
  facing?: number;
  /** Corners the move went round, in order. */
  via?: Vec2[];
}

/** Fields `entity/set` may change: static fields, never identity, containment, reserved seat or the open bags. */
type EntityFields = Record<string, Json>;

/**
 * An Intent is what a player asks for. Only the host turns intents into
 * Events, which is where anything random (dice) gets resolved, so every peer
 * applies exactly the same events in the same order. The core's intents are
 * physical: they move things, roll dice, change quantities and tags, set the
 * pointer, deal with hidden values. A game's own moves are macros
 * (`macro/start`) that a rules module expands into these.
 */
export type Intent =
  | { type: "player/join"; player: Player }
  | { type: "player/claim"; player: PlayerId }
  | {
      type: "player/set";
      player: PlayerId;
      set: { name?: string; color?: string; ready?: boolean; seat?: number | null };
    }
  | { type: "game/system"; system: string }
  | { type: "game/packages"; app: string; system: string; packages: PackageRef[] }
  | { type: "layout/set"; layout: Layout }
  | { type: "terrain/add"; piece: TerrainPiece }
  | { type: "terrain/update"; piece: TerrainPiece }
  | { type: "terrain/remove"; id: string }
  | { type: "unit/add"; unit: Unit; models: Model[] }
  | { type: "unit/remove"; id: UnitId }
  /** Models join or leave a unit (a character joining a squad, a model detached). */
  | { type: "unit/members"; id: UnitId; add?: ModelId[]; remove?: ModelId[] }
  | { type: "model/add"; model: Model }
  | { type: "model/remove"; id: ModelId }
  | { type: "token/add"; token: Token }
  | { type: "token/remove"; id: TokenId }
  | { type: "entity/set"; ref: EntityRef; set: EntityFields }
  /** Several models placed at once, e.g. a squad dragged together. */
  | { type: "models/move"; moves: ModelMove[]; setup?: boolean }
  /** Every model in a unit as one rigid block: rotate by `turn` about `pivot`, then translate by `delta`. */
  | { type: "unit/move"; id: UnitId; pivot: Vec2; turn: number; delta: Vec2 }
  | { type: "q/set"; ref: EntityRef; key: string; value: Json }
  | { type: "q/adjust"; ref: EntityRef; key: string; delta: number }
  | { type: "tag/set"; ref: EntityRef; tag: string; on: boolean }
  | { type: "mod/add"; mod: Omit<Mod, "id"> }
  /** Take off a modifier by id, or every one a source put there. */
  | { type: "mod/remove"; id?: string; source?: string }
  | { type: "pointer/set"; pointer: Pointer }
  | { type: "dice/roll"; count: number; sides: number; faces?: string[]; label?: string }
  | {
      type: "secret/commit";
      player: PlayerId;
      secrets: { key: string; commitment: string }[];
      label?: string;
    }
  | { type: "secret/reveal"; player: PlayerId; key: string; value: unknown; salt: string; label?: string }
  | { type: "collection/add"; collection: CardCollection }
  | { type: "collection/remove"; id: string }
  | { type: "card/add"; card: Card; collection: string; index?: number }
  | { type: "cards/remove"; cards: string[] }
  | { type: "cards/move"; cards: string[]; to: string; index?: number }
  | { type: "card/set"; card: string; set: CardFields }
  | { type: "collection/shuffle"; collection: string }
  | { type: "log/note"; text: string }
  /** Resync a peer (the host answers with the log). */
  | { type: "player/resync" }
  /** Take back an event; `also` lists dependents that go with it (see canUndo). */
  | { type: "undo"; seq: number; also?: number[] }
  /** Start a rules module's macro (a code action or hook). `cause` is the event that set it off. */
  | {
      type: "macro/start";
      macro: string;
      args?: Args;
      cause?: number;
      reaction?: string;
      force?: boolean;
      /** The advisory warning explicitly acknowledged by a forced start. */
      warning?: string;
    }
  /** A player's answer to the question the running macro is waiting on. */
  | { type: "macro/answer"; answer: Json };

/** What a logged event is: an intent as the host resolved it. */
export type GameEvent =
  | { type: "player/join"; player: Player }
  | { type: "player/claim"; player: PlayerId; by: PlayerId }
  | {
      type: "player/set";
      player: PlayerId;
      set: { name?: string; color?: string; ready?: boolean; seat?: number | null };
    }
  | { type: "game/system"; system: string }
  | ({ type: "game/packages" } & GamePackages)
  | { type: "layout/set"; layout: Layout }
  | { type: "terrain/add"; piece: TerrainPiece }
  | { type: "terrain/update"; piece: TerrainPiece }
  | { type: "terrain/remove"; id: string }
  | { type: "unit/add"; unit: Unit; models: Model[] }
  | { type: "unit/remove"; id: UnitId }
  | { type: "unit/members"; id: UnitId; add?: ModelId[]; remove?: ModelId[] }
  | { type: "model/add"; model: Model }
  | { type: "model/remove"; id: ModelId }
  | { type: "token/add"; token: Token }
  | { type: "token/remove"; id: TokenId }
  | { type: "entity/set"; ref: EntityRef; set: EntityFields }
  | { type: "models/move"; moves: ModelMove[]; setup?: boolean }
  | { type: "unit/move"; id: UnitId; pivot: Vec2; turn: number; delta: Vec2 }
  | { type: "q/set"; ref: EntityRef; key: string; value: Json }
  | { type: "q/adjust"; ref: EntityRef; key: string; delta: number }
  | { type: "tag/set"; ref: EntityRef; tag: string; on: boolean }
  | { type: "mod/add"; mod: Mod }
  | { type: "mod/remove"; id?: string; source?: string }
  | { type: "pointer/set"; pointer: Pointer }
  | { type: "dice/roll"; roll: DiceRoll }
  | {
      type: "secret/commit";
      player: PlayerId;
      secrets: { key: string; commitment: string }[];
      label?: string;
    }
  | { type: "secret/reveal"; player: PlayerId; key: string; value: unknown; salt: string; label?: string }
  | { type: "collection/add"; collection: CardCollection }
  | { type: "collection/remove"; id: string }
  | { type: "card/add"; card: Card; collection: string; index?: number }
  | { type: "cards/remove"; cards: string[] }
  | { type: "cards/move"; cards: string[]; to: string; index?: number }
  | { type: "card/set"; card: string; set: CardFields }
  | { type: "collection/shuffle"; collection: string; order: string[] }
  | LogNote
  | ModuleSet
  | { type: "player/resync"; player: PlayerId }
  | BranchEvent
  | MacroStep
  | { type: "undo"; seq: number; also?: number[] };

export type Rng = () => number;

const MAX_DICE_PER_ROLL = 100;

function validatedEvent(event: GameEvent, state?: GameState): GameEvent | null {
  return eventProblem(event, state) === null ? event : null;
}

/**
 * Resolve an intent from `from` into an event, or null if it is rejected.
 * Only malformed or impersonating intents are rejected. Rules are advisory:
 * a move that breaks a game's rules is still applied, and a rules module
 * warns instead.
 */
export function resolveIntent(
  input: unknown,
  from: PlayerId,
  rng: Rng = Math.random,
  state?: GameState,
  /** The state as it stood after an earlier event; macros replay from it. */
  history?: (seq: number) => GameState,
): GameEvent | null {
  if (jsonProblem(input) || !input || typeof input !== "object" || Array.isArray(input)) return null;
  const intent = input as Intent;
  switch (intent.type) {
    case "macro/start": {
      if (
        !state ||
        state.macro ||
        !Object.hasOwn(state.players, from) ||
        typeof intent.macro !== "string" ||
        !intent.macro ||
        (intent.args !== undefined &&
          (!intent.args || typeof intent.args !== "object" || Array.isArray(intent.args))) ||
        (intent.cause !== undefined && (!Number.isSafeInteger(intent.cause) || intent.cause < 0)) ||
        (intent.reaction !== undefined && (typeof intent.reaction !== "string" || !intent.reaction)) ||
        (intent.force !== undefined && typeof intent.force !== "boolean") ||
        (intent.warning !== undefined &&
          (intent.force !== true || typeof intent.warning !== "string" || !intent.warning.trim()))
      )
        return null;
      const args = intent.args ?? {};
      let currentWarning: string | undefined;
      try {
        // Forced starts still recheck callbacks: failures are not rule warnings.
        currentWarning = codeActionWhy(state, intent.macro, args, from);
      } catch {
        return null;
      }
      if (!intent.force && currentWarning !== undefined) return null;
      if (intent.warning !== undefined && currentWarning !== undefined && intent.warning !== currentWarning)
        return null;
      const step = startMacro(state, intent.macro, args, from, rng, intent.cause, intent.reaction);
      const reason = currentWarning ?? intent.warning;
      return step && intent.force && reason !== undefined
        ? {
            ...step,
            events: [
              { type: "log/note", text: `Player override (${intent.macro}): ${reason}` },
              ...step.events,
            ],
          }
        : step;
    }
    case "macro/answer": {
      const macro = state?.macro;
      if (!state || !macro?.waiting || !history || !Object.hasOwn(state.players, from)) return null;
      if (macro.waiting.player !== from) return null;
      if ("input" in macro.waiting) {
        if (inputAnswerProblem(macro.waiting.input, intent.answer)) return null;
      } else if (typeof intent.answer !== "string") {
        // Commitments and reveals retain their string transport and macro-side verification.
        return null;
      }
      return stepMacro(macro, state, history, rng, intent.answer);
    }
    case "dice/roll": {
      if (
        typeof intent.count !== "number" ||
        !Number.isFinite(intent.count) ||
        typeof intent.sides !== "number" ||
        !Number.isFinite(intent.sides) ||
        (intent.faces !== undefined &&
          (!Array.isArray(intent.faces) || !intent.faces.every((face) => typeof face === "string"))) ||
        (intent.label !== undefined && typeof intent.label !== "string")
      )
        return null;
      const count = Math.floor(intent.count);
      const sides = Math.floor(intent.sides);
      if (count < 1 || count > MAX_DICE_PER_ROLL || !Number.isSafeInteger(sides) || sides < 2) return null;
      const results = Array.from({ length: count }, () => die(rng, sides));
      const roll: DiceRoll = { by: from, sides, results };
      if (intent.faces?.length === sides) roll.faces = intent.faces;
      if (intent.label) roll.label = intent.label.slice(0, 60);
      return validatedEvent({ type: "dice/roll", roll }, state);
    }
    case "player/join":
      return eventProblem(intent, state) === null && intent.player.id === from ? intent : null;
    case "player/claim":
      return state && intent.player !== from
        ? validatedEvent({ type: "player/claim", player: intent.player, by: from }, state)
        : null;
    case "player/set": {
      if (!state || intent.player !== from || eventProblem(intent, state)) return null;
      const set: { name?: string; color?: string; ready?: boolean; seat?: number | null } = {};
      if (intent.set.name !== undefined) {
        const name = intent.set.name.trim().slice(0, 32);
        if (!name) return null;
        set.name = name;
      }
      if (intent.set.color !== undefined) {
        set.color = intent.set.color.toLowerCase();
      }
      if (intent.set.ready !== undefined) set.ready = intent.set.ready;
      if (intent.set.seat !== undefined) set.seat = intent.set.seat;
      return validatedEvent({ type: "player/set", player: from, set }, state);
    }
    case "player/resync":
      return validatedEvent({ type: "player/resync", player: from }, state);
    case "secret/commit":
    case "secret/reveal":
      return state && intent.player === from ? validatedEvent(intent, state) : null;
    case "collection/add":
    case "collection/remove":
    case "card/add":
    case "cards/remove":
    case "cards/move":
    case "card/set":
    case "collection/shuffle": {
      if (!state || !Object.hasOwn(state.players, from)) return null;
      const event = resolveCardIntent(intent, state, rng);
      return event && validatedEvent(event, state);
    }
    case "log/note": {
      if (!state || !Object.hasOwn(state.players, from) || eventProblem(intent, state)) return null;
      const text = intent.text.trim().slice(0, 200);
      return text ? validatedEvent({ type: "log/note", text }, state) : null;
    }
    case "mod/add":
      if (!state || !intent.mod || typeof intent.mod !== "object" || Array.isArray(intent.mod)) return null;
      // The id comes from the log position, so every peer names it alike.
      return validatedEvent({ type: "mod/add", mod: { ...intent.mod, id: `m${state.seq + 1}` } }, state);
    case "entity/set":
    case "q/set":
    case "q/adjust":
    case "tag/set":
    case "models/move":
    case "unit/move":
    case "unit/members":
    case "unit/remove":
    case "model/remove":
    case "token/remove":
      return state ? validatedEvent(intent, state) : null;
    case "game/system":
    case "game/packages":
    case "mod/remove":
    case "pointer/set":
    case "layout/set":
    case "unit/add":
    case "model/add":
    case "token/add":
    case "terrain/add":
    case "terrain/update":
    case "terrain/remove":
    case "undo":
      return validatedEvent(intent, state);
    default:
      return null;
  }
}
