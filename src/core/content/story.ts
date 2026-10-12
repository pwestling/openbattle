import { formatList, gameText, t, tn } from "../../i18n";
import type { GameEvent } from "../actions";
import { lastSeq, undoneSeqs, type GameRecord, type LoggedEvent } from "../log";
import { applyEvent } from "../reducer";
import { codeActionName } from "../script";
import { sideName, sidePlayers, sides } from "../teams";
import type { GameState, PlayerId, UnitId } from "../types";
import { isAlive } from "../units";
import type { Payment } from "./play";
import { findAction } from "./player";
import type { Id } from "./schema";
import { currentSlot, systemOf } from "./turn";

/**
 * What happened in a stretch of the log (#85, docs/story.md): the events
 * after `from` up to `to`, folded once and told per side. Facts first (units
 * moved, actions taken, attacks and what they cost, VP, CP and stratagems),
 * then ready-made lines in the reader's language. Generic over every game:
 * it reads only the log and the states it folds to, and each game may name
 * its own verbs (`GameSystem.storyVerbs`).
 *
 * Secrets stay secret: the log holds only commitments until a reveal, and the
 * story never reads a value, so nothing hidden can be told. Revealed secrets
 * are counted, with the label the revealer gave.
 */

/** One unit's attacks on one enemy unit in the stretch, and what they cost it. @public */
export interface StoryAttack {
  attacker: UnitId;
  attackerName: string;
  target: UnitId;
  targetName: string;
  /** Models of the target slain. */
  slain: number;
  /** Wounds the target's models lost (slain models' included where the game counts them). */
  wounds: number;
  /** The target has no models left. */
  destroyed: boolean;
}

/** What one of the side's own units lost, from any cause. @public */
export interface StoryLoss {
  unit: UnitId;
  name: string;
  slain: number;
  wounds: number;
  destroyed: boolean;
}

/** An action the side's units took, and which units took it. @public */
export interface StoryAct {
  action: Id;
  /** The action's name, as the game has it. */
  name: string;
  /** The game's verb for it (`storyVerbs`): "" to leave it untold, null for none. */
  verb: string | null;
  units: UnitId[];
}

/** A stratagem or other player action, or a reaction, the side played. @public */
export interface StoryPlay {
  action: Id;
  name: string;
  /** What it cost, by resource ("CP": 1). */
  cost: Record<string, number>;
  /** Played in answer to the other side (a reaction window, or a held action). */
  reaction: boolean;
  /** The unit that played it (a unit's reaction), or the unit it was used on. */
  unit?: UnitId;
  unitName?: string;
}

/** Victory points the side was given at a scoring moment. @public */
export interface StoryScore {
  vp: number;
  /** The scoring rule's name, as the mission gives it. */
  why: string;
  round: number;
}

/** One side's part of the stretch. @public */
export interface StorySide {
  seat: number;
  players: PlayerId[];
  /** "Ana" or "Ana & Cy", as names are shown. */
  name: string;
  /** Units whose models moved (on the table; deployment aside). */
  moved: UnitId[];
  /** Units set on the table before the battle. */
  deployed: number;
  acts: StoryAct[];
  /** Attacks this side made, in the order they began. */
  attacks: StoryAttack[];
  /** What this side's units lost. */
  losses: StoryLoss[];
  /** This side's units destroyed. */
  destroyed: UnitId[];
  /** VP gained in the stretch (less any taken away). */
  vp: number;
  scores: StoryScore[];
  /** Counters spent and gained, by resource (VP and CP included). */
  spent: Record<string, number>;
  gained: Record<string, number>;
  plays: StoryPlay[];
  /** Dice re-rolled in attacks. */
  rerolls: number;
  secrets: { committed: number; revealed: string[] };
  /** One or two lines in words, or none when the side did nothing. */
  lines: string[];
}

/** A point in the game: round, whose turn (seat), and the phase's name. @public */
export interface StoryMoment {
  round: number;
  seat: number;
  phase?: string;
}

/** A stretch of the log, told. @public */
export interface Story {
  /** The stretch: events after `from`, up to and including `to`. */
  from: number;
  to: number;
  viewer: PlayerId | null;
  /** The viewer's side, or null for a watcher. */
  viewerSeat: number | null;
  start: StoryMoment;
  end: StoryMoment;
  /** Phases entered on the way, in order. */
  phases: StoryMoment[];
  /** The battle was over by the end of it. */
  over: boolean;
  /** Every side, in seat order. */
  sides: StorySide[];
  /** Every side's lines, in seat order. */
  lines: string[];
  /**
   * One line for the viewer, most important first and at most about 110
   * characters: their own last attack (if the stretch has one), what they lost,
   * the VP the other side scored, whom it attacked, how many units it moved,
   * and what it played. A watcher gets each side by name. Null when nothing happened.
   */
  brief: string | null;
}

interface Acc {
  moved: Set<UnitId>;
  deployed: number;
  acts: Map<Id, StoryAct>;
  attacks: Map<string, StoryAttack>;
  losses: Map<UnitId, StoryLoss>;
  destroyed: UnitId[];
  scores: StoryScore[];
  spent: Record<string, number>;
  gained: Record<string, number>;
  plays: StoryPlay[];
  rerolls: number;
  committed: number;
  revealed: string[];
}

const newAcc = (): Acc => ({
  moved: new Set(),
  deployed: 0,
  acts: new Map(),
  attacks: new Map(),
  losses: new Map(),
  destroyed: [],
  scores: [],
  spent: {},
  gained: {},
  plays: [],
  rerolls: 0,
  committed: 0,
  revealed: [],
});

const BRIEF_MAX = 110;

const seatOfPlayer = (s: GameState, p: PlayerId | undefined) => (p ? s.players[p]?.seat : undefined);
const seatOfUnit = (s: GameState, u: UnitId | undefined) =>
  seatOfPlayer(s, u ? s.units[u]?.owner : undefined);

const moment = (s: GameState): StoryMoment => {
  const phase = s.turn.round > 0 ? currentSlot(s)?.name : undefined;
  return { round: s.turn.round, seat: s.turn.activeSeat, ...(phase ? { phase } : {}) };
};

/** Counters a payment took. */
function costOf(payment: Payment[] | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of payment ?? []) {
    const n = p.amount ?? p.indices?.length ?? 0;
    if (n) out[p.resource] = (out[p.resource] ?? 0) + n;
  }
  return out;
}

/** Events a code procedure's step carried, with the step's own. */
function flat(event: GameEvent): GameEvent[] {
  return event.type === "script/step" ? [event, ...event.events.flatMap(flat)] : [event];
}

/** The attack going on as an event lands: who attacks whom, by the event or the table. */
function attackOf(
  event: GameEvent,
  before: GameState,
  after: GameState,
): { attacker: UnitId; target: UnitId; script: boolean } | null {
  if (event.type === "action/take" && event.targetId)
    return { attacker: event.unitId, target: event.targetId, script: false };
  if (event.type === "attack/declare")
    return {
      attacker: event.attack.spec.attackerUnitId,
      target: event.attack.spec.targetUnitId,
      script: false,
    };
  if (event.type === "script/step" && event.unit && event.target)
    return { attacker: event.unit, target: event.target, script: true };
  for (const s of [after, before]) {
    if (s.attack)
      return { attacker: s.attack.spec.attackerUnitId, target: s.attack.spec.targetUnitId, script: false };
    if (s.procedure?.targetId)
      return { attacker: s.procedure.unitId, target: s.procedure.targetId, script: false };
  }
  for (const s of [after, before]) {
    const a = s.script?.args;
    if (a && typeof a.unit === "string" && typeof a.target === "string")
      return { attacker: a.unit, target: a.target, script: true };
  }
  return null;
}

/** @public */
export interface StoryOptions {
  /**
   * The table as it stood at `fromSeq` (`stateAt(record, fromSeq)`, or the
   * state a screen already holds), to skip folding the log up to it: then only
   * the stretch is folded. Ignored unless its `seq` is `fromSeq`.
   */
  start?: GameState;
}

/**
 * Tell the stretch of `record` after `fromSeq` up to `toSeq` (inclusive) as
 * `viewer` (a player id, or null for a watcher) would read it. Undone events
 * are left out. One fold of the log: cheap enough for a whole turn or game.
 */
export function story(
  record: GameRecord,
  fromSeq: number,
  toSeq: number = Infinity,
  viewer: PlayerId | null = null,
  opts: StoryOptions = {},
): Story {
  const to = Math.min(toSeq, lastSeq(record));
  const from = Math.min(fromSeq, to);
  const undone = undoneSeqs(record, to);
  const given = opts.start?.seq === from ? opts.start : undefined;
  let state = given ?? record.initial;
  const stretch: LoggedEvent[] = [];
  for (const logged of record.events) {
    if (logged.seq > to) break;
    if (logged.seq > from) {
      stretch.push(logged);
      continue;
    }
    if (given) continue;
    if (!undone.has(logged.seq)) state = applyEvent(state, logged.event);
    state = { ...state, seq: logged.seq };
  }
  const start = moment(state);
  const phases: StoryMoment[] = [];
  const accs = new Map<number, Acc>();
  const acc = (seat: number | undefined): Acc | null => {
    if (seat === undefined) return null;
    let a = accs.get(seat);
    if (!a) accs.set(seat, (a = newAcc()));
    return a;
  };
  const names = (s: GameState, u: UnitId) => s.units[u]?.name ?? "";

  for (const logged of stretch) {
    if (undone.has(logged.seq) || logged.event.type === "undo") {
      state = { ...state, seq: logged.seq };
      continue;
    }
    const before = state;
    const after = { ...applyEvent(before, logged.event), seq: logged.seq };
    state = after;
    tell(logged, before, after);
  }

  function tell(logged: LoggedEvent, before: GameState, after: GameState): void {
    const { event } = logged;
    const t0 = before.turn;
    const t1 = after.turn;
    if (t0.round !== t1.round || t0.phase !== t1.phase || t0.activeSeat !== t1.activeSeat)
      phases.push(moment(after));

    for (const ev of flat(event)) {
      if (ev.type === "secret/commit") {
        const a = acc(seatOfPlayer(after, ev.player));
        if (a) a.committed += ev.secrets.length;
      } else if (ev.type === "secret/reveal") {
        acc(seatOfPlayer(after, ev.player))?.revealed.push(ev.label ?? "");
      }
    }
    const system = systemOf(before);
    const verbs = system.storyVerbs ?? {};
    const actOn = (seat: number | undefined, action: Id, name: string, unit: UnitId) => {
      const a = acc(seat);
      if (!a) return;
      let act = a.acts.get(action);
      if (!act) a.acts.set(action, (act = { action, name, verb: verbs[action] ?? null, units: [] }));
      if (!act.units.includes(unit)) act.units.push(unit);
    };
    if (event.type === "action/take") {
      const seat = seatOfUnit(before, event.unitId);
      const def = findAction(before, event.action);
      const name = def?.name ?? event.action;
      const reacting =
        seat !== undefined &&
        (before.pending?.seat === seat || (!!before.reaction && before.reaction.seat === seat));
      if (reacting)
        acc(seat)?.plays.push({
          action: event.action,
          name,
          cost: costOf(event.payment),
          reaction: true,
          unit: event.unitId,
          unitName: names(before, event.unitId),
        });
      else actOn(seat, event.action, name, event.unitId);
    } else if (event.type === "player/action") {
      const seat = seatOfPlayer(before, event.player);
      const def = findAction(before, event.action);
      acc(seat)?.plays.push({
        action: event.action,
        name: event.label ?? def?.name ?? event.action,
        cost: costOf(event.payment),
        reaction: seat !== undefined && !!before.reaction && before.reaction.seat === seat,
        ...(event.targetId ? { unit: event.targetId, unitName: names(before, event.targetId) } : {}),
      });
    } else if (event.type === "script/step" && event.started && event.unit) {
      const name = codeActionName(system.id, event.started);
      if (name !== undefined) actOn(seatOfUnit(before, event.unit), event.started, name, event.unit);
    } else if (event.type === "attack/roll" && event.reroll) {
      const a = acc(seatOfPlayer(before, logged.by));
      if (a) a.rerolls++;
    } else if (event.type === "score/confirm" && event.vp && !event.skipped) {
      acc(event.seat)?.scores.push({ vp: event.vp, why: event.why, round: event.round });
    } else if (event.type === "unit/add") {
      const a = acc(seatOfPlayer(after, event.unit.owner));
      if (a && before.turn.round === 0) a.deployed++;
    }

    // Who is attacking whom: an attack shows even when it costs nothing.
    const fight = attackOf(event, before, after);
    const fightSeat = fight
      ? (seatOfUnit(before, fight.attacker) ?? seatOfUnit(after, fight.attacker))
      : undefined;
    const targetSeat = fight
      ? (seatOfUnit(before, fight.target) ?? seatOfUnit(after, fight.target))
      : undefined;
    const hostile =
      !!fight && fightSeat !== undefined && targetSeat !== undefined && fightSeat !== targetSeat;
    const attackEntry = (by: UnitId, on: UnitId): StoryAttack | null => {
      const a = acc(seatOfUnit(before, by) ?? seatOfUnit(after, by));
      if (!a) return null;
      const key = `${by}>${on}`;
      let e = a.attacks.get(key);
      if (!e)
        a.attacks.set(
          key,
          (e = {
            attacker: by,
            attackerName: names(before, by) || names(after, by),
            target: on,
            targetName: names(before, on) || names(after, on),
            slain: 0,
            wounds: 0,
            destroyed: false,
          }),
        );
      return e;
    };
    if (hostile && before.turn.round > 0) attackEntry(fight.attacker, fight.target);

    // The table before and after: models lost and wounded, units destroyed, models moved.
    if (before.models !== after.models && before.turn.round > 0 && after.turn.round > 0) {
      const setup = event.type === "models/move" && !!event.setup;
      const touched = new Set<UnitId>();
      for (const id in before.models) {
        const b = before.models[id]!;
        const a = after.models[id];
        if (a === b || !b.unitId || b.destroyed) continue;
        const unit = b.unitId;
        const lost = !a || !!a.destroyed;
        const wounds = Math.max(0, (a?.woundsLost ?? 0) - (b.woundsLost ?? 0));
        if (lost || wounds) {
          touched.add(unit);
          const seat = seatOfUnit(before, unit);
          const side = acc(seat);
          if (side) {
            let l = side.losses.get(unit);
            if (!l)
              side.losses.set(
                unit,
                (l = { unit, name: names(before, unit), slain: 0, wounds: 0, destroyed: false }),
              );
            if (lost) l.slain++;
            l.wounds += wounds;
          }
          // Whose doing: the attack going on, if the model is the attacked side's (or, in a code
          // procedure's fight, the attacker's side hit back by the unit it attacked).
          let e: StoryAttack | null = null;
          if (hostile && seat === targetSeat) e = attackEntry(fight.attacker, unit);
          else if (hostile && fight.script && seat === fightSeat) e = attackEntry(fight.target, unit);
          if (e) {
            if (lost) e.slain++;
            e.wounds += wounds;
          }
        } else if (a && !setup && (a.position.x !== b.position.x || a.position.y !== b.position.y)) {
          acc(seatOfUnit(after, unit))?.moved.add(unit);
        }
      }
      for (const unit of touched) {
        if (!isAlive(before, before.units[unit]) || isAlive(after, after.units[unit])) continue;
        const seat = seatOfUnit(before, unit);
        const side = acc(seat);
        if (!side) continue;
        side.destroyed.push(unit);
        side.losses.get(unit)!.destroyed = true;
        for (const a of accs.values())
          for (const e of a.attacks.values()) if (e.target === unit) e.destroyed = true;
      }
    }

    // Counters: a side's are one set (core/teams.ts), held by its first player.
    if (before.resources !== after.resources && !event.type.startsWith("player/")) {
      for (const seat of sides(after)) {
        const holder = sidePlayers(after, seat)[0]?.id;
        if (!holder) continue;
        const b = before.resources[holder] ?? {};
        const a = after.resources[holder] ?? {};
        if (a === b) continue;
        for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
          const d = (a[key] ?? 0) - (b[key] ?? 0);
          if (!d) continue;
          const side = acc(seat)!;
          const into = d > 0 ? side.gained : side.spent;
          into[key] = (into[key] ?? 0) + Math.abs(d);
        }
      }
    }
  }

  const end = state;
  const resources = systemOf(end).resources ?? [];
  const label = (id: Id) => {
    const r = resources.find((x) => x.id === id);
    return gameText(r?.short ?? r?.name ?? id);
  };
  const seats = [...new Set([...sides(end), ...accs.keys()])].sort((a, b) => a - b);
  const told: StorySide[] = seats.map((seat) => {
    const a = accs.get(seat) ?? newAcc();
    const side: StorySide = {
      seat,
      players: sidePlayers(end, seat).map((p) => p.id),
      name: sideName(end, seat),
      moved: [...a.moved],
      deployed: a.deployed,
      acts: [...a.acts.values()],
      attacks: [...a.attacks.values()],
      losses: [...a.losses.values()],
      destroyed: a.destroyed,
      vp: (a.gained.VP ?? 0) - (a.spent.VP ?? 0),
      scores: a.scores,
      spent: a.spent,
      gained: a.gained,
      plays: a.plays,
      rerolls: a.rerolls,
      secrets: { committed: a.committed, revealed: a.revealed },
      lines: [],
    };
    side.lines = sideLines(side, label);
    return side;
  });
  const viewerSeat = viewer ? (end.players[viewer]?.seat ?? null) : null;
  const rounds = systemOf(end).turn.rounds;
  return {
    from,
    to,
    viewer,
    viewerSeat,
    start,
    end: moment(end),
    phases,
    over: typeof rounds === "number" && end.turn.round > rounds,
    sides: told,
    lines: told.flatMap((s) => s.lines),
    brief: brief(told, viewerSeat),
  };
}

/** The story's one line (Story.brief) for another reader, without telling the stretch again. @public */
export function storyBrief(s: Story, viewer: PlayerId | null): string | null {
  const seat = viewer === null ? undefined : s.sides.find((x) => x.players.includes(viewer))?.seat;
  return brief(s.sides, seat ?? null);
}

/** "Smokescreen (1 CP)": a play and what it cost, by the resources' short names. */
const playText = (p: StoryPlay, label: (id: Id) => string) => {
  const name = gameText(p.name);
  const cost = Object.entries(p.cost)
    .map(([r, n]) => `${n} ${label(r)}`)
    .join(", ");
  return cost ? t("{name} ({cost})", { name, cost }) : name;
};

/** "Lance Team (2 slain)": an attacked unit and what it cost it. */
function targetText(e: Pick<StoryAttack, "targetName" | "slain" | "wounds" | "destroyed">): string {
  const unit = e.targetName;
  if (e.destroyed) return t("{unit} (destroyed)", { unit });
  if (e.slain) return tn(e.slain, "{unit} ({n} slain)", "{unit} ({n} slain)", { unit });
  if (e.wounds) return tn(e.wounds, "{unit} ({n} wound)", "{unit} ({n} wounds)", { unit });
  return t("{unit} (no losses)", { unit });
}

/** Each target once by name (two units of one name read as one), its losses from every attacker added up. */
function byTarget(attacks: StoryAttack[]): StoryAttack[] {
  const out = new Map<string, StoryAttack>();
  for (const a of attacks) {
    const e = out.get(a.targetName);
    if (!e) out.set(a.targetName, { ...a });
    else {
      e.slain += a.slain;
      e.wounds += a.wounds;
      e.destroyed ||= a.destroyed;
    }
  }
  return [...out.values()];
}

const costly = (a: StoryAttack) => a.destroyed || a.slain > 0 || a.wounds > 0;
const worst = (a: StoryAttack, b: StoryAttack) =>
  Number(b.destroyed) - Number(a.destroyed) || b.slain - a.slain || b.wounds - a.wounds;

/** The units attacked, those that lost something first, the rest counted when there are many. */
function attackedText(attacks: StoryAttack[]): string {
  const all = byTarget(attacks);
  const lost = all.filter(costly).sort(worst);
  const clean = all.filter((a) => !costly(a));
  const items = lost.map(targetText);
  if (clean.length <= 2) items.push(...clean.map(targetText));
  else
    items.push(
      lost.length
        ? tn(clean.length, "{n} more unit (no losses)", "{n} more units (no losses)")
        : tn(clean.length, "{n} unit (no losses)", "{n} units (no losses)"),
    );
  return formatList(items);
}

/** "shot with 2 units": the side's actions in the game's words; those told by one verb (Conquest's reforms) count together. */
function actText(s: StorySide): string[] {
  const verbs = new Map<string, Set<UnitId>>();
  for (const a of s.acts) {
    if (a.verb === "") continue;
    const verb = gameText(a.verb ?? a.name);
    const units = verbs.get(verb) ?? new Set<UnitId>();
    for (const u of a.units) units.add(u);
    verbs.set(verb, units);
  }
  return [...verbs].map(([verb, units]) =>
    tn(units.size, "{verb} with {n} unit", "{verb} with {n} units", { verb }),
  );
}

function sideLines(s: StorySide, label: (id: Id) => string): string[] {
  const lines: string[] = [];
  const did: string[] = [];
  if (s.deployed) did.push(tn(s.deployed, "deployed {n} unit", "deployed {n} units"));
  if (s.moved.length) did.push(tn(s.moved.length, "moved {n} unit", "moved {n} units"));
  did.push(...actText(s));
  if (s.attacks.length) did.push(t("attacked {targets}", { targets: attackedText(s.attacks) }));
  if (did.length) lines.push(t("{name}: {parts}.", { name: s.name, parts: formatList(did) }));

  const got: string[] = [];
  if (s.vp > 0) {
    const why = [...new Set(s.scores.map((x) => x.why).filter(Boolean))];
    got.push(
      why.length
        ? t("scored {vp} VP ({why})", { vp: String(s.vp), why: formatList(why) })
        : t("scored {vp} VP", { vp: String(s.vp) }),
    );
  }
  const used = s.plays.filter((p) => !p.reaction);
  const reacted = s.plays.filter((p) => p.reaction);
  if (used.length) got.push(t("used {list}", { list: formatList(used.map((p) => playText(p, label))) }));
  if (reacted.length)
    got.push(t("reacted with {list}", { list: formatList(reacted.map((p) => playText(p, label))) }));
  const lost = s.losses
    .filter((l) => l.slain || l.destroyed)
    .map((l) =>
      l.destroyed
        ? t("{unit} (destroyed)", { unit: l.name })
        : tn(l.slain, "{n} from {unit}", "{n} from {unit}", { unit: l.name }),
    );
  if (lost.length) got.push(t("lost {list}", { list: formatList(lost) }));
  if (s.secrets.revealed.length)
    got.push(tn(s.secrets.revealed.length, "revealed {n} secret", "revealed {n} secrets"));
  if (got.length) lines.push(t("{name}: {parts}.", { name: s.name, parts: formatList(got) }));
  return lines;
}

/** The viewer's one line (see Story.brief): the most important things first, cut to fit. */
function brief(told: StorySide[], seat: number | null): string | null {
  const items: string[] = [];
  const mine = seat === null ? undefined : told.find((s) => s.seat === seat);
  const others = told.filter((s) => s !== mine);
  if (mine) {
    // The last attack that did something, else the last one.
    const last = mine.attacks.findLast(costly) ?? mine.attacks.at(-1);
    if (last) {
      const p = { unit: last.attackerName, target: last.targetName };
      items.push(
        last.destroyed
          ? t("Your {unit} destroyed {target}", p)
          : last.slain
            ? tn(last.slain, "Your {unit} hit {target}: {n} slain", "Your {unit} hit {target}: {n} slain", p)
            : last.wounds
              ? tn(
                  last.wounds,
                  "Your {unit} hit {target}: {n} wound",
                  "Your {unit} hit {target}: {n} wounds",
                  p,
                )
              : t("Your {unit} attacked {target}: no losses", p),
      );
    }
    const hurt = mine.losses.filter((l) => l.slain && !l.destroyed);
    const gone = mine.losses.filter((l) => l.destroyed);
    const parts = [
      ...(hurt.length
        ? [
            t("Lost {list}", {
              list: formatList(hurt.map((l) => tn(l.slain, "{n} {unit}", "{n} {unit}", { unit: l.name }))),
            }),
          ]
        : []),
      ...(gone.length ? [t("{list} destroyed", { list: formatList(gone.map((l) => l.name)) })] : []),
    ];
    if (parts.length) items.push(parts.join("; "));
  } else {
    // A watcher: what each side's attacks did.
    for (const s of others)
      if (s.attacks.length)
        items.push(
          t("{name} attacked {targets}", {
            name: s.name,
            targets: attackedText(s.attacks),
          }),
        );
  }
  for (const s of others)
    if (s.vp > 0) items.push(t("{name} scored {vp} VP", { name: s.name, vp: String(s.vp) }));
  if (mine)
    for (const s of others) {
      const names = byTarget(s.attacks)
        .sort(worst)
        .map((a) => a.targetName);
      if (names.length > 2)
        items.push(
          tn(
            names.length - 2,
            "{name} attacked {targets} and {n} more",
            "{name} attacked {targets} and {n} more",
            {
              name: s.name,
              targets: names.slice(0, 2).join(", "),
            },
          ),
        );
      else if (names.length)
        items.push(t("{name} attacked {targets}", { name: s.name, targets: formatList(names) }));
    }
  for (const s of others)
    if (s.moved.length)
      items.push(tn(s.moved.length, "{name} moved {n} unit", "{name} moved {n} units", { name: s.name }));
  for (const s of others)
    if (s.plays.length)
      items.push(
        t("{name} used {list}", { name: s.name, list: formatList(s.plays.map((p) => gameText(p.name))) }),
      );
  // Last, what else they did ("Rook: advanced with 1 unit"), when their units didn't move.
  for (const s of others) {
    const acts = s.moved.length ? [] : actText(s);
    if (acts.length) items.push(t("{name}: {parts}", { name: s.name, parts: formatList(acts) }));
  }
  if (!items.length) return null;
  let text = `${items.join(". ")}.`;
  while (items.length > 1 && text.length > BRIEF_MAX) {
    items.pop();
    text = `${items.join(". ")}.`;
  }
  return text;
}
