import type { GameRecord, GameState, Intent, PlayerId } from "../core";
import { nextWork, type NextWork } from "../core/content/nextWork";
import { currentSlot } from "../core/content/turn";
import type { Pending } from "../missions/scoring";
import { stepFor } from "../next/step";
import { legal } from "./bot";

/**
 * No dead ends (#84): at every state the soak passes through, on the host's
 * table, someone has a next step they can take, and the phase can always
 * end. "Next step" is ui-next's step bar (`stepFor`, src/next/step.ts),
 * computed for each seated player's screen and for one hotseat screen with
 * every player; "can take" is checked against the engine, on a copy:
 * a lit button whose intent the host would log, a lit unit, or a roll or
 * reaction the engine (`nextWork`) says is that screen's to make.
 *
 *  - (a) a dead end: every screen waits, or says "job" with nothing legal to press;
 *  - (b) a phase that can't end: with no roll or window open, the active side
 *    has no legal intent that ends it, or its screen offers none;
 *  - (c) the engine and the screen disagree: `nextWork` says a player has
 *    work (a roll, a reaction, a pick, Done) while their screen waits, or
 *    nobody has any work at all.
 *
 * Known step.ts dead ends are allowed by name (ALLOWED below), each pointing
 * at its proposed fix, so the soak stays green until the UI takes the fix.
 */

type Screen = { mine: PlayerId[]; step: ReturnType<typeof stepFor> };

interface DeadEnd {
  /** "noStep", "cantEnd", "endHidden", "unseenWork", "noWork". */
  rule: string;
  /** Which screen: a player's id, or "hotseat". */
  screen: string;
  say: string;
  why: string;
  /** The ALLOWED entry it falls under: a known step.ts dead end, not a failure. */
  allowed?: string;
}

interface Seen {
  state: GameState;
  screens: Screen[];
  works: Map<PlayerId, NextWork>;
}

/**
 * Known step.ts dead ends, waiting for the UI thread's fix (proposed in
 * w84-step.diff, see docs/next-work.md). Each names the finding it lets
 * through; the UI thread removes an entry when step.ts takes the fix.
 */
const ALLOWED: { id: string; why: string; allows: (d: DeadEnd, s: Seen) => boolean }[] = [];

const ENDS = new Set(["turn/next", "turn/ready", "turn/pass", "turn/endActivation"]);

const seated = (s: GameState): PlayerId[] =>
  Object.values(s.players)
    .filter((p) => p.seat !== undefined)
    .map((p) => p.id);

/** Whether the battle is under way (not setting up, not over). */
function inPlay(works: Map<PlayerId, NextWork>): boolean {
  const any = [...works.values()][0];
  return !!any && any.kind !== "over" && any.kind !== "setup";
}

/**
 * The dead ends in this state: none when every check passes. `step` is the
 * screen's step function (stepFor; a test passes a broken one).
 */
export function deadEnds(
  record: GameRecord,
  state: GameState,
  scores: Pending[],
  step: typeof stepFor = stepFor,
): DeadEnd[] {
  const players = seated(state);
  if (!players.length) return [];
  const works = new Map(players.map((p) => [p, nextWork(state, p, { scores })] as const));
  if (!inPlay(works)) return [];
  const screens: Screen[] = [
    ...players.map((p) => ({ mine: [p] })),
    ...(players.length > 1 ? [{ mine: players }] : []),
  ].map(({ mine }) => ({
    mine,
    step: step({ game: state, mine, pending: scores, selected: null, draft: null }),
  }));
  const seen: Seen = { state, screens, works };
  const out: DeadEnd[] = [];
  const name = (s: Screen) => (s.mine.length > 1 ? "hotseat" : s.mine[0]!);
  const can = (intent: Intent | undefined, as: PlayerId | undefined) =>
    !!intent && !!as && legal(record, state, { intent, as, kind: "check" });
  const blocking = [...works.values()].some((w) => w.blocking);
  const window = !!state.reaction;

  // (a) Some screen has a next step the engine lets its player take.
  const pressable = (s: Screen): boolean => {
    if (s.step.tone !== "job") return false;
    if (s.step.buttons.some((b) => b.lit && can(b.intent, b.as ?? s.mine[0]))) return true;
    if (s.step.next && s.mine.includes(state.units[s.step.next]?.owner ?? "")) return true;
    // A roll, answer or reaction the engine says is this screen's: it's made where the dice are.
    return s.mine.some((p) => {
      const w = works.get(p);
      return (
        !!w?.mine &&
        ["roll", "answer", "reaction", "question"].includes(w.kind) &&
        (w.intents.some((i) => can(i, p)) || w.kind === "question")
      );
    });
  };
  if (!screens.some(pressable)) {
    const first = screens.find((s) => s.step.tone === "job") ?? screens[0]!;
    out.push({
      rule: "noStep",
      screen: name(first),
      say: first.step.say,
      why:
        first.step.tone === "job"
          ? "every screen says wait, or job with nothing legal to press"
          : "every screen says wait",
    });
  }

  // (b) The phase can always end: with no roll, question or window open, the active side can end it.
  const slot = currentSlot(state);
  const scoring = scores.length > 0;
  if (slot && !blocking && !window && !scoring) {
    const active = players.filter((p) => state.players[p]?.seat === state.turn.activeSeat);
    const enders = active.filter((p) => {
      const w = works.get(p)!;
      return w.ends && can(w.ends, p);
    });
    if (!enders.length && !active.some((p) => can({ type: "turn/next" }, p)))
      out.push({
        rule: "cantEnd",
        screen: active.join(","),
        say: "",
        why: `no legal intent ends ${slot.id} for the active side`,
      });
    const offers = screens
      .filter((s) => s.mine.length === 1 && active.includes(s.mine[0]!))
      .some((s) =>
        s.step.buttons.some((b) => !!b.intent && ENDS.has(b.intent.type) && can(b.intent, b.as ?? s.mine[0])),
      );
    const own = screens.find((s) => s.mine.length === 1 && active.includes(s.mine[0]!));
    // A simultaneous phase another player still has to finish is ended by their Done: fine.
    if (!offers && own)
      out.push({
        rule: "endHidden",
        screen: name(own),
        say: own.step.say,
        why: `the active side's screen offers nothing that ends ${slot.id}`,
      });
  }

  // (c) The engine and the screens agree on who has work.
  const workers = players.filter((p) => works.get(p)!.mine);
  if (!workers.length)
    out.push({ rule: "noWork", screen: "-", say: "", why: "nextWork gives nobody any work" });
  for (const p of workers) {
    const w = works.get(p)!;
    const s = screens.find((x) => x.mine.length === 1 && x.mine[0] === p)!;
    if (s.step.tone !== "job")
      out.push({
        rule: "unseenWork",
        screen: p,
        say: s.step.say,
        why: `nextWork says ${w.kind} is ${p}'s, the screen says ${s.step.tone}`,
      });
  }
  for (const d of out) {
    const a = ALLOWED.find((x) => x.allows(d, seen));
    if (a) d.allowed = a.id;
  }
  return out;
}
