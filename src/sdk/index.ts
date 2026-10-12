import type { GameEvent, Layout } from "../core/actions";
import type { EntityKind, EntityRef, GameState, Json, Mod, Pointer, Table, Unit } from "../core/types";

/**
 * The rules module API, version 2. A game is a package whose default export is
 * a module (`defineModule`). The core knows only physical things: units of
 * models, tokens and terrain on a table, decks, hidden values, dice and a
 * pointer saying where the game is up to. A module says what the game adds:
 *
 * - `quantities`: the named numbers its entities carry (wounds, command
 *   points), which events and modifiers change.
 * - `pointer`: the phases the pointer moves through. The core stores the
 *   pointer; the module decides what "next" means (see `ctx.emit`).
 * - `actions` and `macros`: shorthand for collections of the core's primitive
 *   events. A macro is a generator: it yields commands (roll, ask, emit, ...)
 *   and the host turns what it emits into ordinary events in the log.
 * - `hooks`: macros started after logged events of chosen types, such as a
 *   move that triggers a reaction.
 *
 * Module code only ever runs on the host, in the sandbox, when a new intent
 * is resolved. Its effects reach every peer as plain events, so replays,
 * undo, late joining and desync checks need no module code.
 */

export const MODULE_API = 2;

export type Id = string;

export interface QuantityDef {
  id: Id;
  name: string;
  /** Which kind of entity carries it. */
  on: EntityKind;
  /** What a new entity of that kind starts with, if it starts with one. */
  initial?: Json;
  /** A sentence for the panel that shows it. */
  hint?: string;
}

export interface PhaseDef {
  /** What `pointer.phase` holds while the game is in it. */
  id: Id;
  name: string;
  hint?: string;
}

export interface ModuleDef {
  /** The game's id: stored in every save, so it never changes. */
  id: Id;
  name: string;
  /** Semver. */
  version: string;
  api: typeof MODULE_API;
  /** The table a fresh game starts on. */
  table?: Table;
  /** The starting table: terrain, tokens, zones, decks. */
  layout?(table: Table): Layout;
  quantities?: QuantityDef[];
  pointer?: PhaseDef[];
  actions?: CodeAction[];
  /** Macros by id, for hooks and panel buttons to start. */
  macros?: Record<Id, Macro>;
  /** Macros started after a logged event of the type that names them, one at a time. */
  hooks?: { on?: Record<string, Macro> };
  /** A side panel, described as data (a package cannot ship React components). */
  panel?(view: GameView): PanelSpec | null;
}

export function defineModule(def: ModuleDef): ModuleDef {
  return def;
}

/** A rule as a generator: it yields commands and gets their results back. */
export type Macro = (ctx: Ctx, args: Args) => Generator<Command, void, unknown>;

/** A macro's arguments: what its starter sent, and `by`, the player who started it (always set by the host). */
export type Args = Record<string, Json>;

export interface Actor {
  player: Id;
  unitId?: Id;
}

export interface Target {
  unitId?: Id;
  label: string;
}

export interface CodeAction {
  id: Id;
  name: string;
  by: "unit" | "player";
  /** Pointer phases it can be taken in; any when missing. */
  phases?: Id[];
  /** Whether the unit could ever take it; hidden otherwise. */
  applies?(view: GameView, actor: Actor): boolean;
  /** The button's text for this unit, when it says more than `name`. */
  label?(view: GameView, actor: Actor): string;
  /** True, or why not. */
  available(view: GameView, actor: Actor): true | string;
  targets?(view: GameView, actor: Actor): Target[];
  run: Macro;
}

/** Read-only game access. A module sees the table as the host folded it. */
export interface GameView {
  /** The whole state, read-only. */
  state: Readonly<GameState>;
  pointer: Readonly<Pointer>;
  /** A quantity's value now: its stored base with the modifiers that hold. */
  q(ref: EntityRef, key: string, fallback?: number): number;
  /** Modifiers that hold now, on one entity or all. */
  mods(ref?: EntityRef): Mod[];
  /** A modifier's `until` for "while the pointer's `field` stays as it is now". */
  until(field: string): { field: string; is: Json };
  /** The units of a player, or all, that have a model on the table. */
  units(player?: Id): Unit[];
  /** Edge to edge in inches, between units, models or tokens (ids of any). */
  distance(a: Id, b: Id): number;
  /** Whether any model of `from` sees any model of `to`. */
  visible(from: Id, to: Id): boolean;
  /** The best sight any model of `from` has on `to`: how much is seen, and which terrain pieces hide the rest. */
  sight(from: Id, to: Id): { visible: boolean; fully: boolean; fraction: number; obscuredBy: Id[] };
  /** Degrees from the way `of` faces to where `other` is: 0 dead ahead, positive to the right, within -180..180. */
  angle(of: Id, other: Id): number;
  /** This module's own state, `state.modules[id]`. */
  own: Record<string, Json>;
}

/** Commands a macro yields; each result is recorded for replay. */
export type Command =
  | { cmd: "roll"; dice: string; label?: string }
  | { cmd: "note"; text: string }
  | { cmd: "ask"; player: Id; question: string; options: { id: Id; label: string }[] }
  | { cmd: "emit"; event: GameEvent }
  | { cmd: "set"; key: string; value: Json }
  | { cmd: "secret"; player: Id; key: string; question: string; options: { id: Id; label: string }[] }
  | { cmd: "reveal"; player: Id; key: string };

export interface Ctx {
  /** The table as the macro last saw it: it moves on after an answer, and with the macro's own events. */
  view: GameView;
  /** Dice from the host's rng, e.g. "2D6". The result is `{ rolls, total }`. */
  roll(dice: string, label?: string): Command;
  /** A line in the game log. */
  note(text: string): Command;
  /** Ask a player to choose. The macro pauses; any move on the table in the meantime shows in `view`. */
  ask(player: Id, question: string, options: { id: Id; label: string }[]): Command;
  /**
   * Change the table with one of the core's primitive events, e.g.
   * `{ type: "q/adjust", ref, key: "wounds", delta: -1 }` or
   * `{ type: "pointer/set", pointer }`. Only the table's primitives are
   * accepted: not players, packages, secrets, dice or undo.
   */
  emit(event: GameEvent): Command;
  /** Keep a value in this module's own state. */
  set(key: string, value: Json): Command;
  /**
   * Ask a player to choose an option in secret (a hidden order, a secret
   * objective). Their device keeps the choice and puts only a commitment on
   * the table (`view.state.secrets[player][key]`), so nobody else, the host
   * included, learns it. The result is the commitment.
   */
  secret(player: Id, key: string, question: string, options: { id: Id; label: string }[]): Command;
  /**
   * Have a player reveal a secret they committed. Their device sends the
   * value, every player checks it against the commitment, and the result is
   * the value (straight away if it was already revealed).
   */
  reveal(player: Id, key: string): Command;
}

/**
 * A package game's side panel, described as data. The app draws it and runs a
 * button's macro when it is pressed.
 */
export interface PanelSpec {
  title: string;
  lines?: string[];
  buttons?: {
    label: string;
    macro: Id;
    args?: Args;
    /** Who presses it; the player whose turn it is when missing. */
    player?: Id;
    /** Why it can't be pressed now. */
    disabled?: string;
  }[];
}
