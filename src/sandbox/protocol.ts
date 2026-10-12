import type { GameEvent, GameRecord, Intent, LoggedEvent } from "../core";
import type { Rng } from "../core/actions";
import type { HookTable } from "../core/macro";
import type { PanelSpec, Target } from "../sdk";
import type { ModuleInfo } from "../systems";

/**
 * Messages between the app and the package sandbox (a Worker started inside
 * a sandboxed iframe; see host.ts). The worker keeps a replica of the game
 * record, folded with the same reducer, so calls carry ids and intents,
 * never the whole state. Only macro intents go to it: everything else the
 * host resolves itself, in the core.
 */
export type ToSandbox =
  | { id: number; t: "load"; packages: { hash: string; source: string }[] }
  | { id: number; t: "init"; record: GameRecord }
  | { id: number; t: "events"; events: LoggedEvent[] }
  | { id: number; t: "resolve"; intent: Intent; from: string; seed: number }
  /** What `player` can start now, and the module's side panel. */
  | { id: number; t: "appState"; player: string };

export type FromSandbox =
  | { id: number; t: "ok"; value?: unknown }
  | { id: number; t: "error"; error: string }
  /** The worker is up and listening. */
  | { id: 0; t: "ready" };

/** What a load reports: the code each package added, by game. */
export interface Loaded {
  packages: {
    hash: string;
    /** The games it provides (a system package) or extends. */
    systems: string[];
    /** Macro and action ids now registered in the sandbox. */
    macros: string[];
    /** Event types that start macros, for the host (core/macro.ts registerHooks). */
    hooks: HookTable;
    /** A whole game's module, as data: it is registered on the app's side. */
    info?: ModuleInfo;
    /** What an extension adds to the games it extends, as data. */
    adds?: Pick<ModuleInfo, "quantities" | "pointer" | "hooks" | "actions">;
  }[];
  errors: { hash: string; error: string }[];
}

/** A code action as the page shows it, worked out in the sandbox. */
export interface ActionRow {
  id: string;
  name: string;
  by: "unit" | "player";
  unitId?: string;
  /** True, or why not. */
  available: true | string;
  targets: Target[];
  /** Whether it needs a target picked. */
  targeted: boolean;
}

/** What the module offers for the game as it stands (the actions and the panel), as of event `seq`. */
export interface AppState {
  seq: number;
  actions: ActionRow[];
  panel: PanelSpec | null;
}

export type Resolved = GameEvent | null;

/**
 * The host draws one number from its rng per intent and the sandbox rolls
 * from it, so dice still come from the host and a replay of the log never
 * needs them again (results are in the events). mulberry32.
 */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
