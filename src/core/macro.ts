import type { Args, CodeAction, Command, Ctx, Macro } from "../sdk";
import type { GameEvent, Intent, Rng } from "./actions";
import { BadFace, NeedDice, parseDice, rollDice } from "./dice";
import { applyEvent } from "./reducer";
import { isCommitment, revealMatches, secretOf } from "./secrets";
import type { GameState, Json, PlayerId } from "./types";
import { emitProblem } from "./validate";
import { gameView } from "./view";

/**
 * Macros: a rules module's actions and hooks, written as generators that
 * yield commands. Only the host runs one, inside resolveIntent; its effects
 * reach every peer as ordinary events inside one `macro/step` envelope, so the
 * reducer never runs module code and a peer without the module folds the
 * same table.
 *
 * To resume after an answer, a reconnect or a change of host, the host
 * replays the generator from the start, feeding back the recorded results,
 * until it reaches a command with no result. Two things keep that honest:
 *
 * - The replay must yield the same commands, or the macro is stopped as
 *   nondeterministic.
 * - Each answered question records `head`, the seq of the table the macro
 *   carries on from. A replay rebases onto the table as it was then
 *   (`history(head)`), so what the macro reads after an answer is the table
 *   the answer was given on, including whatever moved in the meantime, not
 *   the stale table it started on.
 *
 * A macro spans one action (an activation, an attack), never a phase: between
 * actions the game's state lives in the pointer and `module/set`.
 */

/** The question a macro is waiting on. */
interface MacroQuestion {
  player: PlayerId;
  question: string;
  options: { id: string; label: string }[];
  /**
   * A secret choice (ctx.secret): the player's device keeps the option it
   * picks and answers with its commitment. Or a reveal (ctx.reveal): the
   * device answers with the value and salt, as JSON, with no question shown.
   */
  secret?: string;
  reveal?: string;
}

interface MacroResult {
  /** The command, as JSON, to check a replay yields the same one. */
  command: string;
  value?: Json;
  /** Set on an answered question: the seq of the table the macro carries on from. */
  head?: number;
}

export interface MacroState {
  /** The module (system id) the macro belongs to. */
  system: string;
  macro: string;
  args: Args;
  /** Who started it. */
  by: PlayerId;
  /** The state's seq when it started: the run's identity, and where its replay begins. */
  startSeq: number;
  /** The event that set it off (a hook), for undo. */
  cause?: number;
  /** Every command so far and its result, in order. */
  results: MacroResult[];
  /** The question it is waiting on: the command after the last result. */
  waiting?: MacroQuestion;
}

/** What a step logs: the macro's new state (null once it ended) and the events it emitted. */
export interface MacroStep {
  type: "macro/step";
  macro: string;
  by: PlayerId;
  /** The run this step belongs to: its first step's startSeq. */
  run: number;
  /** On the step that starts a run: its arguments. */
  started?: true;
  args?: Args;
  /** The logged event that set the run off, when a hook did. Undoing that undoes the run. */
  cause?: number;
  events: GameEvent[];
  script: MacroState | null;
  /** Why it stopped early: an error in the module, or a nondeterministic replay. */
  error?: string;
}

/** A line in the game log, written by a module. */
export interface LogNote {
  type: "log/note";
  text: string;
}

/** A module's own state, `state.modules[module][key]`. */
export interface ModuleSet {
  type: "module/set";
  module: string;
  key: string;
  value: Json;
}

const macros = new Map<string, Record<string, Macro>>();

/** Macros a game module provides, by id. */
export function registerMacros(system: string, code: Record<string, Macro>): void {
  macros.set(system, { ...macros.get(system), ...code });
}

/** A registered macro, if this peer has the module's code (only the sandbox does). */
function findMacro(system: string, id: string): Macro | undefined {
  return macros.get(system)?.[id];
}

const codeActions = new Map<string, Map<string, CodeAction>>();

/** Code actions a module provides, so a raw `macro/start` for one can be checked. */
export function registerCodeActions(system: string, actions: CodeAction[]): void {
  const own = codeActions.get(system) ?? new Map<string, CodeAction>();
  for (const a of actions) own.set(a.id, a);
  codeActions.set(system, own);
}

/**
 * Why a code action can't be started now (its phases, `applies` or
 * `available` say no), or undefined when it can or `macro` isn't one. Panels
 * only offer available actions; this keeps a raw intent to them.
 */
export function codeActionWhy(state: GameState, macro: string, args: Args, by: PlayerId): string | undefined {
  const system = state.system ?? "";
  const action = codeActions.get(system)?.get(macro);
  if (!action) return undefined;
  const phase = state.pointer.phase;
  if (action.phases && !(phase && action.phases.includes(phase))) return "Not in this phase";
  const unitId = typeof args.unit === "string" ? args.unit : undefined;
  if (action.by === "unit" && (!unitId || state.units[unitId]?.owner !== by)) return "Not your unit";
  const actor = { player: by, ...(unitId ? { unitId } : {}) };
  try {
    const view = gameView(state, system);
    if (action.applies && !action.applies(view, actor)) return "Not for this unit";
    const ok = action.available(view, actor);
    return ok === true ? undefined : String(ok);
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

/** Commands one step may run before it is stopped as a runaway loop. */
const MAX_COMMANDS = 5000;

/**
 * Start a macro on `state`, or null when this peer has no such macro.
 * `cause` is the logged event a hook answers.
 */
export function startMacro(
  state: GameState,
  macro: string,
  args: Args,
  by: PlayerId,
  rng: Rng,
  cause?: number,
): MacroStep | null {
  const system = state.system ?? "";
  if (!findMacro(system, macro)) return null;
  // `args.by` is always who started it, whatever the intent said.
  const script: MacroState = {
    system,
    macro,
    args: { ...args, by },
    by,
    startSeq: state.seq,
    ...(cause === undefined ? {} : { cause }),
    results: [],
  };
  return runMacro(script, state, () => state, rng, undefined, true);
}

/** Carry a waiting macro on with a player's answer: replay it, then run on until it ends or asks again. */
export function stepMacro(
  script: MacroState,
  current: GameState,
  history: (seq: number) => GameState,
  rng: Rng,
  answer: string,
): MacroStep {
  return runMacro(script, current, history, rng, answer, false);
}

function runMacro(
  script: MacroState,
  current: GameState,
  history: (seq: number) => GameState,
  rng: Rng,
  answered: string | undefined,
  started: boolean,
): MacroStep {
  const events: GameEvent[] = [];
  const finish = (next: MacroState | null, error?: string): MacroStep => ({
    type: "macro/step",
    macro: script.macro,
    by: script.by,
    run: script.startSeq,
    ...(started ? { started: true as const, args: script.args } : {}),
    ...(script.cause === undefined ? {} : { cause: script.cause }),
    events,
    script: next,
    ...(error ? { error } : {}),
  });
  const stop = (error: string) => finish(null, error);
  const proc = findMacro(script.system, script.macro);
  if (!proc) return stop(`No macro "${script.macro}"`);
  let answer = answered;
  // The table the macro sees: where it started, then each answer moves it on to the table as it is then.
  let state = started ? current : history(script.startSeq);
  const ctx = makeCtx(() => state);
  const results = [...script.results];
  try {
    const gen = proc(ctx, script.args);
    let input: unknown = undefined;
    for (let i = 0; ; i++) {
      if (i > MAX_COMMANDS) return stop(`"${script.macro}" ran more than ${MAX_COMMANDS} commands`);
      const next = gen.next(input);
      if (next.done) return finish(null);
      const cmd = next.value;
      const key = JSON.stringify(cmd);
      if (i < results.length) {
        // Replaying: same command, same result.
        const r = results[i]!;
        if (r.command !== key) return stop(`"${script.macro}" behaved differently on replay`);
        if (r.head !== undefined) state = history(r.head);
        for (const e of replayEvents(cmd, r.value, script)) state = applyEvent(state, e);
        input = cmd.cmd === "reveal" ? (r.value as { value: unknown }).value : r.value;
        continue;
      }
      if (cmd.cmd === "ask") {
        const options = cmd.options.map((o) => o.id);
        if (answer === undefined || !options.includes(answer))
          return finish({
            ...script,
            results,
            waiting: { player: cmd.player, question: cmd.question, options: cmd.options },
          });
        input = answer;
        answer = undefined;
        results.push({ command: key, value: input as string, head: current.seq });
        state = current;
        continue;
      }
      if (cmd.cmd === "secret" || cmd.cmd === "reveal") {
        const got = secretAnswer(cmd, current, answer);
        answer = undefined;
        if (got === undefined) {
          const waiting: MacroQuestion =
            cmd.cmd === "secret"
              ? { player: cmd.player, question: cmd.question, options: cmd.options, secret: cmd.key }
              : { player: cmd.player, question: `Reveal ${cmd.key}`, options: [], reveal: cmd.key };
          return finish({ ...script, results, waiting });
        }
        results.push({ command: key, value: got as Json, head: current.seq });
        state = current;
        const emitted = replayEvents(cmd, got, script);
        events.push(...emitted);
        for (const e of emitted) state = applyEvent(state, e);
        input = cmd.cmd === "reveal" ? (got as { value: unknown }).value : got;
        continue;
      }
      const { value, emitted } = perform(cmd, rng, script);
      results.push(value === undefined ? { command: key } : { command: key, value: value as Json });
      events.push(...emitted);
      for (const e of emitted) state = applyEvent(state, e);
      input = value;
    }
  } catch (e) {
    // Real dice still to roll at the table: the caller asks the player for them.
    if (e instanceof NeedDice || e instanceof BadFace) throw e;
    return stop(`"${script.macro}" failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/** Run a new command: roll dice, or turn an emit, a set or a note into events. */
function perform(cmd: Command, rng: Rng, script: MacroState): { value?: unknown; emitted: GameEvent[] } {
  switch (cmd.cmd) {
    case "roll": {
      const dice = parseDice(cmd.dice);
      const { rolls, total } = rollDice(dice, rng);
      return {
        value: { rolls, total },
        emitted: [
          {
            type: "dice/roll",
            roll: {
              by: script.by,
              sides: dice.sides,
              results: rolls,
              ...(cmd.label ? { label: cmd.label } : {}),
            },
          },
        ],
      };
    }
    case "emit": {
      const problem = emitProblem(cmd.event);
      if (problem) throw new Error(problem);
      return { emitted: [cmd.event] };
    }
    case "set":
      return { emitted: replayEvents(cmd, undefined, script) };
    case "note":
      return { emitted: [{ type: "log/note", text: cmd.text }] };
    case "ask":
    case "secret":
    case "reveal":
      throw new Error("unreachable");
  }
}

/**
 * A secret's result from the answer: for ctx.secret, the commitment the
 * player's device sent; for ctx.reveal, `{ value, salt }` once it matches the
 * commitment (or at once, if it was revealed already). Undefined while waiting.
 */
function secretAnswer(
  cmd: Extract<Command, { cmd: "secret" | "reveal" }>,
  state: GameState,
  answer: string | undefined,
): unknown {
  const entry = secretOf(state, cmd.player, cmd.key);
  if (cmd.cmd === "secret") {
    if (entry) throw new Error(`${cmd.player} already committed "${cmd.key}"`);
    return isCommitment(answer) ? answer : undefined;
  }
  if (!entry) throw new Error(`${cmd.player} has no secret "${cmd.key}"`);
  if (entry.revealed) return { value: entry.revealed.value, salt: "" };
  if (answer === undefined) return undefined;
  try {
    const { value, salt } = JSON.parse(answer) as { value: unknown; salt: string };
    return revealMatches(entry, value, String(salt)) ? { value, salt: String(salt) } : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The events a command emitted, rebuilt from the command and its recorded
 * result, so a replay sees the table as it was. Rolls change nothing.
 */
function replayEvents(cmd: Command, value: unknown, script: MacroState): GameEvent[] {
  switch (cmd.cmd) {
    case "emit":
      return [cmd.event];
    case "set":
      return [{ type: "module/set", module: script.system, key: cmd.key, value: cmd.value }];
    case "secret":
      return [
        {
          type: "secret/commit",
          player: cmd.player,
          secrets: [{ key: cmd.key, commitment: String(value) }],
          label: `a secret choice (${cmd.question})`,
        },
      ];
    case "reveal": {
      const { value: v, salt } = value as { value: unknown; salt: string };
      // Already revealed before this macro asked: nothing to add to the table.
      if (!salt) return [];
      return [{ type: "secret/reveal", player: cmd.player, key: cmd.key, value: v, salt }];
    }
    default:
      return [];
  }
}

function makeCtx(current: () => GameState): Ctx {
  return {
    get view() {
      const s = current();
      return gameView(s, s.system ?? "");
    },
    roll: (dice, label) => ({ cmd: "roll", dice, ...(label ? { label } : {}) }),
    note: (text) => ({ cmd: "note", text }),
    ask: (player, question, options) => ({ cmd: "ask", player, question, options }),
    emit: (event) => ({ cmd: "emit", event }),
    set: (key, value) => ({ cmd: "set", key, value }),
    secret: (player, key, question, options) => ({ cmd: "secret", player, key, question, options }),
    reveal: (player, key) => ({ cmd: "reveal", player, key }),
  };
}

/** Hooks by system and owner: which macro ids a logged event of each type starts. */
export type HookTable = Record<string, string[]>;

const hooks = new Map<string, Map<string, HookTable>>();

/** A module's or package's hooks (`owner` keeps each one's apart, so a package's can be taken off again). */
export function registerHooks(system: string, owner: string, table: HookTable): void {
  const bySystem = hooks.get(system) ?? new Map<string, HookTable>();
  bySystem.set(owner, table);
  hooks.set(system, bySystem);
}

export function unregisterHooks(owner: string): void {
  for (const bySystem of hooks.values()) bySystem.delete(owner);
}

/** A module's hook macros under ids (`hook:<owner>:<event type>`), and the table that names them. */
export function hookMacros(
  owner: string,
  on: Record<string, Macro> | undefined,
): { macros: Record<string, Macro>; table: HookTable } {
  const code: Record<string, Macro> = {};
  const table: HookTable = {};
  for (const [type, macro] of Object.entries(on ?? {})) {
    const id = `hook:${owner}:${type}`;
    code[id] = macro;
    table[type] = [id];
  }
  return { macros: code, table };
}

/**
 * The hook macros a logged event sets off, as intents the host starts one
 * after another (net/session.ts). A step's own events count too, so a module
 * that moves the pointer starts the hooks on `pointer/set`. Each gets
 * `{ event, seq }` (and `from`, the pointer before, for `pointer/set`);
 * `cause` is the logged event's seq.
 */
export function hookIntents(before: GameState, after: GameState, event: GameEvent, seq: number): Intent[] {
  const tables = [...(hooks.get(after.system ?? "")?.values() ?? [])];
  if (!tables.length) return [];
  const flat = event.type === "macro/step" ? event.events : [event];
  const out: Intent[] = [];
  for (const e of flat)
    for (const table of tables)
      for (const macro of table[e.type] ?? [])
        out.push({
          type: "macro/start",
          macro,
          args: {
            event: e as unknown as Json,
            seq,
            ...(e.type === "pointer/set" ? { from: before.pointer as unknown as Json } : {}),
          },
          cause: seq,
        });
  return out;
}
