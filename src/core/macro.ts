import type { Args, CodeAction, Command, Ctx, Macro } from "../sdk";
import type { GameEvent, Intent, Rng } from "./actions";
import { shuffleCollection } from "./cards";
import type { CardFields } from "./cards";
import { parseDice, rollDice } from "./dice";
import { immutable } from "./immutable";
import { inputAnswerProblem, inputSpecProblem, type InputSpec } from "./input";
import { applyEvent } from "./reducer";
import { isCommitment, revealMatches, secretOf } from "./secrets";
import type { EntityRef, GameState, Json, PlayerId } from "./types";
import { emitProblem, eventProblem } from "./validate";
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
type MacroQuestion = {
  player: PlayerId;
  question: string;
} & (
  | { input: InputSpec }
  | {
      options: { id: string; label: string }[];
      /**
       * A secret choice (ctx.secret): the player's device keeps the option it
       * picks and answers with its commitment. Or a reveal (ctx.reveal): the
       * device answers with the value and salt, as JSON, with no question shown.
       */
      secret?: string;
      reveal?: string;
    }
);

interface MacroResult {
  /** The command, as JSON, to check a replay yields the same one. */
  command: string;
  value?: Json;
  /** Set on an answered question: the seq of the table the macro carries on from. */
  head?: number;
  /** Effective recipient when a secret/reveal was answered; commands stay byte-for-byte historical. */
  recipient?: PlayerId;
  /** Address mapping used by a live primitive emit, retained for historical replay after later claims. */
  identities?: Record<PlayerId, PlayerId>;
}

export interface MacroState {
  /** The module (system id) the macro belongs to. */
  system: string;
  /** The owning package's module-state namespace, pinned for continuation and replay. */
  namespace: string;
  macro: string;
  args: Args;
  /** Who started it. */
  by: PlayerId;
  /** The state's seq when it started: the run's identity, and where its replay begins. */
  startSeq: number;
  /** The event that set it off (a hook), for undo. */
  cause?: number;
  /** The recorded hook obligation consumed by this run. */
  reaction?: string;
  /** Historical participant addresses mapped to their current identities after seat reclaim. */
  identities?: Record<PlayerId, PlayerId>;
  /** Every command so far and its result, in order. */
  results: MacroResult[];
  /** The question it is waiting on: the command after the last result. */
  waiting?: MacroQuestion;
  /** The original yielded command at the suspension point, checked before accepting an answer. */
  waitingCommand?: string;
}

/** What a step logs: the macro's new state (null once it ended) and the events it emitted. */
export interface MacroStep {
  type: "macro/step";
  macro: string;
  namespace: string;
  by: PlayerId;
  /** The run this step belongs to: its first step's startSeq. */
  run: number;
  /** On the step that starts a run: its arguments. */
  started?: true;
  args?: Args;
  /** The logged event that set the run off, when a hook did. Undoing that undoes the run. */
  cause?: number;
  reaction?: string;
  /** The ordinary input accepted by this step, retained even when the macro ends or fails. */
  answered?: { player: PlayerId; command: string; value: Json; head: number };
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

/** Executable code belongs to an engine instance, not to whichever engine loaded most recently. */
export interface MacroRegistry {
  macros: Map<string, Record<string, { run: Macro; namespace: string }>>;
  actions: Map<string, Map<string, { action: CodeAction; namespace: string }>>;
}

export function createMacroRegistry(): MacroRegistry {
  return { macros: new Map(), actions: new Map() };
}

let activeRegistry = createMacroRegistry();

/** Select an engine's code for one synchronous resolution, restoring the caller's registry afterward. */
export function withMacroRegistry<T>(registry: MacroRegistry, run: () => T): T {
  const previous = activeRegistry;
  activeRegistry = registry;
  try {
    return run();
  } finally {
    activeRegistry = previous;
  }
}

/** Macros a game module provides, by id. */
export function registerMacros(
  system: string,
  code: Record<string, Macro>,
  registry: MacroRegistry = activeRegistry,
  namespace: string = system,
): void {
  registry.macros.set(system, {
    ...registry.macros.get(system),
    ...Object.fromEntries(Object.entries(code).map(([id, run]) => [id, { run, namespace }])),
  });
}

/** A registered macro, if this peer has the module's code (only the sandbox does). */
function findMacro(system: string, id: string): { run: Macro; namespace: string } | undefined {
  return activeRegistry.macros.get(system)?.[id];
}

/** Code actions a module provides, so a raw `macro/start` for one can be checked. */
export function registerCodeActions(
  system: string,
  actions: CodeAction[],
  registry: MacroRegistry = activeRegistry,
  namespace: string = system,
): void {
  const own = registry.actions.get(system) ?? new Map<string, { action: CodeAction; namespace: string }>();
  for (const action of actions) own.set(action.id, { action, namespace });
  registry.actions.set(system, own);
}

/**
 * Why a code action warns about starting now (its phases, `applies` or
 * `available` say no), or undefined when it can or `macro` isn't one.
 * Callback failures propagate so callers cannot mistake them for advisory warnings.
 */
export function codeActionWhy(state: GameState, macro: string, args: Args, by: PlayerId): string | undefined {
  const system = state.system ?? "";
  const registered = activeRegistry.actions.get(system)?.get(macro);
  if (!registered) return undefined;
  const { action, namespace } = registered;
  const phase = state.pointer.phase;
  if (action.phases && !(phase && action.phases.includes(phase))) return "Not in this phase";
  const unitId = typeof args.unit === "string" ? args.unit : undefined;
  if (action.by === "unit" && (!unitId || state.units[unitId]?.owner !== by)) return "Not your unit";
  const actor = immutable({ player: by, ...(unitId ? { unitId } : {}) });
  const view = gameView(state, namespace);
  if (action.applies && !action.applies(view, actor)) return "Not for this unit";
  const ok = action.available(view, actor);
  return ok === true ? undefined : String(ok);
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
  reaction?: string,
): MacroStep | null {
  const system = state.system ?? "";
  const registered = findMacro(system, macro);
  if (!registered) return null;
  // `args.by` is always who started it, whatever the intent said.
  const script: MacroState = {
    system,
    namespace: registered.namespace,
    macro,
    args: immutable({ ...args, by }),
    by,
    startSeq: state.seq,
    ...(cause === undefined ? {} : { cause }),
    ...(reaction === undefined ? {} : { reaction }),
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
  answer: Json,
): MacroStep {
  return runMacro(script, current, history, rng, answer, false);
}

function runMacro(
  script: MacroState,
  current: GameState,
  history: (seq: number) => GameState,
  rng: Rng,
  answered: Json | undefined,
  started: boolean,
): MacroStep {
  const events: GameEvent[] = [];
  let accepted: MacroStep["answered"];
  const finish = (next: MacroState | null, error?: string): MacroStep => ({
    type: "macro/step",
    macro: script.macro,
    namespace: script.namespace,
    by: script.by,
    run: script.startSeq,
    ...(started ? { started: true as const, args: script.args } : {}),
    ...(script.cause === undefined ? {} : { cause: script.cause }),
    ...(script.reaction === undefined ? {} : { reaction: script.reaction }),
    ...(accepted === undefined ? {} : { answered: accepted }),
    events,
    script: next,
    ...(error ? { error } : {}),
  });
  const stop = (error: string) => finish(null, error);
  const proc = findMacro(script.system, script.macro);
  if (!proc || proc.namespace !== script.namespace)
    return stop(`No matching owner for macro "${script.macro}"`);
  let answer = answered;
  // The table the macro sees: where it started, then each answer moves it on to the table as it is then.
  let state = started ? current : history(script.startSeq);
  const ctx = makeCtx(() => state, script.namespace);
  const results = [...script.results];
  try {
    const gen = proc.run(ctx, immutable(script.args));
    let input: unknown = undefined;
    for (let i = 0; ; i++) {
      if (i > MAX_COMMANDS) return stop(`"${script.macro}" ran more than ${MAX_COMMANDS} commands`);
      const next = gen.next(immutable(input));
      if (next.done) {
        if (i < results.length || (!started && script.waiting && i === script.results.length))
          return stop(`"${script.macro}" finished prematurely on replay`);
        return finish(null);
      }
      const cmd = immutable(next.value);
      const key = JSON.stringify(cmd);
      if (i < results.length) {
        // Replaying: same command, same result.
        const r = results[i]!;
        if (r.command !== key) return stop(`"${script.macro}" behaved differently on replay`);
        if (r.head !== undefined) state = history(r.head);
        const replayed = r.recipient === undefined ? cmd : addressed(cmd, r.recipient);
        for (const e of replayEvents(replayed, r.value, script, r.identities)) {
          const problem = eventProblem(e, state);
          if (problem) throw new Error(problem);
          state = applyEvent(state, e);
        }
        input = cmd.cmd === "reveal" ? (r.value as { value: unknown }).value : r.value;
        continue;
      }
      // A reclaimed player changes the live recipient, never the recorded command or package arguments.
      if (
        !started &&
        i === script.results.length &&
        script.waitingCommand !== undefined &&
        script.waitingCommand !== key
      )
        return stop(`"${script.macro}" changed its waiting command on replay`);
      const live = recipientCommand(cmd, script);
      if (cmd.cmd === "input") {
        const recipient = live as Extract<Command, { cmd: "input" }>;
        if (typeof cmd.player !== "string" || !Object.hasOwn(current.players, recipient.player))
          throw new Error(`Unknown input recipient "${recipient.player}"`);
        if (typeof cmd.question !== "string") throw new Error("input question must be text");
        const problem = inputSpecProblem(cmd.input);
        if (problem) throw new Error(problem);
        const spec = cmd.input as InputSpec;
        if (answer === undefined || inputAnswerProblem(spec, answer))
          return finish({
            ...script,
            results,
            waitingCommand: key,
            waiting: {
              player: recipient.player,
              question: cmd.question,
              input: spec,
            },
          });
        input = immutable(answer);
        accepted = { player: recipient.player, command: key, value: input as Json, head: current.seq };
        answer = undefined;
        results.push({ command: key, value: input as Json, head: current.seq });
        state = current;
        continue;
      }
      if (cmd.cmd === "secret" || cmd.cmd === "reveal") {
        const recipient = live as Extract<Command, { cmd: "secret" | "reveal" }>;
        const suspended = !started && i === script.results.length;
        const got = secretAnswer(
          recipient,
          suspended ? current : state,
          typeof answer === "string" ? answer : undefined,
        );
        answer = undefined;
        if (got === undefined) {
          const waiting: MacroQuestion =
            cmd.cmd === "secret"
              ? {
                  player: recipient.player,
                  question: cmd.question,
                  options: cmd.options as { id: string; label: string }[],
                  secret: cmd.key,
                }
              : { player: recipient.player, question: `Reveal ${cmd.key}`, options: [], reveal: cmd.key };
          return finish({ ...script, results, waiting, waitingCommand: key });
        }
        results.push({
          command: key,
          value: got as Json,
          ...(suspended ? { head: current.seq } : {}),
          recipient: recipient.player,
        });
        if (suspended) state = current;
        const emitted = immutable(replayEvents(recipient, immutable(got), script));
        for (const e of emitted) {
          const problem = eventProblem(e, state);
          if (problem) throw new Error(problem);
          state = applyEvent(state, e);
          events.push(e);
        }
        input = cmd.cmd === "reveal" ? (got as { value: unknown }).value : got;
        continue;
      }
      const { value, emitted, identities } = immutable(perform(cmd, rng, script, state));
      for (const e of emitted) {
        const problem = eventProblem(e, state);
        if (problem) throw new Error(problem);
        state = applyEvent(state, e);
        events.push(e);
      }
      results.push({
        command: key,
        ...(value === undefined ? {} : { value: value as Json }),
        ...(identities === undefined ? {} : { identities }),
      });
      input = value;
    }
  } catch (e) {
    return stop(`"${script.macro}" failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/** Translate only command recipient fields. Package JSON, arguments and historical command keys are untouched. */
function recipientCommand(cmd: Command, script: MacroState): Command {
  if (cmd.cmd !== "input" && cmd.cmd !== "secret" && cmd.cmd !== "reveal") return cmd;
  return addressed(cmd, script.identities?.[cmd.player] ?? cmd.player);
}

function addressed(cmd: Command, player: PlayerId): Command {
  return cmd.cmd === "input" || cmd.cmd === "secret" || cmd.cmd === "reveal" ? { ...cmd, player } : cmd;
}

/** Run a new command against the table the macro currently sees. */
function perform(
  cmd: Command,
  rng: Rng,
  script: MacroState,
  state: GameState,
): { value?: unknown; emitted: GameEvent[]; identities?: Record<PlayerId, PlayerId> } {
  switch (cmd.cmd) {
    case "roll": {
      const dice = parseDice(cmd.dice);
      if (
        !Number.isSafeInteger(dice.count) ||
        dice.count < 0 ||
        dice.count > 100 ||
        !Number.isSafeInteger(dice.sides) ||
        (dice.count > 0 ? dice.sides < 1 : dice.sides < 0) ||
        !Number.isFinite(dice.bonus)
      )
        throw new Error("roll needs finite dice: at most 100 dice with positive integer sides");
      const { rolls, total } = rollDice(dice, rng);
      if (!Number.isFinite(total)) throw new Error("roll total must be finite");
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
    case "shuffle": {
      const event = shuffleCollection(state, cmd.collection, rng);
      if (!event) throw new Error(`No card collection "${cmd.collection}"`);
      return { value: event.order, emitted: [event] };
    }
    case "emit": {
      // Validate the shape before addressing typed fields; reclaimed references are checked on the live event.
      const problem = emitProblem(cmd.event, script.identities ? undefined : state);
      if (problem) throw new Error(problem);
      const event = primitiveRecipients(cmd.event as GameEvent, script.identities);
      return {
        emitted: [event],
        ...(event === cmd.event ? {} : { identities: script.identities }),
      };
    }
    case "set":
      return { emitted: replayEvents(cmd, undefined, script) };
    case "note":
      return { emitted: [{ type: "log/note", text: cmd.text }] };
    case "input":
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
function replayEvents(
  cmd: Command,
  value: unknown,
  script: MacroState,
  identities?: Record<PlayerId, PlayerId>,
): GameEvent[] {
  switch (cmd.cmd) {
    case "emit":
      return [primitiveRecipients(cmd.event as GameEvent, identities)];
    case "shuffle":
      return [{ type: "collection/shuffle", collection: cmd.collection, order: value as string[] }];
    case "set":
      return [{ type: "module/set", module: script.namespace, key: cmd.key, value: cmd.value as Json }];
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

/** Only engine-owned participant address fields follow reclaim; all package data keeps its original values. */
function primitiveRecipients(
  event: GameEvent,
  identities: Record<PlayerId, PlayerId> | undefined,
): GameEvent {
  if (!identities) return event;
  switch (event.type) {
    case "q/set":
    case "q/adjust":
    case "tag/set": {
      const ref = participantRef(event.ref, identities);
      return ref === event.ref ? event : { ...event, ref };
    }
    case "entity/set": {
      const ref = participantRef(event.ref, identities);
      const owner =
        event.ref.kind !== "player" && typeof event.set.owner === "string"
          ? identities[event.set.owner]
          : undefined;
      const set = owner !== undefined && owner !== event.set.owner ? { ...event.set, owner } : event.set;
      return ref === event.ref && set === event.set ? event : { ...event, ref, set };
    }
    case "mod/add": {
      const target = participantRef(event.mod.target, identities);
      return target === event.mod.target ? event : { ...event, mod: { ...event.mod, target } };
    }
    case "unit/add": {
      const unit = participantOwner(event.unit, identities);
      const models = changedItems(event.models, (model) => participantOwner(model, identities));
      return unit === event.unit && models === event.models ? event : { ...event, unit, models };
    }
    case "model/add": {
      const model = participantOwner(event.model, identities);
      return model === event.model ? event : { ...event, model };
    }
    case "token/add": {
      const token = participantOwner(event.token, identities);
      return token === event.token ? event : { ...event, token };
    }
    case "card/add": {
      const card = participantCard(event.card, identities);
      return card === event.card ? event : { ...event, card };
    }
    case "card/set": {
      const set = participantCard(event.set, identities);
      return set === event.set ? event : { ...event, set };
    }
    case "layout/set": {
      const tokens = changedItems(event.layout.tokens, (token) => participantOwner(token, identities));
      const cards = event.layout.cards
        ? changedItems(event.layout.cards, (card) => participantCard(card, identities))
        : undefined;
      return tokens === event.layout.tokens && cards === event.layout.cards
        ? event
        : { ...event, layout: { ...event.layout, tokens, ...(cards ? { cards } : {}) } };
    }
    default:
      return event;
  }
}

function participantRef(ref: EntityRef, identities: Record<PlayerId, PlayerId>): EntityRef {
  const id = ref.kind === "player" ? identities[ref.id] : undefined;
  return id !== undefined && id !== ref.id ? { kind: "player", id } : ref;
}

function participantOwner<T extends { owner?: PlayerId | null }>(
  value: T,
  identities: Record<PlayerId, PlayerId>,
): T {
  const owner = typeof value.owner === "string" ? identities[value.owner] : undefined;
  return owner !== undefined && owner !== value.owner ? { ...value, owner } : value;
}

function participantCard<T extends CardFields>(card: T, identities: Record<PlayerId, PlayerId>): T {
  const owned = participantOwner(card, identities);
  if (
    !Array.isArray(card.visibility) ||
    !card.visibility.some((id) => identities[id] !== undefined && identities[id] !== id)
  )
    return owned;
  return { ...owned, visibility: [...new Set(card.visibility.map((id) => identities[id] ?? id))] };
}

/** Preserve shared arrays unless one of their engine-owned address fields actually changed. */
function changedItems<T>(items: T[], transform: (item: T) => T): T[] {
  let changed: T[] | undefined;
  for (let i = 0; i < items.length; i++) {
    const item = transform(items[i]!);
    if (item === items[i]) continue;
    changed ??= [...items];
    changed[i] = item;
  }
  return changed ?? items;
}

function makeCtx(current: () => GameState, namespace: string): Ctx {
  const ctx: Ctx = {
    get view() {
      const s = current();
      return gameView(s, namespace);
    },
    roll: (dice, label) => ({ cmd: "roll", dice, ...(label ? { label } : {}) }),
    shuffle: (collection) => ({ cmd: "shuffle", collection }),
    note: (text) => ({ cmd: "note", text }),
    input: (player, question, input) => ({ cmd: "input", player, question, input }),
    ask: (player, question, options) => ({
      cmd: "input",
      player,
      question,
      input: { kind: "choice", options },
    }),
    warn: function* (player, reason) {
      if (typeof reason !== "string" || !reason.trim())
        throw new Error("warning reason must be nonempty text");
      const answer = yield ctx.ask(player, `Rule warning: ${reason}`, [
        { id: "proceed", label: "Proceed anyway" },
        { id: "cancel", label: "Cancel" },
      ]);
      if (answer !== "proceed") return false;
      yield ctx.note(`Player override: ${reason}`);
      return true;
    },
    emit: (event) => ({ cmd: "emit", event }),
    set: (key, value) => ({ cmd: "set", key, value }),
    secret: (player, key, question, options) => ({ cmd: "secret", player, key, question, options }),
    reveal: (player, key) => ({ cmd: "reveal", player, key }),
  };
  // Its only data property is a live getter that returns an immutable view;
  // freeze the context without evaluating or replacing that getter.
  return Object.freeze(ctx);
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
