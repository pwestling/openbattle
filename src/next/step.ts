import { sideName, sidePlayers, type GameState, type Intent, type PlayerId, type Unit } from "../core";
import { findProcedure } from "../core/content/runner";
import { actingUnits } from "../core/content/play";
import { playerActions } from "../core/content/player";
import { simultaneousPhase } from "../core/content/simultaneous";
import { currentSlot, phaseHint, plainActivations, systemOf, turnView } from "../core/content/turn";
import { formatList, gameText, t, tn } from "../i18n";
import { displayName } from "../i18n/names";
import type { Pending } from "../missions/scoring";
import { chargeNeeded } from "../systems/wh40k/charge";
import { phaseUnits as workUnits, workOrder } from "../core/content/nextWork";
import { aliveModels, engagedWith, moveAllowance, unitMoved } from "../systems/wh40k/rules";

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
  /** Nothing in this phase for the player, not even a card to play: the bar moves on by itself (Jobs review). */
  empty?: boolean;
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

/** No card the players could play now that does something of its own (a re-roll waits for its roll). */
const nothingToPlay = (game: GameState, players: PlayerId[]) =>
  !players.some((p) =>
    playerActions(game, p).some(
      (o) =>
        o.ok &&
        !o.def.custom &&
        !!(o.def.target || o.def.do?.length || o.def.procedure || o.def.move || o.def.endsTurn),
    ),
  );

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
function phaseUnits(game: GameState, seat: number): StepUnit[] {
  // The engine's own list (#84): a unit with work left has an action it can take now (out of range
  // or out of charge reach doesn't count), and a unit done did the phase's work (moved, shot, rolled a charge).
  const { left, done } = workUnits(
    game,
    sidePlayers(game, seat).map((p) => p.id),
  );
  const named = (id: string, isDone: boolean) => ({ id, name: game.units[id]?.name ?? id, done: isDone });
  return [...left.map((id) => named(id, false)), ...done.map((id) => named(id, true))].sort(
    (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
  );
}

/** "{name} rolls hits" or "Your roll: hits": whose dice come next (UX N17). */
function rollLine(game: GameState, mine: PlayerId[], roller: PlayerId | undefined, stage: string): string {
  const p = roller ? game.players[roller] : undefined;
  if (!p) return "";
  return mine.includes(p.id)
    ? t("Your roll: {stage}", { stage })
    : t("{name} rolls {stage}", { name: displayName(p.name), stage });
}

/** A step's dice, said plainly: "hits", "wounds", "saves" (any other step by its own name). */
function stageName(id: string): string {
  return id === "hit" ? t("hits") : id === "wound" ? t("wounds") : id === "save" ? t("saves") : gameText(id);
}

/** An attack set up in the card: its target is the step (UX N17), then declaring it (UX N21), lit from the panel. */
function draftSay(game: GameState, draft: StepInput["draft"]): { say: string; sub: string } | null {
  const attacker = draft ? game.units[draft.attackerId] : undefined;
  if (!draft || !attacker) return null;
  const target = draft.targetId ? game.units[draft.targetId] : undefined;
  if (target)
    return {
      say: t("{a} at {b}: declare the attack", { a: attacker.name, b: target.name }),
      sub: t("Change the weapon or target in the card first if you like."),
    };
  return {
    say: t("Click {unit}'s target on the table", { unit: attacker.name }),
    sub: t("Or pick it in the card. Cancel there to choose another unit."),
  };
}

/** A charge of this side's moved further than its roll, if any. */
function overCharge(
  game: GameState,
  units: StepUnit[],
  isMine: (p: PlayerId) => boolean,
): { id: string; unit: string; n: number; moved: string } | null {
  for (const { id } of units) {
    const u = game.units[id];
    const roll = u?.status?.charge;
    if (!u || !isMine(u.owner) || typeof roll !== "number") continue;
    const moved = unitMoved(aliveModels(game, u));
    if (moved > roll + 0.05) return { id, unit: u.name, n: roll, moved: moved.toFixed(1) };
  }
  return null;
}

/** The charge this side just rolled and made, while its unit isn't yet in contact with what it charged. */
function madeCharge(
  game: GameState,
  units: StepUnit[],
  isMine: (p: PlayerId) => boolean,
): { n: number; unit: string; targets: string } | null {
  for (const { id } of units) {
    const u = game.units[id];
    const roll = u?.status?.charge;
    if (!u || !isMine(u.owner) || typeof roll !== "number") continue;
    const declared = Object.keys(u.status ?? {})
      .filter((k) => k.startsWith("chargeAt.") && u.status![k])
      .map((k) => k.slice("chargeAt.".length));
    if (!declared.length || roll < chargeNeeded(game, u.id, declared)) continue;
    const touching = engagedWith(game, u);
    if (declared.some((d) => touching.includes(d))) continue;
    return { n: roll, unit: u.name, targets: formatList(declared.map((d) => game.units[d]?.name ?? "?")) };
  }
  return null;
}

/** An attack or procedure under way, said as who is rolling now (UX N17, N26), and whether it's this screen's roll. */
function attackSay(
  game: GameState,
  mine: PlayerId[],
): { say: string; sub: string; mineRoll: boolean; close?: StepButton } {
  const proc = game.procedure;
  if (proc) {
    const actor = game.units[proc.unitId];
    const target = proc.targetId ? game.units[proc.targetId] : undefined;
    const say = target
      ? /fight/i.test(proc.action)
        ? t("{a} fights {b}", { a: actor?.name ?? "", b: target.name })
        : t("{a} attacks {b}", { a: actor?.name ?? "", b: target.name })
      : proc.title;
    const run = proc.run;
    // Finished: closing it is the step, for whoever started it (as the panel's Done).
    if (run.done)
      return {
        say,
        sub: t("Done."),
        mineRoll: mine.includes(proc.by),
        ...(mine.includes(proc.by)
          ? {
              close: {
                label: t("Done"),
                lit: true,
                as: proc.by,
                intent: { type: "procedure/clear" } as Intent,
              },
            }
          : {}),
      };
    if (run.pending) {
      const answers = target?.owner;
      return {
        say,
        sub:
          answers && mine.includes(answers)
            ? t("Your answer, where the dice are.")
            : t("Waiting for an answer."),
        mineRoll: !!answers && mine.includes(answers),
      };
    }
    let next: { id: string; kind: string; roller?: string } | undefined;
    try {
      next = findProcedure(systemOf(game), run.procedure).steps[run.next];
    } catch {
      next = undefined;
    }
    // Rolls go through the attacker; a defender's test (saves) is the defender's (as the procedure panel rolls it).
    const roller = next?.kind === "test" && next.roller === "defender" ? target?.owner : proc.by;
    return {
      say,
      sub: next ? rollLine(game, mine, roller, stageName(next.id)) : "",
      mineRoll: !!roller && mine.includes(roller),
    };
  }
  const a = game.attack;
  if (!a) return { say: t("A roll is under way"), sub: t("Roll where the dice are."), mineRoll: false };
  const attacker = game.units[a.spec.attackerUnitId];
  const target = game.units[a.spec.targetUnitId];
  const say = t("{a} attacks {b}", { a: attacker?.name ?? "", b: target?.name ?? "" });
  const rollerUnit = a.stage === "save" ? target : attacker;
  const roller = rollerUnit ? game.players[rollerUnit.owner] : undefined;
  if (!roller) return { say, sub: "", mineRoll: false };
  const mineRoll = mine.includes(roller.id);
  if (a.stage === "done") {
    const by = attacker?.owner;
    return {
      say,
      sub: t("Done."),
      mineRoll: !!by && mine.includes(by),
      ...(by && mine.includes(by)
        ? { close: { label: t("Done"), lit: true, as: by, intent: { type: "attack/clear" } as Intent } }
        : {}),
    };
  }
  // Damage is worked out from the dice already rolled: nobody's press (UX N22), unless it rolls dice of its own.
  if (a.stage === "damage") return { say, sub: t("Then the damage, where the dice are."), mineRoll };
  return { say, sub: rollLine(game, mine, roller.id, stageName(a.stage)), mineRoll };
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
  if (game.attack || game.procedure) {
    const { say, sub, mineRoll, close } = attackSay(game, mine);
    // Your saves in their turn are yours to press: the bar offers the roll (UX N26).
    return { tone: myTurn || mineRoll ? "job" : "wait", seat, rail, say, sub, buttons: close ? [close] : [] };
  }
  // A rule's question (The Old World's charge reaction, a Brinewatch guard): its player answers here (#84).
  const asked = game.script?.waiting;
  if (asked) {
    const by = game.players[asked.player];
    if (isMine(asked.player)) {
      const plain = asked.secret === undefined && asked.reveal === undefined;
      return {
        tone: "job",
        seat: by?.seat ?? seat,
        rail,
        say: gameText(asked.question),
        sub: plain ? t("Pick your answer.") : t("Answer on the card by the dice."),
        buttons: plain
          ? asked.options.map((o) => ({
              label: gameText(o.label),
              as: asked.player,
              intent: { type: "script/answer", answer: o.id } as Intent,
            }))
          : [],
      };
    }
    return {
      tone: "wait",
      seat: by?.seat ?? seat,
      rail,
      say: t("Waiting for {name}", { name: displayName(by?.name ?? "") }),
      sub: gameText(asked.question),
      buttons: [],
    };
  }
  // A held action (FSD): the reacting side answers it, with a unit's reaction from its card or Pass (#84).
  if (game.pending) {
    const reactor = sidePlayers(game, game.pending.seat).find((p) => isMine(p.id));
    return {
      tone: reactor ? "job" : "wait",
      seat: game.pending.seat,
      rail,
      say: reactor ? t("Your reaction") : t("A reaction"),
      sub: reactor
        ? t("React with a unit from its card, or pass.")
        : t("Answer on the reaction card by the dice."),
      buttons: reactor
        ? [{ label: t("Pass"), lit: true, as: reactor.id, intent: { type: "reaction/pass" } }]
        : [],
    };
  }
  // An engine reaction window (#80) never blocks, but it is the reacting side's to answer (#84).
  // Its card by the dice holds the gold (a re-roll offered on your failed dice); Pass here is plain.
  const open = game.reaction;
  const reacting = open ? sidePlayers(game, open.seat).find((p) => isMine(p.id)) : undefined;
  if (open && reacting)
    return {
      tone: "job",
      seat: open.seat,
      rail,
      say: t("You may react"),
      sub: t("Play a reaction from the card by the dice, or pass."),
      buttons: [{ label: t("Pass"), as: reacting.id, intent: { type: "reaction/pass" } }],
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
            : t("{phase}: Done when you're ready", { phase: gameText(phase) }),
        // No "To use: …" list of abilities here (naive players 2): they're under Stratagems and abilities.
        sub: others.length
          ? t("{names} is doing theirs at the same time.", { names: formatList(others) })
          : hint,
        buttons: [{ label: t("Done"), lit: true, as: me, intent: { type: "turn/ready" } }],
        empty: nothingToPlay(game, [me]),
      };
    const back = together.ready.find((p) => isMine(p));
    // A watcher gets commentary, not a player's line (UX 527): the bar's recap tells what happened.
    if (!mine.length)
      return {
        tone: "wait",
        seat,
        rail,
        say: t("{side}'s turn: {phase}", { side: who, phase: gameText(phase) }),
        sub: others.length ? t("Waiting for {names}", { names: formatList(others) }) : "",
        buttons: [],
      };
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
        },
      ],
    };
  }

  // Player turns, phase by phase.
  const last = !!rail && rail.current === rail.names.length - 1;
  // The system's own order of picks (40k's fight order), from the engine (#84).
  const order = workOrder(game);
  if (order) {
    const picker = order.picker;
    if (picker && !isMine(picker))
      return {
        tone: "wait",
        seat: game.players[picker]?.seat ?? seat,
        rail,
        say: t("{player}'s pick to fight", { player: displayName(game.players[picker]?.name ?? "") }),
        sub: t("The sides alternate until every engaged unit has fought."),
        // Never a dead end in your own turn (UX N28): an opponent who doesn't pick can't hold it up.
        buttons: myTurn
          ? [
              {
                label: doneLabel(phase, last),
                as: actor,
                intent: { type: "turn/next" },
              },
            ]
          : [],
      };
    if (picker) {
      const units = order.eligible.map((id) => ({ id, name: game.units[id]?.name ?? id, done: false }));
      // A fight set up from the card (UX N26): its target, then declaring it, as with a shot.
      const drafted = draftSay(game, draft);
      if (drafted)
        return {
          tone: "job",
          seat: game.players[picker]?.seat ?? seat,
          rail,
          ...drafted,
          units,
          buttons: [],
        };
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
      sub: mine.length ? t("Watch the table. Your saves and reactions come to you here.") : "",
      buttons: [],
    };

  // A fight phase with no one to pick has nobody engaged: nothing to do (UX N6).
  const fighting = /fight/i.test(phase);
  const units = fighting && order && !order.picker ? [] : phaseUnits(game, seat);
  const left = units.filter((u) => !u.done);
  const moving = /move/i.test(phase);
  const done: StepButton = {
    label: doneLabel(phase, last),
    as: actor,
    intent: { type: "turn/next" },
    // Work left means the next unit is lit, not Done; Done still ends the phase, with no question
    // (naive players 10): the lit unit says what's left, and Undo covers a slip.
    lit: !left.length,
  };
  // The one gesture for the lit unit (naive players 5): drag it, or tap an enemy for it.
  const lit = left[0]?.name ?? "";
  const say = moving
    ? left.length
      ? t("Drag {unit}'s base to move it", { unit: lit })
      : t("Every unit has moved")
    : /shoot/i.test(phase)
      ? left.length
        ? t("Tap an enemy for {unit} to shoot", { unit: lit })
        : t("Every unit has shot")
      : /charge/i.test(phase)
        ? left.length
          ? t("Tap an enemy for {unit} to charge", { unit: lit })
          : t("No unit can charge now")
        : fighting && !left.length
          ? t("Fights over")
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
  // A charge moved further than its roll (UX N34): the bar says so as a warning, and Undo takes it
  // back (naive players 5: "Snap back" read as an instruction). The rules are advisory: Done goes on.
  const over = /charge/i.test(phase) ? overCharge(game, units, isMine) : null;
  if (over)
    return {
      tone: "job",
      seat,
      rail,
      say: t("{unit} moved {moved}″ of its {n}″ charge roll", over),
      sub: t("Undo takes the move back. Done charges anyway."),
      units,
      buttons: [{ ...done, lit: true }],
    };
  // A charge rolled and made (UX N24): moving in is the step, by hand on the table; nothing to press.
  const charging = /charge/i.test(phase) ? madeCharge(game, units, isMine) : null;
  if (charging)
    return {
      tone: "job",
      seat,
      rail,
      say: t("Charge roll {n}″: drag {unit} into contact with {targets}", charging),
      sub: t("Then pick the next unit, or move on."),
      units,
      buttons: [{ ...done, lit: false }],
    };
  const drafted = draftSay(game, draft);
  if (drafted)
    return {
      tone: "job",
      seat,
      rail,
      ...drafted,
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
    // A phase nobody could act in (not one whose work is all done): fights already fought keep their order.
    empty:
      !units.length &&
      !(fighting && order) &&
      nothingToPlay(
        game,
        sidePlayers(game, seat).map((p) => p.id),
      ),
  };
}
