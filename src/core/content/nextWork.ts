import type { Intent } from "../actions";
import { sidePlayers } from "../teams";
import type { GameState, PlayerId, Unit, UnitId } from "../types";
import { isAlive } from "../units";
import { nextRoller } from "../rolls";
import { actingUnits, unitActions } from "./play";
import { playableReactions } from "./reactions";
import { simultaneousPhase } from "./simultaneous";
import { currentSlot, plainActivations, systemOf } from "./turn";
import type { Id } from "./schema";

/**
 * What the game waits on, asked of the engine (docs/next-work.md): whose go
 * it is, what kind of work it is, the units with work left and the ones that
 * are done, and the intent that ends the phase, turn or go. A screen's "next
 * step" (ui-next's step bar) and the soak's no-dead-ends check read it, so
 * neither has to re-derive the rules from phase names.
 *
 * Rules are advisory: the work is what the game would have a player do next,
 * never a wall. `ends` stays offered while units still have work.
 */

/**
 * The kinds of work, in the order the engine asks for them:
 *  - "over", "setup": the battle ended, or the armies are still being set up;
 *  - "question": a rule's question (a code procedure's `ctx.ask`) for one player;
 *  - "roll": dice in an attack or procedure (or closing a finished one);
 *  - "answer": a procedure's own window step (a choice mid-roll);
 *  - "reaction": a reaction window (#80) or a held action (FSD) for the reacting side;
 *  - "score": a mission score to confirm (when the caller passes `scores`);
 *  - "ready": a simultaneous phase (#81) this player hasn't said Done to;
 *  - "pick": the system's own order (40k's fight order) says this player picks a unit;
 *  - "activation": alternating games: this side's go, a unit acting or one to pick;
 *  - "units": a phase with this side's units still to act;
 *  - "end": nothing left in this phase for this side: end it (`ends`);
 *  - "wait": someone else's go.
 * @public
 */
export type WorkKind =
  | "over"
  | "setup"
  | "question"
  | "roll"
  | "answer"
  | "reaction"
  | "score"
  | "ready"
  | "pick"
  | "activation"
  | "units"
  | "end"
  | "wait";

/** @public */
export interface NextWork {
  kind: WorkKind;
  /** Players the game waits on now (for "wait", whose go it is). */
  whose: PlayerId[];
  /** Whether the asking player is one of them. */
  mine: boolean;
  /** The game can't go on until it's done (a question, a roll, a held action); an engine reaction window never blocks. */
  blocking: boolean;
  /**
   * Intents the asking player can send to do the work now (a roll, a pass,
   * Done in a simultaneous phase, a score): the obvious answers, not every
   * one. Empty when there is nothing to press (a unit to move by hand).
   */
  intents: Intent[];
  /** The asking player's units with work left in this phase (or the one acting), in table order. */
  left: UnitId[];
  /** Their units that have done this phase's work. */
  done: UnitId[];
  /** The intent that ends the phase, turn or go for the asking player; null when it isn't theirs to end. */
  ends: Intent | null;
  /** The system's own order (registerWorkOrder), when it has one now. */
  order?: WorkOrder;
}

/** A system's order of picks within a phase (40k's fight order). @public */
export interface WorkOrder {
  /** Whose pick it is, or null when nobody has a unit left to go. */
  picker: PlayerId | null;
  /** The units that may go now: the picker's. */
  eligible: UnitId[];
}

/** Scores waiting to be confirmed, by seat (the mission's pendingScores, which core can't ask). @public */
export interface WorkScore {
  seat: number;
  key: string;
  round: number;
  vp: number;
  why: string;
}

const ORDERS = new Map<Id, (state: GameState) => WorkOrder | null>();

/**
 * A system's own order of picks (40k's fight order, wh40k/fight.ts): who
 * picks a unit next in this phase, or null where it has none. Registered by
 * the system's module, so the engine asks it rather than importing it.
 * @public
 */
export function registerWorkOrder(system: Id, order: (state: GameState) => WorkOrder | null): void {
  ORDERS.set(system, order);
}

/** The system's order now, if it has one. @public */
export function workOrder(state: GameState): WorkOrder | null {
  const f = ORDERS.get(systemOf(state).id);
  if (!f) return null;
  try {
    return f(state);
  } catch {
    return null;
  }
}

const seated = (state: GameState): PlayerId[] =>
  Object.values(state.players)
    .filter((p) => p.seat !== undefined)
    .map((p) => p.id);

const seatOf = (state: GameState, p: PlayerId | undefined) => (p ? state.players[p]?.seat : undefined);

function lastRound(state: GameState): number | null {
  try {
    const r = systemOf(state).turn.rounds;
    return typeof r === "number" ? r : null;
  } catch {
    return null;
  }
}

/** The players on one side, as ids. */
const side = (state: GameState, seat: number | undefined): PlayerId[] =>
  seat === undefined ? [] : sidePlayers(state, seat).map((p) => p.id);

const onTable = (state: GameState, u: Unit) => isAlive(state, u) && !u.status?.reserves;

/**
 * Whether the unit has done this phase's work: a flag one of the phase's
 * actions sets, a once-only action used, a weapon fired this phase, or (in
 * a phase with moves) a model moved since the phase began.
 */
function didPhaseWork(state: GameState, u: Unit, flags: Set<string>, used: string[], moves: boolean) {
  const s = u.status ?? {};
  for (const [k, v] of Object.entries(s)) {
    if (!v) continue;
    if (flags.has(k) || k.startsWith("fired.") || used.some((p) => k === p || k.startsWith(`${p}.`)))
      return true;
  }
  if (!moves) return false;
  return u.modelIds.some((id) => {
    const m = state.models[id];
    if (!m || m.destroyed || !m.phaseStart) return false;
    return Math.hypot(m.position.x - m.phaseStart.x, m.position.y - m.phaseStart.y) > 0.05;
  });
}

/** A side's units in this phase: those with an action they can take and haven't done the phase's work, and those done. */
function phaseUnits(state: GameState, players: PlayerId[]): { left: UnitId[]; done: UnitId[] } {
  const slot = currentSlot(state);
  const system = systemOf(state);
  const defs = (slot?.actions ?? []).flatMap((id) => system.actions.filter((a) => a.id === id));
  const flags = new Set(defs.flatMap((d) => d.sets ?? []));
  const used = defs.filter((d) => d.limit).map((d) => `used.${d.id}`);
  const moves = defs.some((d) => d.move);
  const left: UnitId[] = [];
  const done: UnitId[] = [];
  const units = Object.values(state.units)
    .filter((u) => players.includes(u.owner) && onTable(state, u))
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  for (const u of units) {
    if (didPhaseWork(state, u, flags, used, moves)) {
      done.push(u.id);
      continue;
    }
    try {
      if (unitActions(state, u.id).some((o) => o.ok && !o.def.reactTo)) left.push(u.id);
    } catch {
      // A unit the rules can't read has no work the engine knows of.
    }
  }
  return { left, done };
}

const none = (
  kind: WorkKind,
  whose: PlayerId[],
  player: PlayerId,
  extra: Partial<NextWork> = {},
): NextWork => ({
  kind,
  whose,
  mine: whose.includes(player),
  blocking: false,
  intents: [],
  left: [],
  done: [],
  ends: null,
  ...extra,
});

/**
 * The next piece of work for `player`, and whose it is. `scores` are the
 * mission's scores waiting to be confirmed (missions/scoring.ts
 * `pendingScores`), which only the app can work out; without them scores
 * aren't counted as work.
 * @public
 */
export function nextWork(state: GameState, player: PlayerId, opts: { scores?: WorkScore[] } = {}): NextWork {
  const rounds = lastRound(state);
  if (rounds !== null && state.turn.round > rounds) return none("over", [], player);
  if (state.turn.round === 0) return none("setup", seated(state), player);

  // A rule's question: the game waits on its player's answer.
  const q = state.script?.waiting;
  if (q) {
    const intents: Intent[] =
      q.secret === undefined && q.reveal === undefined && q.player === player
        ? q.options.map((o) => ({ type: "script/answer", answer: o.id }))
        : [];
    return none("question", [q.player], player, { blocking: true, intents });
  }
  // A code procedure still running (a package's, between answers): nobody's press.
  if (state.script) return none("wait", [], player, { blocking: true });

  const proc = state.procedure;
  if (proc) {
    const run = proc.run;
    if (run.pending) {
      const defending = run.pending.side === "defender" || run.pending.side === "opponent";
      const target = proc.targetId ? state.units[proc.targetId]?.owner : undefined;
      const who = defending && target ? target : proc.by;
      const whose = side(state, seatOf(state, who));
      const intents: Intent[] = whose.includes(player)
        ? [
            ...run.pending.options.map((o) => ({ type: "procedure/respond" as const, answer: o.id })),
            { type: "procedure/respond", answer: "pass" },
          ]
        : [];
      return none("answer", whose, player, { blocking: true, intents });
    }
    const roller = run.done ? proc.by : (nextRoller(state, run) ?? proc.by);
    return none("roll", [roller], player, {
      blocking: true,
      intents: roller === player ? [{ type: run.done ? "procedure/clear" : "procedure/roll" }] : [],
    });
  }

  // FSD's held action: the reacting side answers (a reaction, or pass).
  const held = state.pending;
  if (held) {
    const whose = side(state, held.seat);
    const intents: Intent[] = [];
    if (whose.includes(player)) {
      for (const u of Object.values(state.units))
        if (u.owner === player && onTable(state, u))
          for (const o of unitActions(state, u.id))
            if (o.ok && o.def.reactTo) intents.push({ type: "action/take", unitId: u.id, action: o.def.id });
      intents.push({ type: "reaction/pass" });
    }
    return none("reaction", whose, player, { blocking: true, intents });
  }

  const attack = state.attack;
  if (attack) {
    const rollerUnit = attack.stage === "save" ? attack.spec.targetUnitId : attack.spec.attackerUnitId;
    const roller = state.units[rollerUnit]?.owner;
    const whose = roller ? [roller] : [];
    return none("roll", whose, player, {
      blocking: true,
      intents: roller === player ? [{ type: attack.stage === "done" ? "attack/clear" : "attack/roll" }] : [],
    });
  }

  // An engine reaction window (#80) never blocks: the reacting side may play or pass, the active side goes on.
  const open = state.reaction;
  const reactors = open ? side(state, open.seat) : [];
  if (open && reactors.includes(player)) {
    const intents: Intent[] = [
      ...playableReactions(state, player)
        .filter((r) => !r.needsUnit || r.units.length)
        .map((r) => (r.needsUnit ? ({ ...r.play, targetId: r.units[0] } as Intent) : r.play)),
      { type: "reaction/pass" },
    ];
    return none("reaction", reactors, player, { intents });
  }
  const work = phaseWork(state, player, opts.scores ?? []);
  return open ? { ...work, whose: [...new Set([...reactors, ...work.whose])] } : work;
}

/** The work in the phase itself, with no roll or window open. */
function phaseWork(state: GameState, player: PlayerId, scores: WorkScore[]): NextWork {
  // A score to confirm comes first (walking past it is how games ended 0-0).
  const scoring = [...new Set(scores.map((s) => s.seat))];
  if (scoring.length) {
    const whose = scoring.flatMap((s) => side(state, s));
    const mine = scores.find((s) => side(state, s.seat).includes(player));
    return none("score", whose, player, {
      intents: mine
        ? [
            {
              type: "score/confirm",
              key: mine.key,
              seat: mine.seat,
              round: mine.round,
              vp: mine.vp,
              why: mine.why,
            },
          ]
        : [],
    });
  }

  const slot = currentSlot(state);
  const activeSeat = state.turn.activeSeat;
  const active = side(state, activeSeat);

  // Both sides at once: each says Done for themselves; it moves on once everyone has.
  const together = simultaneousPhase(state);
  if (together) {
    const waiting = together.waiting;
    const units = waiting.includes(player) ? phaseUnits(state, [player]) : { left: [], done: [] };
    if (!waiting.includes(player)) return none("wait", waiting, player);
    return none("ready", waiting, player, {
      ...units,
      intents: [{ type: "turn/ready" }],
      ends: { type: "turn/ready" },
    });
  }

  // Taking turns at activating units (Rift Lanterns, FSD, Conquest): one unit's go, then the other side's.
  if (slot?.kind === "alternate") {
    if (!active.includes(player)) return none("wait", active, player);
    const acting = actingUnits(state).filter((u) => u.owner === player);
    if (acting.length)
      return none("activation", active, player, {
        left: acting.map((u) => u.id),
        ends: { type: "turn/endActivation" },
      });
    const plain = plainActivations(state);
    const mineUnits = Object.values(state.units)
      .filter((u) => u.owner === player && isAlive(state, u))
      .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
    const left: UnitId[] = [];
    const done: UnitId[] = [];
    for (const u of mineUnits) {
      if (u.status?.activated) {
        done.push(u.id);
        continue;
      }
      // Plain activations: any unit not yet gone (a code action may bring one in from reserve).
      // Data activations: a unit with an action that starts its go.
      const can = plain
        ? true
        : !u.status?.reserves && unitActions(state, u.id).some((o) => o.ok && o.def.activates !== undefined);
      if (can) left.push(u.id);
    }
    return none(left.length ? "activation" : "end", active, player, {
      left,
      done,
      ends: { type: "turn/pass" },
    });
  }

  // Player turns (or a phase outside them), phase by phase; the system's own order of picks first.
  const order = workOrder(state);
  if (order?.picker) {
    const picker = order.picker;
    const whose = [picker];
    if (picker === player)
      return none("pick", whose, player, {
        order,
        left: order.eligible,
        ends: active.includes(player) ? { type: "turn/next" } : null,
      });
    // The active side can always move on (an opponent who doesn't pick can't hold the game up).
    return none("wait", whose, player, {
      order,
      ends: active.includes(player) ? { type: "turn/next" } : null,
    });
  }
  if (!active.includes(player)) return none("wait", active, player);
  const { left, done } = order
    ? { left: [], done: [] }
    : phaseUnits(
        state,
        active.filter((p) => p === player),
      );
  return none(left.length ? "units" : "end", active, player, {
    left,
    done,
    ends: { type: "turn/next" },
    ...(order ? { order } : {}),
  });
}
