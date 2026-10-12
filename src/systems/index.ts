import { DEFAULT_SYSTEM } from "../core";
import { registerSystem } from "../core/content";
import { unregisterSystem } from "../core/content/systems";
import { registerFunctions } from "../core/content/calls";
import { hookProcedures, registerCode, registerCodeActions, registerHooks } from "../core/script";
import type { GameModule, Mission } from "../sdk";
import type { SystemModule } from "./app";
import { wh40kModule } from "./wh40k/module";

export type { SpecialDie, SystemModule, TemplateKind } from "./app";

/**
 * The built-in game modules (see src/sdk and the game modules spec). Each
 * pairs a system's rules data with the app glue in `app` and its code
 * procedures (core/script.ts).
 */
const BUILT_IN: GameModule<SystemModule>[] = [wh40kModule];

const MODULES = new Map<string, GameModule<SystemModule>>();

/** Adds a module and registers its rules with the engine. */
export function registerModule(m: GameModule<SystemModule>): void {
  registerSystem(m.system);
  if (m.procedures) registerCode(m.system.id, m.procedures);
  if (m.functions) registerFunctions(m.system.id, m.functions);
  // A code action runs as the procedure of the same id.
  if (m.actions) {
    registerCode(m.system.id, Object.fromEntries(m.actions.map((a) => [a.id, a.run])));
    registerCodeActions(m.system.id, m.actions);
  }
  if (m.hooks) {
    const { procedures, table } = hookProcedures(m.system.id, m.hooks);
    registerCode(m.system.id, procedures);
    registerHooks(m.system.id, m.system.id, table);
  }
  MODULES.set(m.system.id, m);
}

BUILT_IN.forEach(registerModule);

/**
 * A system from a rules package, on the app's side: its rules data and the
 * app glue the sandbox worked out (sample armies, a layout). Its code stays
 * in the sandbox.
 */
export function registerPackageSystem(system: GameModule["system"], app: SystemModule): void {
  registerSystem(system);
  MODULES.set(system.id, { id: system.id, version: system.version, api: 1, system, app });
}

export function unregisterPackageSystem(id: string): void {
  if (BUILT_IN.some((m) => m.system.id === id)) return;
  MODULES.delete(id);
  unregisterSystem(id);
}

/** Modules as they were before extension packages added missions to them, to put back. */
const BEFORE_MISSIONS = new Map<string, GameModule<SystemModule>>();
/** The package (by hash) that added each mission, by system and mission id: the picker's "from <package>". */
const MISSION_FROM = new Map<string, Map<string, string>>();

/**
 * Missions an extension package adds to a system (#82b, PackageContents.missions),
 * after its own; one with the id of one already there replaces it.
 */
export function addPackageMissions(id: string, missions: Mission[], from?: string): void {
  const m = MODULES.get(id);
  if (!m?.app || !missions.length) return;
  if (from) {
    const by = MISSION_FROM.get(id) ?? new Map<string, string>();
    for (const x of missions) by.set(x.id, from);
    MISSION_FROM.set(id, by);
  }
  if (!BEFORE_MISSIONS.has(id)) BEFORE_MISSIONS.set(id, m);
  const kept = (m.app.missions ?? []).filter((x) => !missions.some((y) => y.id === x.id));
  MODULES.set(id, { ...m, app: { ...m.app, missions: [...kept, ...missions] } });
}

/** Take every package's added missions back off (the game's packages stopped). */
export function clearPackageMissions(): void {
  for (const [id, m] of BEFORE_MISSIONS) if (MODULES.has(id)) MODULES.set(id, m);
  BEFORE_MISSIONS.clear();
  MISSION_FROM.clear();
}

/** The hash of the package that added a mission to a system, if a package did. */
export function missionFrom(system: string, mission: string): string | undefined {
  return MISSION_FROM.get(system)?.get(mission);
}

/** The game module for a system id, if one is registered. */
export function gameModule(id: string | undefined): GameModule<SystemModule> | undefined {
  return MODULES.get(id ?? DEFAULT_SYSTEM);
}

/** The module for a system id; systems without one get the generic panels and an empty table. */
export function systemModule(id: string | undefined): SystemModule {
  return (
    gameModule(id)?.app ?? {
      sample: () => ({ name: "Empty", units: [], warnings: [] }),
      layout: () => ({ terrain: [], objectives: [], zones: [] }),
    }
  );
}
