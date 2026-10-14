import type { Layout } from "../core";
import type { Table } from "../core/types";
import type { PhaseDef, QuantityDef } from "../sdk";

/**
 * What the app knows about a game's module: the data side of it. The code
 * (macros, actions, panels) stays in the sandbox; this is what the sandbox
 * reports when a package loads, so the page can list a game's quantities and
 * phases, and the host can start a game on its table and know which logged
 * events have hooks. Nothing here is read by the reducer.
 */
export interface ModuleInfo {
  id: string;
  name: string;
  version: string;
  /** The table a fresh game starts on, and its starting layout worked out for it. */
  table: Table;
  layout: Layout;
  quantities: QuantityDef[];
  pointer: PhaseDef[];
  /** The event types the module has hooks on. */
  hooks: string[];
  /** Its code actions, as data (what they do runs in the sandbox). */
  actions: { id: string; name: string; by: "unit" | "player"; phases?: string[] }[];
  hasPanel: boolean;
}

const MODULES = new Map<string, ModuleInfo>();

export const EMPTY_LAYOUT: Layout = { terrain: [], tokens: [], zones: [] };

/** A game's module, as its package reported it when it loaded. */
export function registerModuleInfo(info: ModuleInfo): void {
  MODULES.set(info.id, info);
}

/** What an extension package adds to a game it extends. */
export function extendModuleInfo(
  id: string,
  add: Pick<ModuleInfo, "quantities" | "pointer" | "hooks" | "actions">,
  removedActions: string[] = [],
): void {
  const own = MODULES.get(id);
  if (!own) return;
  const merge = <T extends { id: string }>(base: T[], more: T[]) => [
    ...base.filter((x) => !more.some((m) => m.id === x.id)),
    ...more,
  ];
  MODULES.set(id, {
    ...own,
    quantities: [
      ...own.quantities.filter((q) => !add.quantities.some((more) => more.on === q.on && more.id === q.id)),
      ...add.quantities,
    ],
    pointer: merge(own.pointer, add.pointer),
    actions: merge(
      own.actions.filter((a) => !removedActions.includes(a.id)),
      add.actions,
    ),
    hooks: [...new Set([...own.hooks, ...add.hooks])],
  });
}

export function unregisterModuleInfo(id: string): void {
  MODULES.delete(id);
}

/** A game's module info, if its package is loaded here. */
export function moduleInfo(id: string | undefined): ModuleInfo | undefined {
  return id === undefined ? undefined : MODULES.get(id);
}

/** The layout a game on this table starts with: its module's, or an empty table. */
export function startingLayout(id: string | undefined): Layout {
  return moduleInfo(id)?.layout ?? EMPTY_LAYOUT;
}
