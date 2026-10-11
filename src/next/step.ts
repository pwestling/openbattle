import {
  opposed,
  sideName,
  sidePlayers,
  type GameState,
  type Intent,
  type PlayerId,
  type Unit,
} from "../core";
import { actingUnits, unitActions } from "../core/content/play";
import { simultaneousPhase } from "../core/content/simultaneous";
import { currentSlot, phaseHint, plainActivations, systemOf, turnView } from "../core/content/turn";
import { formatList, gameText, t, tn } from "../i18n";
import { displayName } from "../i18n/names";
import type { Pending } from "../missions/scoring";
import { fightOrder } from "../systems/wh40k/fight";
import { aliveModels, moveAllowance, unitDistance, unitMoved, weaponReach } from "../systems/wh40k/rules";

/** Whether any enemy is within reach of the unit's ranged weapons (true when the game doesn't say ranges). */
function inReach(game: GameState, unit: Unit): boolean {
  const ranged = Object.values(unit.sheet?.weapons ?? {}).filter((w) => w.kind === "ranged");
  if (!ranged.length) return true;
  const reaches = ranged.map(weaponReach);
  if (reaches.some((r) => r === null)) return true;
  const reach = Math.max(...(reaches as number[]));
  const mine = aliveModels(game, unit);
  return Object.values(game.units).some(
    (e) => opposed(game, e.owner, unit.owner) && unitDistance(mine, aliveModels(game, e)) <= reach,
  );
}

/**
 * The step bar (ui-next): what this screen's player does now, in one sentence,
 * what's left, and the one lit thing to press. Worked out from the game alone,
 * so every turn shape (player turns, alternating units, Conquest's stack,
 * FSD's dice) answers the same question: what is the next piece of work?
 *
 * Gold goes on exactly one thing: the next unit to act while any are left,
 * else the button that moves on. "Done" stays pressable while work is left
 * (rules are advisory) but asks first.
 */

export interface StepButton {
  label: string;
  intent?: Intent;
  /** Who the intent is sent as (hotseat, both sides on one screen). */
  as?: PlayerId;
  /** Lit: the one thing to press next. */
  lit?: boolean;
  /** Asked before it goes, when it skips work that's left ("2 units haven't shot"). */
  confirm?: string;
  /** Not an intent: a local action the bar's owner handles. */
  local?: "copy" | "undo";
}

interface StepUnit {
  id: string;
  name: string;
  done: boolean;
}

interface Step {
  /** "job": this screen's player has something to do; "wait": someone else does; "over": the battle ended. */
  tone: "job" | "wait" | "over" | "setup";
  /** The side whose go it is, for the bar's colour. */
  seat: number;
  /** The phases of this turn, with the current one, for games that have them. */
  rail?: { names: string[]; current: number };
  say: string;
  sub?: string;
  /** Units for the "left" row: the next one is lit while any are left. */
  units?: StepUnit[];
  /** The unit lit as the next piece of work. */
  next?: string;
  buttons: StepButton[];
}

interface StepInput {
  game: GameState;
  /** Players this screen plays (both sides in hotseat, less the computer's). */
  mine: PlayerId[];
  /** Scores waiting to be confirmed (missions/scoring.ts). */
  pending: Pending[];
  /** The unit picked on this screen, and a shot or fight being set up from it. */
  selected?: string | null;
  draft?: { attackerId: string; targetId?: string } | null;
}

const alive = (game: GameState, u: Unit) =>
  !u.status?.reserves && u.modelIds.some((id) => game.models[id] && !game.models[id]!.destroyed);

/** The phase's verb for its Done button: "Done moving", "Done shooting". */
function doneLabel(phase: string, last: boolean): string {
  if (last) return t("End turn");
  if (/move/i.test(phase)) return t("Done moving");
  if (/shoot/i.test(phase)) return t("Done shooting");
  if (/charge/i.test(phase)) return t("Done charging");
  if (/fight|combat|melee/i.test(phase)) return t("Done fighting");
  return t("Done with {phase}", { phase: gameText(phase) });
}

/** Units of `seat` that still have work in this phase, and the ones that are done, in table order. */
function phaseUnits(game: GameState, seat: number, phase: string): StepUnit[] {
  const units = Object.values(game.units)
    .filter((u) => game.players[u.owner]?.seat === seat && alive(game, u))
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  const out: StepUnit[] = [];
  for (const u of units) {
    let can: boolean;
    if (/move/i.test(phase)) {
      const s = u.status ?? {};
      // Any model moved counts (UX N20): the engine's flags come only with Advance and the like.
      can = !(s.moved || s.advanced || s.fellBack || s.stayed) && unitMoved(aliveModels(game, u)) < 0.05;
      out.push({ id: u.id, name: u.name, done: !can });
      continue;
    }
    try {
      const options = unitActions(game, u.id).filter((o) => o.ok);
      can = /shoot/i.test(phase)
        ? options.some((o) => /shoot|fire/i.test(o.def.name)) && inReach(game, u)
        : /charge/i.test(phase)
          ? options.some((o) => /charge/i.test(o.def.name))
          : options.length > 0;
    } catch {
      can = false;
    }
    // A unit that did this phase's thing shows as done; one that never could isn't listed.
    // (The rules are advisory, so a unit that shot may still be allowed to again: it counts as done.)
    const did = !!(/shoot/i.test(phase)
      ? u.status?.shot
      : /charge/i.test(phase)
        ? u.status?.charged
        : /fight/i.test(phase)
          ? u.status?.fought
          : false);
    if (can || did) out.push({ id: u.id, name: u.name, done: did || !can });
  }
  return out;
}

/** An attack under way, said as who is rolling now (UX N17). */
function attackSay(game: GameState, mine: PlayerId[]): { say: string; sub: string } {
  const a = game.attack;
  if (!a) return { say: t("A roll is under way"), sub: t("Roll where the dice are.") };
  const attacker = game.units[a.spec.attackerUnitId];
  const target = game.units[a.spec.targetUnitId];
  const say = t("{a} attacks {b}", { a: attacker?.name ?? "", b: target?.name ?? "" });
  const rollerUnit = a.stage === "save" ? target : attacker;
  const roller = rollerUnit ? game.players[rollerUnit.owner] : undefined;
  if (!roller) return { say, sub: "" };
  // Damage is worked out from the dice already rolled: nobody's press (UX N22).
  if (a.stage === "damage" || a.stage === "done") return { say, sub: t("Then the damage, where the dice are.") };
  const stage = a.stage === "hit" ? t("hits") : a.stage === "wound" ? t("wounds") : t("saves");
  return {
    say,
    sub: mine.includes(roller.id)
      ? t("Your roll: {stage}", { stage })
      : t("{name} rolls {stage}", { name: displayName(roller.name), stage }),
  };
}

/** Say "{side}" as the player names it: a person's name for a one-player side. */
function sideLabel(game: GameState, seat: number): string {
  const players = sidePlayers(game, seat);
  return players.length === 1 ? displayName(players[0]!.name) || sideName(game, seat) : sideName(game, seat);
}

export function stepFor({ game, mine, pending, selected, draft }: StepInput): Step {
  const seat = game.turn.activeSeat;
  const who = sideLabel(game, seat);
  const view = turnView(game);
  const rail =
    view.phases.length > 1 && !view.alternating ? { names: view.phases, current: view.current } : undefined;
  const isMine = (p: PlayerId | null | undefined) => !!p && mine.includes(p);
  const myTurn = sidePlayers(game, seat).some((p) => isMine(p.id));
  const actor = sidePlayers(game, seat).find((p) => isMine(p.id))?.id;

  const rounds = (() => {
    try {
      return systemOf(game).turn.rounds;
    } catch {
      return null;
    }
  })();
  if (typeof rounds === "number" && game.turn.round > rounds)
    return { tone: "over", seat, say: t("The battle is over"), buttons: [] };
  if (game.turn.round === 0) return { tone: "setup", seat, say: t("Setting up"), buttons: [] };

  // A roll under way is finished where its dice are; the bar says whose roll it is.
  if (game.attack || game.procedure)
    return {
      tone: myTurn ? "job" : "wait",
      seat,
      rail,
      ...attackSay(game, mine),
      buttons: [],
    };
  if (game.pending)
    return {
      tone: "wait",
      seat,
      rail,
      say: t("A reaction"),
      sub: t("Answer on the reaction card by the dice."),
      buttons: [],
    };

  // A score to confirm comes first: walking past it is how games ended 0-0 (PX A3).
  const score = pending.find((p) => sidePlayers(game, p.seat).some((x) => isMine(x.id)));
  if (score) {
    const by = sidePlayers(game, score.seat).find((x) => isMine(x.id))!.id;
    const base = { type: "score/confirm" as const, key: score.key, seat: score.seat, round: score.round };
    const why = `${score.rule}: ${score.why}`;
    const buttons: StepButton[] = score.ask
      ? score.ask.answers.map((a, i) => ({
          label: a.label,
          as: by,
          lit: i === 0,
          intent: { ...base, vp: a.vp, why: `${score.rule}: ${a.why ?? score.why}` },
        }))
      : [
          {
            label: t("Score {vp} VP", { vp: score.vp }),
            as: by,
            lit: true,
            intent: { ...base, vp: score.vp, why },
          },
        ];
    buttons.push({ label: t("Not this time"), as: by, intent: { ...base, vp: 0, why, skipped: true } });
    return {
      tone: "job",
      seat: score.seat,
      rail,
      say: score.ask ? score.ask.question : t("Score {rule}: {vp} VP", { rule: score.rule, vp: score.vp }),
      sub: score.ask ? score.rule : score.why,
      buttons,
    };
  }

  const phase = currentSlot(game)?.name ?? "";
  const hint = phaseHint(game);

  // Both sides at once (40k's Command): each screen says Done for its own player.
  const together = simultaneousPhase(game);
  if (together) {
    const me = together.waiting.find((p) => isMine(p));
    const others = together.waiting
      .filter((p) => !isMine(p))
      .map((p) => displayName(game.players[p]?.name ?? ""));
    if (me)
      return {
        tone: "job",
        seat: game.players[me]?.seat ?? seat,
        rail,
        say:
          mine.length > 1
            ? t("{name}: {phase}, then Done", {
                name: displayName(game.players[me]?.name ?? ""),
                phase: gameText(phase),
              })
            : t("{phase}: your jobs, then Done", { phase: gameText(phase) }),
        sub: others.length
          ? t("{names} is doing theirs at the same time.", { names: formatList(others) })
          : hint,
        buttons: [{ label: t("Done"), lit: true, as: me, intent: { type: "turn/ready" } }],
      };
    const back = together.ready.find((p) => isMine(p));
    return {
      tone: "wait",
      seat,
      rail,
      say: others.length ? t("Waiting for {names}", { names: formatList(others) }) : t("Moving on…"),
      sub: t("You're done with {phase}.", { phase: gameText(phase) }),
      buttons: back
        ? [
            { label: t("Not done"), as: back, intent: { type: "turn/ready", ready: false } },
            ...(myTurn ? [{ label: t("Go on anyway"), intent: { type: "turn/next" } as Intent }] : []),
          ]
        : [],
    };
  }

  // Alternating units (Rift Lanterns, FSD, Conquest's activations): one unit's go, then the other side's.
  if (view.alternating) {
    if (!myTurn)
      return {
        tone: "wait",
        seat,
        say: t("{side}'s go", { side: who }),
        sub: t("Your next activation comes after theirs."),
        buttons: [],
      };
    const acting = actingUnits(game)[0];
    if (acting)
      return {
        tone: "job",
        seat,
        say: t("Your activation: {unit}", { unit: acting.name }),
        sub: hint ?? t("Use its actions from its card, then end the activation."),
        units: [{ id: acting.id, name: acting.name, done: false }],
        buttons: [
          { label: t("End activation"), lit: true, as: actor, intent: { type: "turn/endActivation" } },
        ],
      };
    const plain = plainActivations(game);
    const left = Object.values(game.units)
      .filter((u) => game.players[u.owner]?.seat === seat && alive(game, u))
      .map((u) => ({ id: u.id, name: u.name, done: plain ? !!u.status?.activated : false }));
    const next = left.find((u) => !u.done);
    if (!next)
      return {
        tone: "job",
        seat,
        say: t("All your units have had their go"),
        sub: t("Pass: the other side goes on until they pass too."),
        units: left,
        buttons: [{ label: t("Pass"), lit: true, as: actor, intent: { type: "turn/pass" } }],
      };
    return {
      tone: "job",
      seat,
      say: t("Pick a unit to activate"),
      sub:
        hint ??
        tn(left.filter((u) => !u.done).length, "{n} unit left this round", "{n} units left this round"),
      units: left,
      next: next.id,
      buttons: [
        {
          label: t("Pass"),
          as: actor,
          intent: { type: "turn/pass" },
          confirm: t("You have units that haven't gone. Pass anyway?"),
        },
      ],
    };
  }

  // Player turns, phase by phase.
  const last = !!rail && rail.current === rail.names.length - 1;
  const order = /fight/i.test(phase) ? fightOrder(game) : null;
  if (order) {
    const picker = order.picker;
    if (picker && !isMine(picker))
      return {
        tone: "wait",
        seat: game.players[picker]?.seat ?? seat,
        rail,
        say: t("{player}'s pick to fight", { player: displayName(game.players[picker]?.name ?? "") }),
        sub: t("The sides alternate until every engaged unit has fought."),
        buttons: [],
      };
    if (picker) {
      const units = order.eligible.map((id) => ({ id, name: game.units[id]?.name ?? id, done: false }));
      return {
        tone: "job",
        seat: game.players[picker]?.seat ?? seat,
        rail,
        say: t("Your pick: choose a unit to fight"),
        sub: t("Pile in, fight, then consolidate, from its card."),
        units,
        next: units[0]?.id,
        buttons: myTurn
          ? [
              {
                label: doneLabel(phase, last),
                as: actor,
                intent: { type: "turn/next" },
                confirm: t("Units can still fight. Move on anyway?"),
              },
            ]
          : [],
      };
    }
  }
  if (!myTurn)
    return {
      tone: "wait",
      seat,
      rail,
      say: t("{side}'s turn: {phase}", { side: who, phase: gameText(phase) }),
      sub: t("Watch the table. Your saves and reactions come to you here."),
      buttons: [],
    };

  // A fight phase with no one to pick has nobody engaged: nothing to do (UX N6).
  const fighting = /fight/i.test(phase);
  const units = fighting && order && !order.picker ? [] : phaseUnits(game, seat, phase);
  const left = units.filter((u) => !u.done);
  const moving = /move/i.test(phase);
  const done: StepButton = {
    label: doneLabel(phase, last),
    as: actor,
    intent: { type: "turn/next" },
    // Work left means the next unit is lit and Done asks first (standing still is a fine answer).
    lit: !left.length,
    confirm: left.length
      ? moving
        ? tn(left.length, "{n} unit hasn't moved. Done anyway?", "{n} units haven't moved. Done anyway?")
        : tn(
            left.length,
            "{n} unit can still act. Move on anyway?",
            "{n} units can still act. Move on anyway?",
          )
      : undefined,
  };
  const say = moving
    ? left.length
      ? t("Drag a unit to move it")
      : t("Every unit has moved")
    : /shoot/i.test(phase)
      ? left.length
        ? t("Pick a unit to shoot with, then click its target")
        : t("Every unit has shot")
      : /charge/i.test(phase)
        ? left.length
          ? t("Pick a unit to charge with, then drag it onto its target")
          : t("No unit can charge now")
        : fighting && !units.length
          ? t("No fights this turn")
          : left.length
            ? t("{phase}: pick a unit to act", { phase: gameText(phase) })
            : t("{phase}: nothing left to do", { phase: gameText(phase) });
  // A unit picked to move: drag it (UX N15). Its card's buttons (Advance and the like) are choices, not the step.
  const picked = selected ? game.units[selected] : undefined;
  if (moving && picked && isMine(picked.owner) && units.some((u) => u.id === picked.id && !u.done)) {
    const inches = moveAllowance(game, picked);
    return {
      tone: "job",
      seat,
      rail,
      say:
        inches !== null
          ? t("Drag {unit} · up to {n}″", { unit: picked.name, n: inches })
          : t("Drag {unit} to move it", { unit: picked.name }),
      sub: t("Or pick another unit. Advance and the rest are on its card."),
      units,
      buttons: [{ ...done, lit: false }],
    };
  }
  // A shot set up with its target (UX N21): declaring it is the step, lit in the bar from the panel.
  if (draft?.targetId && game.units[draft.attackerId] && game.units[draft.targetId])
    return {
      tone: "job",
      seat,
      rail,
      say: t("{a} at {b}: declare the attack", {
        a: game.units[draft.attackerId]!.name,
        b: game.units[draft.targetId]!.name,
      }),
      sub: t("Change the weapon or target in the card first if you like."),
      units: units.length ? units : undefined,
      buttons: [{ ...done, lit: false }],
    };
  // A shot set up with no target yet (UX N17): the target is the step.
  if (draft && !draft.targetId && game.units[draft.attackerId])
    return {
      tone: "job",
      seat,
      rail,
      say: t("Click {unit}'s target on the table", { unit: game.units[draft.attackerId]!.name }),
      sub: t("Or pick it in the card. Cancel there to choose another unit."),
      units: units.length ? units : undefined,
      buttons: [{ ...done, lit: false }],
    };
  return {
    tone: "job",
    seat,
    rail,
    say,
    sub: left.length
      ? moving
        ? tn(left.length, "{n} unit hasn't moved", "{n} units haven't moved")
        : tn(left.length, "{n} unit can still act", "{n} units can still act")
      : hint,
    units: units.length ? units : undefined,
    next: left[0]?.id,
    buttons: [done],
  };
}
