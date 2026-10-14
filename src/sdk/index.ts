import type { GameEvent, Layout } from "../core/actions";
import type { CardView } from "../core/cards";
import type { GeometryView as CoreGeometryView } from "../core/los";
export type {
  GeometryRef,
  GeometryBlocker,
  SegmentHit,
  SegmentHit2D,
  SampleOptions,
  SampleMeasurement,
} from "../core/los";
import type { EntityKind, EntityRef, GameState, Json, Mod, Pointer, Table, Unit } from "../core/types";
export type { Vec3 } from "../core/terrain";
export type { Vec2 } from "../core/types";
import type { InputSpec } from "../core/input";
export type { InputSpec, InputAnswer, InputOption, InputRef } from "../core/input";
import type { SetupSpec } from "../core/setup";
export type { SetupSpec, SetupField } from "../core/setup";

/**
 * The rules module API, version 12. A game is a package whose default export is
 * a module (`defineModule`). The core knows only physical things: units of
 * models, tokens and terrain on a table, cards in ordered collections, hidden values, dice and a
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
 * Only the host resolves macros into effects. Trusted peers may run pure
 * presentation callbacks (actions, panels, setup forms) in their own sandboxes
 * against frozen views. Effects reach every peer as plain events, so completed
 * replay, undo, late joining and desync checks need no module code.
 */

export const MODULE_API = 12;

export type Id = string;

/** Readonly JSON has the same wire shape as Json, without recursive mapped-type expansion. */
export type ReadonlyJson =
  null | boolean | number | string | readonly ReadonlyJson[] | { readonly [key: string]: ReadonlyJson };

/** Callback data is frozen recursively. Function arguments stay caller-owned;
 * query results become deeply readonly as well.
 */
export type DeepReadonly<T> = T extends (...args: infer A) => infer R
  ? (...args: A) => DeepReadonly<R>
  : T extends readonly (infer Item)[]
    ? ReadonlyArray<DeepReadonly<Item>>
    : T extends object
      ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
      : T;

export type GeometryView = DeepReadonly<CoreGeometryView>;

export interface QuantityDef {
  id: Id;
  name: string;
  /** Which kind of entity carries it. */
  on: EntityKind;
  /** A suggested starting value. Authoring helpers explicitly copy it into new
   * entity events; the reducer never applies defaults or reads definitions.
   */
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
  /** The starting table: terrain, tokens, zones, cards and ordered collections. */
  layout?(table: DeepReadonly<Table>): Layout;
  quantities?: QuantityDef[];
  pointer?: PhaseDef[];
  actions?: CodeAction[];
  /** Macros by id, for hooks and panel buttons to start. */
  macros?: Record<Id, Macro>;
  /** Macros started after a logged event of the type that names them, one at a time. */
  hooks?: { on?: Record<string, Macro> };
  /** A side panel, described as data (a package cannot ship React components). */
  panel?(view: GameView): PanelSpec | null;
  /** Forms for the current participant. Submitting passes `args.form` and `args.data`
   * to a registered macro; only that macro interprets/imports the data.
   */
  setup?(view: GameView, player: Id): SetupSpec[];
}

export function defineModule(def: ModuleDef): ModuleDef {
  return def;
}

/** A rule as a generator: it yields commands and gets their results back. */
export type Macro = (ctx: Ctx, args: Args) => Generator<Command, void, unknown>;

/** A macro's arguments: what its starter sent, and `by`, the player who started it (always set by the host). */
export type Args = Readonly<Record<string, ReadonlyJson>>;

export interface Actor {
  readonly player: Id;
  readonly unitId?: Id;
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
  /** True, or an advisory warning. Warned actions still expose targets and can be explicitly overridden. */
  available(view: GameView, actor: Actor): true | string;
  targets?(view: GameView, actor: Actor): Target[];
  run: Macro;
}

/** Read-only game access. A module sees the table as the host folded it. */
export type GameView = Readonly<{
  /** The whole state, read-only. */
  state: DeepReadonly<GameState>;
  pointer: DeepReadonly<Pointer>;
  /** A quantity's value now: its stored base with the modifiers that hold. */
  q(ref: EntityRef, key: string, fallback?: number): number;
  /** Modifiers that hold now, on one entity or all. */
  mods(ref?: EntityRef): DeepReadonly<Mod[]>;
  /** A modifier's `until` for "while the pointer's `field` stays as it is now". */
  until(field: string): DeepReadonly<{ field: string; is: Json }>;
  /** The units of a player, or all, that have a model on the table. */
  units(player?: Id): DeepReadonly<Unit[]>;
  /** Ordered card views. Visibility is presentation only; the full record remains inspectable. */
  cards(collection: Id, player?: Id | null): DeepReadonly<CardView[]>;
  /** Edge to edge in inches, between units, models or tokens (ids of any). */
  distance(a: Id, b: Id): number;
  /** Neutral intersections and per-model sampling against explicit, data-only blockers.
   * The package owns visibility, cover, vision arcs and unit-pair aggregation.
   */
  geometry: GeometryView;
  /** Degrees from the way `of` faces to where `other` is: 0 dead ahead, positive to the right, within -180..180. */
  angle(of: Id, other: Id): number;
  /** Package-local state: a game's system ID, or an extension's manifest ID. */
  own: DeepReadonly<Record<string, Json>>;
}>;

/** Commands a macro yields; each result is recorded for replay. */
export type Command = DeepReadonly<
  | { cmd: "roll"; dice: string; label?: string }
  | { cmd: "shuffle"; collection: Id }
  | { cmd: "note"; text: string }
  | { cmd: "input"; player: Id; question: string; input: InputSpec }
  | { cmd: "emit"; event: GameEvent }
  | { cmd: "set"; key: string; value: Json }
  | { cmd: "secret"; player: Id; key: string; question: string; options: { id: Id; label: string }[] }
  | { cmd: "reveal"; player: Id; key: string }
>;

export type Ctx = Readonly<{
  /** The table as the macro last saw it: it moves on after an answer, and with the macro's own events. */
  view: GameView;
  /** Dice from the host's rng, e.g. "2D6". The result is `{ rolls, total }`. */
  roll(dice: string, label?: string): Command;
  /** Shuffle an ordered card collection with the host's rng; returns the logged order. */
  shuffle(collection: Id): Command;
  /** A line in the game log. */
  note(text: string): Command;
  /** A single-choice input, returning the selected ID. */
  ask(player: Id, question: string, options: DeepReadonly<{ id: Id; label: string }[]>): Command;
  /** Collect a JSON answer. The host checks the declared shape/domain, not game legality.
   * Spatial values are proposals; emit primitives to apply them to the table.
   */
  input(player: Id, question: string, input: DeepReadonly<InputSpec>): Command;
  /** Standard advisory flow, used as `if (!(yield* ctx.warn(player, reason))) return`.
   * Returns true only after explicit Proceed anyway, then logs the override.
   * Cancel returns false; the package must stop before emitting the proposed effects.
   */
  warn(player: Id, reason: string): Generator<Command, boolean, unknown>;
  /**
   * Change the table with one of the core's primitive events, e.g.
   * `{ type: "q/adjust", ref, key: "wounds", delta: -1 }` or
   * `{ type: "pointer/set", pointer }`. Only the table's primitives are
   * accepted: not players, packages, secrets, dice, collection shuffles or undo.
   */
  emit(event: DeepReadonly<GameEvent>): Command;
  /** Keep a value in this package's namespace; explicit module/set is required for shared writes. */
  set(key: string, value: ReadonlyJson): Command;
  /**
   * Ask a player to choose an option in secret (a hidden order, a secret
   * objective). Their device keeps the choice and puts only a commitment on
   * the table (`view.state.secrets[player][key]`), so nobody else, the host
   * included, learns it. The result is the commitment.
   */
  secret(
    player: Id,
    key: string,
    question: string,
    options: DeepReadonly<{ id: Id; label: string }[]>,
  ): Command;
  /**
   * Have a player reveal a secret they committed. Their device sends the
   * value, every player checks it against the commitment, and the result is
   * the value (straight away if it was already revealed).
   */
  reveal(player: Id, key: string): Command;
}>;

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
    /** Advisory warning shown before starting; the player may explicitly proceed anyway. */
    warning?: string;
  }[];
}
