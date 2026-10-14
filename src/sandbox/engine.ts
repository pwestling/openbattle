import {
  appendEvent,
  applyEvent,
  createRecord,
  DEFAULT_TABLE,
  createMacroRegistry,
  registerCodeActions,
  registerMacros,
  hookMacros,
  resolveLogged,
  pendingReactions,
  stateAt,
  withMacroRegistry,
  type GameRecord,
  type GameState,
  type Intent,
  type LoggedEvent,
} from "../core";
import { gameView } from "../core/view";
import { immutable } from "../core/immutable";
import { setupSpecProblem } from "../core/setup";
import { jsonProblem } from "../core/validate";
import { systemMatches } from "../packages/library";
import { readManifest, sha256, type Manifest, type PackageOverride } from "../packages/manifest";
import { planComposition } from "../packages/composition";
import {
  MODULE_API,
  type CodeAction,
  type GameView,
  type ModuleDef,
  type PanelSpec,
  type SetupSpec,
} from "../sdk";
import { EMPTY_LAYOUT, type ModuleInfo } from "../systems";
import {
  seededRng,
  type ActionRow,
  type AppState,
  type Loaded,
  type PackageWarning,
  type PackageDiagnostic,
  type Resolved,
} from "./protocol";

import { addDiagnostic, errorText, packageDiagnostic } from "./diagnostics";

/** How the engine turns a package's source into its module (a blob import in the worker). */
type ImportSource = (source: string) => Promise<{ default?: unknown }>;

const json = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

interface Provider {
  packageId: string;
  namespace: string;
  /** Only the run function supplied by an action gets implicit paired replacement. */
  action?: boolean;
}

interface Contribution<T> {
  callback: T;
  namespace: string;
  hash: string;
  manifest: Manifest;
}

type SymbolKind = PackageOverride["kind"];

function symbolKey(kind: SymbolKind, id: string, on?: string): string {
  return JSON.stringify([kind, on ?? "", id]);
}

function collision(
  system: string,
  kind: SymbolKind,
  id: string,
  incoming: string,
  existing?: string,
  on?: string,
): Error {
  return new Error(
    `Game ${system}: ${kind} ${on ? `${on}/` : ""}${id} from ${incoming} conflicts with provider ${existing ?? "(none)"}`,
  );
}

function namespaceWarning(
  warnings: PackageWarning[],
  pkg: { hash: string; manifest: Manifest },
  system: string,
  kind: PackageWarning["kind"],
  id: string,
  replacement: boolean,
  on?: PackageWarning["on"],
): void {
  if (pkg.manifest.kind !== "extension" || replacement || id.startsWith(`${pkg.manifest.id}:`)) return;
  warnings.push({
    hash: pkg.hash,
    packageId: pkg.manifest.id,
    system,
    kind,
    id,
    ...(on ? { on } : {}),
    message: `${pkg.manifest.id}: ${kind} ${on ? `${on}/` : ""}${id} should use the ${pkg.manifest.id}: prefix`,
  });
}

/**
 * The game engine as it runs inside the package sandbox: the packages' code,
 * and a replica of the game record that the app keeps in step by forwarding
 * each logged event. It is plain code (no Worker or DOM), so it can run next
 * to the app's own engine and be checked against it.
 */
export class SandboxEngine {
  private record: GameRecord = createRecord();
  private state: GameState = stateAt(this.record);
  /** Code actions, side panels and setup callback contributions by game id. */
  private actions = new Map<string, Contribution<CodeAction>[]>();
  private panels = new Map<string, Contribution<NonNullable<ModuleDef["panel"]>>>();
  private setups = new Map<string, Contribution<NonNullable<ModuleDef["setup"]>>[]>();
  private registry = createMacroRegistry();
  private packageOwners = new Map<string, { hash: string; manifest: Manifest }>();
  /** Exact ordered composition whose executable code and metadata were successfully committed. */
  private composition?: string[];
  private loaded?: Loaded;
  private codeReady = false;
  private loadQueue: Promise<void> = Promise.resolve();

  constructor(private readonly importSource: ImportSource) {}

  load(packages: { hash: string; source: string }[]): Promise<Loaded> {
    const run = this.loadQueue.then(() => this.prepareLoad(packages));
    this.loadQueue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private assertComposition(hashes: string[]): void {
    if (!this.state.macro && !pendingReactions(this.record).length) return;
    // The record is authoritative even when this engine previously ran a different table.
    const pinned = this.state.packages?.packages.map((p) => p.hash) ?? this.composition;
    if (!pinned || hashes.length !== pinned.length || hashes.some((hash, i) => hash !== pinned[i]))
      throw new Error("Cannot change packages while a macro or recorded reaction is pending");
  }

  private updateCodeReady(): void {
    const expected = this.state.packages?.packages;
    this.codeReady =
      !!this.loaded &&
      !!this.composition &&
      (!expected ||
        (expected.length === this.composition.length &&
          expected.every((pkg, i) => pkg.hash === this.composition![i])));
  }

  private async prepareLoad(packages: { hash: string; source: string }[]): Promise<Loaded> {
    const hashes = packages.map((p) => p.hash);
    this.assertComposition(hashes);
    const out: Loaded = { packages: [], errors: [], warnings: [], diagnostics: [] };
    const encoder = new TextEncoder();
    const actualHashes = await Promise.all(packages.map((pkg) => sha256(encoder.encode(pkg.source))));
    for (let i = 0; i < packages.length; i++)
      if (actualHashes[i] !== packages[i]!.hash) {
        const hash = packages[i]!.hash;
        const error = `Package source SHA-256 ${actualHashes[i]} does not match claimed hash ${hash}`;
        out.errors.push({ hash, error });
        addDiagnostic(
          out.diagnostics,
          packageDiagnostic({ hash, system: "", phase: "load", callback: "import" }, error),
        );
      }
    if (out.errors.length) return out;
    this.assertComposition(hashes);
    if (
      this.loaded &&
      this.composition?.length === hashes.length &&
      hashes.every((hash, i) => hash === this.composition![i])
    )
      return json(this.loaded);
    const manifests: { hash: string; source: string; manifest: Manifest }[] = [];
    // Dependency and manifest failures must precede every executable import.
    for (const pkg of packages) {
      const result = readManifest(pkg.source);
      if ("error" in result) {
        out.errors.push({ hash: pkg.hash, error: result.error });
        addDiagnostic(
          out.diagnostics,
          packageDiagnostic({ hash: pkg.hash, system: "", phase: "load", callback: "import" }, result.error),
        );
      } else manifests.push({ ...pkg, manifest: result.manifest });
    }
    if (out.errors.length) return out;
    let ordered: typeof manifests;
    try {
      ordered = planComposition(manifests);
    } catch (e) {
      // Graph failures may concern any selected package. Do not attribute a
      // dependency/cycle error to the first manifest without evidence.
      const diagnostic = packageDiagnostic(
        {
          hash: "",
          system: "",
          phase: "load",
          callback: "import",
        },
        e,
      );
      return { ...out, errors: [{ hash: diagnostic.hash, error: errorText(e) }], diagnostics: [diagnostic] };
    }
    const registry = createMacroRegistry();
    const actions = new Map<string, Contribution<CodeAction>[]>();
    const panels = new Map<string, Contribution<NonNullable<ModuleDef["panel"]>>>();
    const setups = new Map<string, Contribution<NonNullable<ModuleDef["setup"]>>[]>();
    const packageOwners = new Map<string, { hash: string; manifest: Manifest }>();
    const owners = new Map<string, Map<string, Provider>>();
    const namespaces = new Map<string, string>();
    const known = new Set<string>();
    for (const pkg of ordered) {
      const { hash, source, manifest } = pkg;
      let callback: PackageDiagnostic["callback"] = "import";
      let diagnosticSystem = manifest.systems.join(", ");
      try {
        const imported = await this.importSource(`${source}\n//# sourceURL=open-battle-package:${hash}\n`);
        const def = (imported.default ?? {}) as ModuleDef;
        if (def.api !== MODULE_API)
          throw new Error(`This package is for module API ${String(def.api)}; this app runs ${MODULE_API}`);
        const whole = manifest.kind === "system";
        if (
          whole &&
          (typeof def.id !== "string" ||
            !/^[A-Za-z0-9_.:-]{1,64}$/.test(def.id) ||
            ["__proto__", "constructor", "prototype"].includes(def.id))
        )
          throw new Error("A game's module needs a safe module-state id");
        if (whole && !manifest.systems.includes(def.id))
          throw new Error(`${manifest.id} exports game ${def.id}, which its manifest does not advertise`);
        const namespace = whole ? def.id : manifest.id;
        const namespaceOwner = namespaces.get(namespace);
        if (namespaceOwner)
          throw new Error(
            `Module-state namespace ${namespace} collides between ${manifest.id} and ${namespaceOwner}`,
          );
        namespaces.set(namespace, manifest.id);
        packageOwners.set(namespace, { hash, manifest });
        if (whole && known.has(def.id)) throw new Error(`Game ${def.id} has multiple whole-game providers`);
        const systems = whole
          ? [def.id]
          : [...known].filter((id) => manifest.systems.some((s) => systemMatches(s, id)));
        if (!systems.length) throw new Error(`${manifest.id} has no loaded compatible game`);
        diagnosticSystem = systems.join(", ");
        const offeredActions = def.actions ?? [];
        const hooked = hookMacros(manifest.id, def.hooks?.on);
        const code = Object.create(null) as NonNullable<ModuleDef["macros"]>;
        const localIds = new Set<string>();
        const addCode = (id: string, run: NonNullable<ModuleDef["macros"]>[string]) => {
          if (localIds.has(id)) throw collision(systems.join(", "), "macro", id, manifest.id, manifest.id);
          if (typeof run !== "function") throw new Error(`${manifest.id} macro ${id} must be a function`);
          localIds.add(id);
          code[id] = run;
        };
        for (const [id, run] of Object.entries(def.macros ?? {})) addCode(id, run);
        for (const a of offeredActions) addCode(a.id, a.run);
        for (const [id, run] of Object.entries(hooked.macros)) addCode(id, run);
        const used = new Set<PackageOverride>();
        const removedActions = new Set<string>();
        for (const system of systems) {
          const symbols = owners.get(system) ?? new Map<string, Provider>();
          owners.set(system, symbols);
          const claim = (
            kind: SymbolKind,
            id: string,
            on?: PackageWarning["on"],
            paired?: Provider,
          ): Provider | undefined => {
            const key = symbolKey(kind, id, on);
            const previous = symbols.get(key);
            if (previous?.packageId === manifest.id)
              throw collision(system, kind, id, manifest.id, previous.packageId, on);
            const replacements = (manifest.overrides ?? []).filter(
              (o) => o.kind === kind && o.id === id && o.on === on && systemMatches(o.system, system),
            );
            if (replacements.length > 1)
              throw new Error(`${manifest.id} has ambiguous overrides for ${system} ${kind} ${id}`);
            const replacement = replacements[0];
            const implicit = kind === "macro" && previous?.action && paired?.packageId === previous.packageId;
            if (replacement) {
              if (!previous || previous.packageId !== replacement.from)
                throw collision(system, kind, id, manifest.id, previous?.packageId, on);
              used.add(replacement);
            } else if (previous && !implicit)
              throw collision(system, kind, id, manifest.id, previous.packageId, on);
            symbols.set(key, {
              packageId: manifest.id,
              namespace,
              ...(kind === "macro" && paired ? { action: true } : {}),
            });
            if (
              kind !== "panel" &&
              kind !== "setup" &&
              !(
                kind === "macro" &&
                (offeredActions.some((a) => a.id === id) || Object.hasOwn(hooked.macros, id))
              )
            )
              namespaceWarning(out.warnings, pkg, system, kind, id, !!replacement || !!implicit, on);
            return previous;
          };
          for (const q of def.quantities ?? []) claim("quantity", q.id, q.on);
          for (const phase of def.pointer ?? []) claim("phase", phase.id);
          for (const a of offeredActions) {
            const former = claim("action", a.id);
            claim("macro", a.id, undefined, former);
            // Mark even a brand-new action's run as paired.
            symbols.get(symbolKey("macro", a.id))!.action = true;
          }
          for (const id of Object.keys(code)) {
            if (offeredActions.some((a) => a.id === id)) continue;
            const previous = claim("macro", id);
            if (previous?.action) {
              symbols.delete(symbolKey("action", id));
              actions.set(
                system,
                (actions.get(system) ?? []).filter((a) => a.callback.id !== id),
              );
              registry.actions.get(system)?.delete(id);
              removedActions.add(id);
            }
          }
          const wrapped = Object.create(null) as NonNullable<ModuleDef["macros"]>;
          for (const [id, run] of Object.entries(code)) {
            wrapped[id] = function* (ctx, args) {
              try {
                yield* run(ctx, args);
              } catch (error) {
                throw new Error(errorText(error), { cause: error });
              }
            };
          }
          registerMacros(system, wrapped, registry, namespace);
          registerCodeActions(system, offeredActions, registry, namespace);
          actions.set(system, [
            ...(actions.get(system) ?? []).filter((a) => !offeredActions.some((b) => b.id === a.callback.id)),
            ...offeredActions.map((action) => ({ callback: action, namespace, hash, manifest })),
          ]);
          if (def.panel !== undefined) {
            claim("panel", "panel");
            if (typeof def.panel !== "function") throw new Error(`${manifest.id} panel must be a function`);
            panels.set(system, { callback: def.panel, namespace, hash, manifest });
          }
          if (def.setup !== undefined) {
            if (typeof def.setup !== "function") throw new Error(`${manifest.id} setup must be a function`);
            setups.set(system, [
              ...(setups.get(system) ?? []),
              { callback: def.setup, namespace, hash, manifest },
            ]);
          }
        }
        for (const override of manifest.overrides ?? [])
          if (override.kind !== "setup" && !used.has(override))
            throw new Error(
              `${manifest.id} declares unused override: ${override.system} ${override.kind} ${override.on ? `${override.on}/` : ""}${override.id} from ${override.from}`,
            );
        const adds = {
          quantities: def.quantities ?? [],
          pointer: def.pointer ?? [],
          hooks: Object.keys(hooked.table),
          actions: offeredActions.map((a) => ({
            id: a.id,
            name: a.name,
            by: a.by,
            ...(a.phases ? { phases: a.phases } : {}),
          })),
        };
        const table = immutable(def.table ?? DEFAULT_TABLE);
        callback = "layout";
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
        out.packages.push(
          json({
            hash,
            systems,
            macros: Object.keys(code),
            hooks: hooked.table,
            ...(info ? { info } : { adds }),
            ...(removedActions.size ? { removedActions: [...removedActions] } : {}),
          }),
        );
        if (whole) known.add(def.id);
      } catch (e) {
        return {
          packages: [],
          warnings: [],
          errors: [{ hash, error: errorText(e) }],
          diagnostics: [
            packageDiagnostic(
              { hash, packageId: manifest.id, system: diagnosticSystem, phase: "load", callback },
              e,
            ),
          ],
        };
      }
    }
    // Imports and metadata callbacks may await events: recheck their continuation pin before commit.
    this.assertComposition(hashes);
    this.registry = registry;
    this.packageOwners = packageOwners;
    this.actions = actions;
    this.panels = panels;
    this.setups = setups;
    this.composition = hashes;
    this.loaded = out;
    this.updateCodeReady();
    return json(out);
  }

  init(record: GameRecord): void {
    this.record = record;
    this.state = stateAt(record);
    this.updateCodeReady();
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
    this.updateCodeReady();
  }

  /** The host's job for one intent, with dice from `seed`. */
  resolve(intent: Intent, from: string, seed: number): Resolved {
    // Missing/mismatched code is recoverable by loading the record's composition, not a failed macro step.
    if (!this.codeReady) return null;
    if (this.state.macro && !this.registry.macros.get(this.state.macro.system)?.[this.state.macro.macro])
      return null;
    return withMacroRegistry(
      this.registry,
      () => resolveLogged(this.record, intent, from, seededRng(seed), 0, this.state)?.event ?? null,
    );
  }

  /** What `player` can start now, and the package's panel and setup forms. */
  appState(player: string): AppState {
    const warnings = [...(this.loaded?.warnings ?? [])];
    const diagnostics: PackageDiagnostic[] = [];
    const failure = this.latestExecutionDiagnostic();
    if (failure) addDiagnostic(diagnostics, failure);
    if (!this.codeReady)
      return { player, seq: this.state.seq, actions: [], panel: null, setup: [], warnings, diagnostics };
    const system = this.state.system ?? "";
    const panel = this.panels.get(system);
    let spec: PanelSpec | null = null;
    if (panel) {
      try {
        spec = json(panel.callback(gameView(this.state, panel.namespace)));
        if (spec !== null) {
          const problem = jsonProblem(spec);
          if (problem) throw new Error(`Invalid panel data: ${problem}`);
          if (
            !spec ||
            typeof spec !== "object" ||
            typeof spec.title !== "string" ||
            (spec.lines !== undefined &&
              (!Array.isArray(spec.lines) || spec.lines.some((line) => typeof line !== "string"))) ||
            (spec.buttons !== undefined &&
              (!Array.isArray(spec.buttons) ||
                spec.buttons.some(
                  (button) =>
                    !button ||
                    typeof button !== "object" ||
                    typeof button.label !== "string" ||
                    typeof button.macro !== "string" ||
                    (button.player !== undefined && typeof button.player !== "string") ||
                    (button.warning !== undefined && typeof button.warning !== "string") ||
                    (button.args !== undefined &&
                      (!button.args || typeof button.args !== "object" || Array.isArray(button.args))),
                )))
          )
            throw new Error("Panel callback returned an invalid panel descriptor");
        }
      } catch (error) {
        spec = null;
        addDiagnostic(
          diagnostics,
          packageDiagnostic(
            {
              phase: "presentation",
              hash: panel.hash,
              packageId: panel.manifest.id,
              system,
              callback: "panel",
              actor: player,
            },
            error,
          ),
        );
      }
    }
    const setup = this.setupForms(system, player, warnings, diagnostics);
    const setupError = diagnostics
      .filter((diagnostic) => diagnostic.callback === "setup")
      .map((diagnostic) => diagnostic.message)
      .join("\n");
    return {
      player,
      seq: this.state.seq,
      actions: this.rows(system, player, diagnostics),
      panel: spec,
      setup,
      warnings,
      diagnostics,
      ...(setupError ? { setupError } : {}),
    };
  }

  /** A fresh engine can recover the latest active failure from the package-free record. */
  private latestExecutionDiagnostic(): PackageDiagnostic | undefined {
    const undone = new Set<number>();
    for (const { event } of this.record.events)
      if (event.type === "undo") for (const seq of [event.seq, ...(event.also ?? [])]) undone.add(seq);
    for (let i = this.record.events.length - 1; i >= 0; i--) {
      const logged = this.record.events[i]!;
      const event = logged.event;
      if (undone.has(logged.seq) || event.type !== "macro/step" || !event.error) continue;
      const historical = stateAt(this.record, logged.seq);
      const packages = historical.packages?.packages;
      const sourceHash = /open-battle-package:([a-f0-9]{64})/.exec(event.error)?.[1];
      const loadedOwner = this.packageOwners.get(event.namespace);
      const owner =
        packages?.find((pkg) => pkg.hash === sourceHash) ??
        packages?.find((pkg) => pkg.hash === loadedOwner?.hash) ??
        packages?.find(
          (pkg) =>
            pkg.id === event.namespace || (pkg.kind === "system" && historical.system === event.namespace),
        );
      const hash = owner?.hash ?? sourceHash ?? (!packages ? loadedOwner?.hash : undefined);
      if (!hash) continue;
      if (historical.system !== this.state.system || (this.composition && !this.composition.includes(hash)))
        continue;
      const packageId = owner?.id ?? (loadedOwner?.hash === hash ? loadedOwner.manifest.id : undefined);
      return packageDiagnostic(
        {
          phase: "execution",
          hash,
          ...(packageId ? { packageId } : {}),
          system: historical.system ?? "",
          callback: "macro",
          symbol: event.macro,
          actor: event.by,
        },
        event.error,
      );
    }
    return undefined;
  }

  private setupForms(
    system: string,
    player: string,
    warnings: PackageWarning[],
    diagnostics: PackageDiagnostic[],
  ): SetupSpec[] {
    if (!Object.hasOwn(this.state.players, player)) return [];
    const forms = new Map<string, { form: SetupSpec; packageId: string }>();
    const macros = this.registry.macros.get(system);
    for (const pkg of this.setups.get(system) ?? []) {
      let symbol: string | undefined;
      try {
        const contribution = json(pkg.callback(gameView(this.state, pkg.namespace), player));
        if (!Array.isArray(contribution))
          throw new Error(`${pkg.manifest.id} setup callback must return an array of forms`);
        const localIds = new Set<string>();
        for (const form of contribution) {
          const problem = setupSpecProblem(form);
          if (problem) throw new Error(`${pkg.manifest.id}: invalid setup form: ${problem}`);
          symbol = form.id;
          const previous = forms.get(form.id);
          if (localIds.has(form.id))
            throw collision(system, "setup", form.id, pkg.manifest.id, pkg.manifest.id);
          localIds.add(form.id);
          const replacements = (pkg.manifest.overrides ?? []).filter(
            (o) => o.kind === "setup" && o.id === form.id && systemMatches(o.system, system),
          );
          if (replacements.length > 1)
            throw new Error(`${pkg.manifest.id} has ambiguous setup overrides for ${system} ${form.id}`);
          const replacement = replacements[0];
          // A conditional old form may be absent. If offered, it must be the declared latest provider.
          if (
            previous &&
            (!replacement ||
              previous.packageId !== replacement.from ||
              previous.packageId === pkg.manifest.id)
          )
            throw collision(system, "setup", form.id, pkg.manifest.id, previous.packageId);
          if (!macros || !Object.hasOwn(macros, form.macro) || typeof macros[form.macro]?.run !== "function")
            throw new Error(
              `${pkg.manifest.id}: setup form ${form.id} targets an unregistered macro: ${form.macro}`,
            );
          namespaceWarning(warnings, pkg, system, "setup", form.id, !!replacement);
          forms.set(form.id, { form, packageId: pkg.manifest.id });
        }
      } catch (error) {
        addDiagnostic(
          diagnostics,
          packageDiagnostic(
            {
              phase: "presentation",
              hash: pkg.hash,
              packageId: pkg.manifest.id,
              system,
              callback: "setup",
              actor: player,
              ...(symbol ? { symbol } : {}),
            },
            error,
          ),
        );
      }
    }
    return [...forms.values()].map((entry) => entry.form);
  }

  private rows(system: string, player: string, diagnostics: PackageDiagnostic[]): ActionRow[] {
    const views = new Map<string, GameView>();
    const phase = this.state.pointer.phase;
    const rows: ActionRow[] = [];
    for (const pkg of this.actions.get(system) ?? []) {
      const { callback: a, namespace } = pkg;
      if (a.phases && !(phase && a.phases.includes(phase))) continue;
      let view = views.get(namespace);
      if (!view) {
        view = gameView(this.state, namespace);
        views.set(namespace, view);
      }
      const actors: { player: string; unitId?: string }[] =
        a.by === "player"
          ? [{ player }]
          : Object.values(this.state.units)
              .filter((u) => u.owner === player)
              .map((u) => ({ player, unitId: u.id }));
      for (const actor of actors) {
        let callback: PackageDiagnostic["callback"] = "applies";
        try {
          immutable(actor);
          if (a.applies && !a.applies(view, actor)) continue;
          callback = "available";
          const available = a.available(view, actor);
          if (available !== true && typeof available !== "string")
            throw new Error("available callback must return true or a warning string");
          callback = "label";
          const name = a.label?.(view, actor) ?? a.name;
          if (typeof name !== "string") throw new Error("label callback must return text");
          callback = "targets";
          const targets = a.targets ? json(a.targets(view, actor)) : [];
          const problem = jsonProblem(targets);
          if (problem) throw new Error(`Invalid targets data: ${problem}`);
          if (
            !Array.isArray(targets) ||
            targets.some(
              (target) =>
                !target ||
                typeof target !== "object" ||
                typeof target.label !== "string" ||
                (target.unitId !== undefined && typeof target.unitId !== "string"),
            )
          )
            throw new Error("targets callback must return an array of target descriptors");
          rows.push({
            id: a.id,
            name,
            by: a.by,
            ...(actor.unitId ? { unitId: actor.unitId } : {}),
            available,
            targets,
            targeted: !!a.targets,
          });
        } catch (e) {
          addDiagnostic(
            diagnostics,
            packageDiagnostic(
              {
                phase: "presentation",
                hash: pkg.hash,
                packageId: pkg.manifest.id,
                system,
                callback,
                symbol: a.id,
                actor: actor.unitId ?? actor.player,
              },
              e,
            ),
          );
          rows.push({
            id: a.id,
            name: a.name,
            by: a.by,
            ...(actor.unitId ? { unitId: actor.unitId } : {}),
            available: true,
            error: errorText(e),
            targets: [],
            targeted: !!a.targets,
          });
        }
      }
    }
    return rows;
  }
}
