import {
  appendEvent,
  applyEvent,
  createRecord,
  hookIntents,
  lastSeq,
  pendingReactions,
  registerHooks,
  resolveLogged,
  stateAt,
  stateHash,
  unregisterHooks,
  type GameRecord,
  type GameState,
  type Intent,
  type Json,
  type LoggedEvent,
  type Player,
} from "../core";
import { eventProblem, jsonProblem } from "../core/validate";
import type { Manifest } from "../packages/manifest";
import { planComposition } from "../packages/composition";
import { SandboxEngine } from "../sandbox/engine";
import { seededRng, type AppState, type Loaded, type PackageDiagnostic } from "../sandbox/protocol";
import { APP_BUILD } from "../version";

/** Author-run data, not a security boundary or a shipped game's rules. Paths are relative to this JSON file. */
export interface PackageScenario {
  format: "open-battle/package-scenario@1";
  packages: string[];
  system: string;
  players: Player[];
  /** Unsigned 32-bit seed, default 1. One seed is drawn for every macro intent. */
  seed?: number;
  steps: ScenarioOperation[];
}

export type ScenarioOperation =
  | { op: "intent"; from: string; intent: Intent }
  | { op: "answer"; from: string; answer: Json }
  /** Restart the actual SandboxEngine with exactly the same source bytes and serialized host record. */
  | { op: "reconstruct" }
  | { op: "appState"; player: string }
  | { op: "assert"; target?: "state" | "appState" | "waiting"; path: string[]; equals: Json }
  | { op: "assertHash"; hash: number }
  /** Rebuild using only the core's record fold, with no package callbacks. Also done automatically at the end. */
  | { op: "replay" };

interface ScenarioPackage {
  hash: string;
  source: string;
  manifest: Manifest;
}

interface ScenarioStep {
  index: number;
  op: ScenarioOperation["op"];
  seq: number;
  hash: number;
  waiting: NonNullable<GameState["macro"]>["waiting"] | null;
  events: LoggedEvent[];
  diagnostics: PackageDiagnostic[];
  appState?: AppState;
  reconstructed?: true;
  replayHash?: number;
  error?: string;
}

interface ScenarioReport {
  format: "open-battle/package-scenario-report@1";
  ok: boolean;
  seed: number;
  steps: ScenarioStep[];
  diagnostics: PackageDiagnostic[];
  terminalErrors: { seq: number; macro: string; message: string }[];
  loaded?: Loaded;
  error?: string;
  waiting: NonNullable<GameState["macro"]>["waiting"] | null;
  state: GameState;
  hash: number;
  replayHash: number;
  record: GameRecord;
}

/** CLI failures before execution have no record; successful/started reports carry the full state. */
export type ScenarioOutput =
  | ScenarioReport
  | {
      format: "open-battle/package-scenario-report@1";
      ok: false;
      error: string;
    };

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const nonempty = (value: unknown): value is string => typeof value === "string" && !!value.trim();
const uint32 = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0 && value < 2 ** 32;

/** Validate required data; unknown optional fields are ignored, as in the other versioned file formats. */
export function scenarioProblem(value: unknown): string | null {
  const json = jsonProblem(value);
  if (json) return `Scenario must be JSON: ${json}`;
  if (!object(value) || value.format !== "open-battle/package-scenario@1")
    return "Expected format open-battle/package-scenario@1";
  if (!Array.isArray(value.packages) || !value.packages.length || !value.packages.every(nonempty))
    return "packages must be a nonempty array of paths";
  if (new Set(value.packages).size !== value.packages.length) return "Duplicate package path";
  if (!nonempty(value.system)) return "system must be a nonempty string";
  if (value.seed !== undefined && !uint32(value.seed)) return "seed must be an unsigned 32-bit integer";
  if (!Array.isArray(value.players) || !value.players.length) return "players must be a nonempty array";
  const initial = stateAt(createRecord());
  const players = new Set<string>();
  for (const [index, player] of value.players.entries()) {
    const problem = eventProblem({ type: "player/join", player }, initial);
    if (problem) return `players[${index}]: ${problem}`;
    const id = (player as Player).id;
    if (players.has(id)) return `Duplicate player: ${id}`;
    players.add(id);
  }
  if (!Array.isArray(value.steps)) return "steps must be an array";
  for (const [index, step] of value.steps.entries()) {
    const prefix = `steps[${index}]`;
    if (!object(step)) return `${prefix} must be an operation object`;
    switch (step.op) {
      case "intent":
        if (!nonempty(step.from) || !object(step.intent) || !nonempty(step.intent.type))
          return `${prefix}: intent requires from and an intent object with type`;
        break;
      case "answer":
        if (!nonempty(step.from) || !Object.hasOwn(step, "answer"))
          return `${prefix}: answer requires from and a JSON answer`;
        break;
      case "reconstruct":
      case "replay":
        break;
      case "appState":
        if (!nonempty(step.player)) return `${prefix}: appState requires player`;
        break;
      case "assert":
        if (step.target !== undefined && !["state", "appState", "waiting"].includes(String(step.target)))
          return `${prefix}: unknown assertion target`;
        if (!Array.isArray(step.path) || !step.path.every((part) => typeof part === "string"))
          return `${prefix}: assertion path must be an array of string keys`;
        if (!Object.hasOwn(step, "equals")) return `${prefix}: assertion requires equals`;
        break;
      case "assertHash":
        if (typeof step.hash !== "number" || !Number.isSafeInteger(step.hash) || step.hash < 0)
          return `${prefix}: assertHash requires a nonnegative safe integer hash`;
        break;
      default:
        return `${prefix}: unknown operation ${JSON.stringify(step.op)}`;
    }
  }
  return null;
}

function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const left = Object.keys(a);
  const right = Object.keys(b);
  if (left.length !== right.length) return false;
  return left.every(
    (key) =>
      Object.hasOwn(b, key) &&
      sameValue((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
  );
}

function atPath(value: unknown, path: string[]): unknown {
  let current = value;
  for (const key of path) {
    if (current === null || typeof current !== "object" || !Object.hasOwn(current, key))
      throw new Error(`Assertion path does not exist: ${JSON.stringify(path)}`);
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

/** Actual host resolution plus actual sandbox continuation, for explicitly trusted local package code. */
export async function runScenario(
  scenario: PackageScenario,
  packages: ScenarioPackage[],
  importSource: (source: string) => Promise<{ default?: unknown }>,
): Promise<ScenarioReport> {
  const seed = scenario.seed ?? 1;
  const rng = seededRng(seed);
  let record = createRecord();
  let state = stateAt(record);
  let engine = new SandboxEngine(importSource);
  let loaded: Loaded | undefined;
  let app: AppState | undefined;
  let error: string | undefined;
  const steps: ScenarioStep[] = [];
  const diagnostics: PackageDiagnostic[] = [];
  const diagnosticKeys = new Set<string>();
  const terminalErrors: ScenarioReport["terminalErrors"] = [];
  const owners = new Set<string>();
  const host = scenario.players[0]!.id;

  const capture = (items: PackageDiagnostic[]) => {
    for (const diagnostic of items) {
      const key = JSON.stringify(diagnostic);
      if (!diagnosticKeys.has(key)) {
        diagnosticKeys.add(key);
        diagnostics.push(diagnostic);
      }
    }
  };
  const presentation = () => {
    for (const player of Object.keys(state.players)) {
      const snapshot = engine.appState(player);
      capture(snapshot.diagnostics);
      if (!app || app.player === player) app = snapshot;
    }
  };
  const ensureNoErrors = () => {
    if (terminalErrors.length)
      throw new Error(`Macro ${terminalErrors.at(-1)!.macro} failed: ${terminalErrors.at(-1)!.message}`);
    if (diagnostics.length)
      throw new Error(`Package ${diagnostics.at(-1)!.callback} diagnostic: ${diagnostics.at(-1)!.message}`);
  };
  const commit = (resolved: LoggedEvent) => {
    // These events come only from the real host/core or sandbox resolver,
    // which validates primitives while producing them. macro/step is an
    // envelope, not a primitive accepted by eventProblem.
    const problem = jsonProblem(resolved.event);
    if (problem) throw new Error(`Resolved event is invalid JSON: ${problem}`);
    const before = state;
    const after =
      resolved.event.type === "undo"
        ? stateAt(appendEvent(record, resolved))
        : { ...applyEvent(state, resolved.event), seq: resolved.seq };
    let depth = 0;
    if (resolved.event.type === "macro/step" && resolved.event.reaction) {
      findReaction: for (const logged of record.events) {
        for (const reaction of logged.reactions ?? []) {
          if (reaction.id !== resolved.event.reaction) continue;
          depth = reaction.depth;
          break findReaction;
        }
      }
    }
    // The real host caps reaction chains at depth four (src/net/session.ts).
    const reactions =
      depth < 4
        ? hookIntents(before, after, resolved.event, resolved.seq).flatMap((intent, ordinal) =>
            intent.type === "macro/start"
              ? [
                  {
                    id: `${resolved.seq}:${ordinal}`,
                    system: after.system ?? "",
                    macro: intent.macro,
                    args: intent.args ?? {},
                    by: resolved.by,
                    cause: resolved.seq,
                    depth: depth + 1,
                  },
                ]
              : [],
          )
        : [];
    const logged = { ...resolved, host, ...(reactions.length ? { reactions } : {}) };
    record = appendEvent(record, logged);
    state = after;
    engine.events([logged]);
    if (resolved.event.type === "macro/step" && resolved.event.error)
      terminalErrors.push({ seq: resolved.seq, macro: resolved.event.macro, message: resolved.event.error });
  };
  const resolve = (intent: Intent, from: string) => {
    if (!Object.hasOwn(state.players, from)) throw new Error(`Unknown intent participant: ${from}`);
    if (
      (intent.type === "game/system" && intent.system !== scenario.system) ||
      (intent.type === "game/packages" &&
        !sameValue({ app: intent.app, system: intent.system, packages: intent.packages }, state.packages))
    )
      throw new Error("Scenario operations cannot change the selected system or exact package composition");
    const macro = intent.type === "macro/start" || intent.type === "macro/answer";
    const event = macro ? engine.resolve(intent, from, Math.floor(rng() * 2 ** 32)) : null;
    const resolved = macro
      ? event && { seq: lastSeq(record) + 1, by: from, at: 0, event }
      : resolveLogged(record, intent, from, rng, 0, state);
    if (!resolved) {
      presentation();
      throw new Error(`Intent rejected: ${intent.type} from ${from}`);
    }
    commit(resolved);
    presentation();
    ensureNoErrors();
  };
  const drain = () => {
    while (!state.macro) {
      const reaction = pendingReactions(record)[0];
      if (!reaction) break;
      if (reaction.system !== state.system)
        throw new Error(`Reaction ${reaction.id} belongs to a different system`);
      resolve(
        {
          type: "macro/start",
          macro: reaction.macro,
          args: reaction.args,
          cause: reaction.cause,
          reaction: reaction.id,
        },
        reaction.by,
      );
    }
  };
  const replay = () => {
    // stateAt/applyEvent have no package registry dependency: replay never executes package code.
    const hash = stateHash(stateAt(JSON.parse(JSON.stringify(record)) as GameRecord));
    if (hash !== stateHash(state))
      throw new Error(`Package-free replay mismatch: ${hash} !== ${stateHash(state)}`);
    return hash;
  };

  try {
    const problem = scenarioProblem(scenario);
    if (problem) throw new Error(problem);
    packages = planComposition(packages);
    const code = packages.map(({ hash, source }) => ({ hash, source }));
    for (const player of scenario.players) {
      const joined = resolveLogged(record, { type: "player/join", player }, player.id, rng, 0, state);
      if (!joined) throw new Error(`Invalid initial player: ${player.id}`);
      commit(joined);
    }
    const references = packages.map(({ hash, source, manifest }) => ({
      id: manifest.id,
      name: manifest.name,
      version: manifest.version,
      ...(manifest.author ? { author: manifest.author } : {}),
      ...(manifest.kind === "system" ? { kind: "system" as const } : {}),
      hash,
      bytes: new TextEncoder().encode(source).byteLength,
    }));
    for (const intent of [
      { type: "game/system" as const, system: scenario.system },
      { type: "game/packages" as const, app: APP_BUILD, system: scenario.system, packages: references },
    ]) {
      const logged = resolveLogged(record, intent, host, rng, 0, state);
      if (!logged) throw new Error(`Invalid scenario initialization: ${intent.type}`);
      commit(logged);
    }
    loaded = await engine.load(code);
    capture(loaded.diagnostics);
    if (loaded.errors.length)
      throw new Error(`Package load failed: ${loaded.errors.map((item) => item.error).join("; ")}`);
    if (!loaded.packages.some((pkg) => pkg.info?.id === scenario.system))
      throw new Error(`No loaded package provides system ${scenario.system}`);
    engine.init(record);
    for (const pkg of loaded.packages) {
      owners.add(pkg.hash);
      for (const system of pkg.systems) registerHooks(system, pkg.hash, pkg.hooks);
    }
    const info = loaded.packages.find((pkg) => pkg.info?.id === scenario.system)!.info!;
    resolve({ type: "layout/set", layout: { ...info.layout, table: info.table } }, host);
    drain();
    presentation();
    ensureNoErrors();

    for (const [index, operation] of scenario.steps.entries()) {
      const firstEvent = record.events.length;
      const firstDiagnostic = diagnostics.length;
      const result: ScenarioStep = {
        index,
        op: operation.op,
        seq: state.seq,
        hash: stateHash(state),
        waiting: state.macro?.waiting ?? null,
        events: [],
        diagnostics: [],
      };
      try {
        switch (operation.op) {
          case "intent":
            resolve(operation.intent, operation.from);
            drain();
            break;
          case "answer":
            resolve({ type: "macro/answer", answer: operation.answer }, operation.from);
            drain();
            break;
          case "reconstruct": {
            if (!state.macro?.waiting)
              throw new Error("reconstruct requires a suspended macro waiting for input");
            const serialized = JSON.parse(JSON.stringify(record)) as GameRecord;
            const previousHash = stateHash(state);
            engine = new SandboxEngine(importSource);
            engine.init(serialized);
            const restored = await engine.load(code);
            capture(restored.diagnostics);
            if (restored.errors.length)
              throw new Error(
                `Reconstruction load failed: ${restored.errors.map((item) => item.error).join("; ")}`,
              );
            record = serialized;
            state = stateAt(record);
            if (stateHash(state) !== previousHash) throw new Error("Reconstruction changed the host state");
            result.reconstructed = true;
            break;
          }
          case "appState":
            if (!Object.hasOwn(state.players, operation.player))
              throw new Error(`Unknown presentation participant: ${operation.player}`);
            app = engine.appState(operation.player);
            capture(app.diagnostics);
            result.appState = app;
            break;
          case "assert": {
            const target =
              operation.target === "appState"
                ? app
                : operation.target === "waiting"
                  ? (state.macro?.waiting ?? null)
                  : state;
            if (operation.target === "appState" && !app)
              throw new Error("Inspect appState before asserting it");
            const actual = atPath(target, operation.path);
            if (!sameValue(actual, operation.equals))
              throw new Error(
                `Assertion ${operation.target ?? "state"} ${JSON.stringify(operation.path)}: expected ${JSON.stringify(operation.equals)}, received ${JSON.stringify(actual)}`,
              );
            break;
          }
          case "assertHash":
            if (stateHash(state) !== operation.hash)
              throw new Error(`State hash: expected ${operation.hash}, received ${stateHash(state)}`);
            break;
          case "replay":
            result.replayHash = replay();
            break;
        }
        presentation();
        ensureNoErrors();
      } catch (failure) {
        result.error = failure instanceof Error ? failure.message : String(failure);
        throw failure;
      } finally {
        result.seq = state.seq;
        result.hash = stateHash(state);
        result.waiting = state.macro?.waiting ?? null;
        result.events = record.events.slice(firstEvent);
        result.diagnostics = diagnostics.slice(firstDiagnostic);
        steps.push(result);
      }
    }
    if (state.macro?.waiting) throw new Error("Scenario ended with unresolved macro input");
    if (state.macro) throw new Error("Scenario ended with an unfinished macro");
    if (pendingReactions(record).length)
      throw new Error("Scenario ended with unresolved reaction obligations");
    replay();
  } catch (failure) {
    error = failure instanceof Error ? failure.message : String(failure);
  } finally {
    for (const owner of owners) unregisterHooks(owner);
  }
  const replayHash = stateHash(stateAt(JSON.parse(JSON.stringify(record)) as GameRecord));
  const hash = stateHash(state);
  if (replayHash !== hash && !error) error = `Package-free replay mismatch: ${replayHash} !== ${hash}`;
  return {
    format: "open-battle/package-scenario-report@1",
    ok: !error,
    seed,
    steps,
    diagnostics,
    terminalErrors,
    ...(loaded ? { loaded } : {}),
    ...(error ? { error } : {}),
    waiting: state.macro?.waiting ?? null,
    state,
    hash,
    replayHash,
    record,
  };
}
