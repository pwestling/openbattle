import {
  appendEvent,
  applyEvent,
  createRecord,
  DEFAULT_TABLE,
  registerCodeActions,
  registerMacros,
  hookMacros,
  resolveLogged,
  stateAt,
  type GameRecord,
  type GameState,
  type Intent,
  type LoggedEvent,
} from "../core";
import { gameView } from "../core/view";
import { systemMatches } from "../packages/library";
import { readManifest } from "../packages/manifest";
import { MODULE_API, type CodeAction, type ModuleDef, type PanelSpec } from "../sdk";
import { EMPTY_LAYOUT, type ModuleInfo } from "../systems";
import { seededRng, type ActionRow, type AppState, type Loaded, type Resolved } from "./protocol";

/**
 * An error from a package's code, with where in its file it was thrown when
 * the stack says (a blob module's line and column).
 */
function errorText(e: unknown): string {
  if (!(e instanceof Error)) return String(e);
  // The package's own frames: blob (or data) modules other than this worker's own script.
  const own = (globalThis as { location?: { href?: string } }).location?.href;
  for (const m of (e.stack ?? "").matchAll(/((?:blob:|data:)[^\s)]*?):(\d+):(\d+)/g))
    if (m[1] !== own) return `${e.message} (line ${m[2]}, column ${m[3]})`;
  return e.message;
}

/** How the engine turns a package's source into its module (a blob import in the worker). */
type ImportSource = (source: string) => Promise<{ default?: unknown }>;

const json = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/**
 * The game engine as it runs inside the package sandbox: the packages' code,
 * and a replica of the game record that the app keeps in step by forwarding
 * each logged event. It is plain code (no Worker or DOM), so it can run next
 * to the app's own engine and be checked against it.
 */
export class SandboxEngine {
  private record: GameRecord = createRecord();
  private state: GameState = stateAt(this.record);
  /** Code actions and side panels by game id. */
  private readonly actions = new Map<string, CodeAction[]>();
  private readonly panels = new Map<string, NonNullable<ModuleDef["panel"]>>();
  /** Games a system package provided, for extensions to find. */
  private readonly known = new Set<string>();

  constructor(private readonly importSource: ImportSource) {}

  async load(packages: { hash: string; source: string }[]): Promise<Loaded> {
    const out: Loaded = { packages: [], errors: [] };
    // Whole games first, so the extensions to them can find them.
    const read = packages.map((p) => ({ ...p, manifest: readManifest(p.source) }));
    read.sort((a, b) => Number(isSystem(b.manifest)) - Number(isSystem(a.manifest)));
    for (const { hash, source, manifest } of read) {
      try {
        if ("error" in manifest) throw new Error(manifest.error);
        const def = ((await this.importSource(source)).default ?? {}) as ModuleDef;
        if (def.api !== MODULE_API)
          throw new Error(`This package is for module API ${String(def.api)}; this app runs ${MODULE_API}`);
        const whole = manifest.manifest.kind === "system";
        if (whole && (typeof def.id !== "string" || !def.id)) throw new Error("A game's module needs an id");
        const systems = whole
          ? [def.id]
          : [...this.known].filter((id) => manifest.manifest.systems.some((d) => systemMatches(d, id)));
        const actions = def.actions ?? [];
        const hooked = hookMacros(whole ? def.id : hash.slice(0, 8), def.hooks?.on);
        const code = {
          ...def.macros,
          ...Object.fromEntries(actions.map((a) => [a.id, a.run])),
          ...hooked.macros,
        };
        for (const system of systems) {
          registerMacros(system, code);
          registerCodeActions(system, actions);
          this.actions.set(system, [
            ...(this.actions.get(system) ?? []).filter((a) => !actions.some((b) => b.id === a.id)),
            ...actions,
          ]);
          if (def.panel) this.panels.set(system, def.panel);
          if (whole) this.known.add(system);
        }
        const meta = actions.map((a) => ({
          id: a.id,
          name: a.name,
          by: a.by,
          ...(a.phases ? { phases: a.phases } : {}),
        }));
        const adds = {
          quantities: def.quantities ?? [],
          pointer: def.pointer ?? [],
          hooks: Object.keys(hooked.table),
          actions: meta,
        };
        const table = def.table ?? DEFAULT_TABLE;
        const info: ModuleInfo | undefined = whole
          ? json({
              id: def.id,
              name: def.name,
              version: def.version,
              table,
              layout: def.layout?.(table) ?? EMPTY_LAYOUT,
              ...adds,
              hasPanel: !!def.panel,
            })
          : undefined;
        out.packages.push({
          hash,
          systems,
          macros: Object.keys(code),
          hooks: hooked.table,
          ...(info ? { info } : { adds: json(adds) }),
        });
      } catch (e) {
        out.errors.push({ hash, error: errorText(e) });
      }
    }
    return out;
  }

  init(record: GameRecord): void {
    this.record = record;
    this.state = stateAt(record);
  }

  /** Fold logged events in, as a peer does (undo rebuilds from the record). */
  events(events: LoggedEvent[]): void {
    for (const logged of events) {
      if (logged.seq <= (this.record.events.at(-1)?.seq ?? 0)) continue;
      this.record = appendEvent(this.record, logged);
      this.state =
        logged.event.type === "undo"
          ? stateAt(this.record)
          : { ...applyEvent(this.state, logged.event), seq: logged.seq };
    }
  }

  /** The host's job for one intent, with dice from `seed`. */
  resolve(intent: Intent, from: string, seed: number): Resolved {
    return resolveLogged(this.record, intent, from, seededRng(seed), 0, this.state)?.event ?? null;
  }

  /** What `player` can start now, and the module's side panel, for the game as it stands. */
  appState(player: string): AppState {
    const system = this.state.system ?? "";
    const panel = this.panels.get(system);
    let spec: PanelSpec | null = null;
    try {
      spec = panel ? json(panel(gameView(this.state, system))) : null;
    } catch {
      // A panel that throws shows nothing.
    }
    return { seq: this.state.seq, actions: this.rows(system, player), panel: spec };
  }

  private rows(system: string, player: string): ActionRow[] {
    const view = gameView(this.state, system);
    const phase = this.state.pointer.phase;
    const rows: ActionRow[] = [];
    for (const a of this.actions.get(system) ?? []) {
      if (a.phases && !(phase && a.phases.includes(phase))) continue;
      const actors: { player: string; unitId?: string }[] =
        a.by === "player"
          ? [{ player }]
          : Object.values(this.state.units)
              .filter((u) => u.owner === player)
              .map((u) => ({ player, unitId: u.id }));
      for (const actor of actors) {
        try {
          if (a.applies && !a.applies(view, actor)) continue;
          const available = a.available(view, actor);
          rows.push({
            id: a.id,
            name: a.label?.(view, actor) ?? a.name,
            by: a.by,
            ...(actor.unitId ? { unitId: actor.unitId } : {}),
            available: available === true ? true : String(available),
            targets: available === true && a.targets ? a.targets(view, actor) : [],
            targeted: !!a.targets,
          });
        } catch (e) {
          rows.push({
            id: a.id,
            name: a.name,
            by: a.by,
            ...(actor.unitId ? { unitId: actor.unitId } : {}),
            available: e instanceof Error ? e.message : String(e),
            targets: [],
            targeted: false,
          });
        }
      }
    }
    return json(rows);
  }
}

function isSystem(m: ReturnType<typeof readManifest>): boolean {
  return "manifest" in m && m.manifest.kind === "system";
}
