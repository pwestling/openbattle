import { useEffect, useRef, useState } from "react";
import { delaying } from "../broadcast/broadcast";
import { useReel } from "../broadcast/reel";
import { sideName, sidePlayers, sides, type GameState } from "../core";
import { owed, quiet, useShowcase } from "../render/showcase";
import { touch } from "./touch";
import { t } from "../i18n";
import { useStore } from "../store";
import { useGame } from "./hooks";
import { drum, horn } from "./sound";

/**
 * The army showcase (PX-5a): when the battle starts, a title card for each
 * army over the still table, then "Round 1". About three seconds, once per
 * game, on every screen. The camera never moves and the panels stay up
 * (Porter: no movement that gets in the way); any click or Esc ends it early,
 * and the click still does what it was for.
 */

const STILL_MS = 1000;
const ROUND_MS = 1000;

interface Card {
  title: string;
  line: string;
  color: string;
}

/** Each side's army: its name, points and players. */
function armies(game: GameState) {
  return sides(game).flatMap((seat) => {
    const players = sidePlayers(game, seat);
    const ids = new Set(players.map((p) => p.id));
    const units = Object.values(game.units).filter((u) => ids.has(u.owner));
    const models = units.flatMap((u) => u.modelIds.flatMap((id) => game.models[id] ?? []));
    const standing = models.filter((m) => !m.destroyed);
    if (!standing.length) return [];
    const names = units.map((u) => u.army).filter((n): n is string => !!n);
    const army = names.sort(
      (a, b) => names.filter((n) => n === b).length - names.filter((n) => n === a).length,
    )[0];
    const points = units.reduce((a, u) => a + (u.sheet?.points ?? 0), 0);
    const card: Card = {
      title: army ?? t("{side}'s army", { side: sideName(game, seat) }),
      line: [points ? t("{points} pts", { points }) : "", sideName(game, seat)].filter(Boolean).join(" · "),
      color: players[0]?.color ?? "#e5e7eb",
    };
    return [{ card }];
  });
}

/** Showcases already played, by game (a new game or a branch gets its own). */
const played = new WeakSet<object>();

export function Showcase() {
  const turn = useGame().turn;
  const scrub = useStore((s) => s.scrub);
  const initial = useStore((s) => s.record.initial);
  const [card, setCard] = useState<Card | null>(null);
  const [round, setRound] = useState(false);
  const last = useRef<number | null>(null);
  const seen = useRef<object | null>(null);
  const token = useRef(0);

  const stop = () => {
    token.current++;
    setCard(null);
    setRound(false);
    if (!useShowcase.getState().on) return;
    useShowcase.setState({ on: false });
    document.body.classList.remove("showcase");
  };

  useEffect(() => {
    // Mounted just after the battle began (the one-click demo starts it before the table has loaded): as if from 0.
    // A game arriving whole (joining, or rejoining mid-game) isn't the battle starting here (UX 245).
    const arrived = seen.current !== initial;
    seen.current = initial;
    const was = (arrived ? null : last.current) ?? (owed.initial === initial && turn.round === 1 ? 0 : null);
    if (owed.initial === initial) owed.initial = null;
    last.current = turn.round;
    // The battle starting on this screen: live, behind the delay, or a replay playing through it.
    if (was !== 0 || turn.round < 1 || played.has(initial) || useReel.getState().index !== null) return;
    // Not for a review room: it goes over a game, it isn't one starting (UX 233).
    if (useStore.getState().review) return;
    // Nor for a workshop test table, restarted over and over (UX 311).
    if (quiet.initial === initial) return;
    if (scrub !== null && !delaying() && !useStore.getState().record.events.length) return;
    played.add(initial);
    const s = useStore.getState();
    const sidesNow = armies(s.game);
    if (!sidesNow.length) return;
    const my = ++token.current;
    const later = (ms: number, f: () => void) =>
      setTimeout(() => {
        if (my === token.current) f();
      }, ms);
    document.body.classList.add("showcase");
    useShowcase.setState({ on: true });
    let at = 0;
    for (const side of sidesNow) {
      later(at, () => {
        drum();
        setCard(side.card);
      });
      at += STILL_MS;
    }
    later(at, () => {
      setCard(null);
      setRound(true);
      horn();
    });
    later(at + ROUND_MS, stop);
  }, [turn.round, scrub, initial]);

  // Anyone can end it early: a click or Esc, on this screen only. The click still goes on to what it was for.
  const showing = useShowcase((s) => s.on);
  const on = card !== null || round || showing;
  useEffect(() => {
    if (!on) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && stop();
    const tap = () => stop();
    addEventListener("keydown", key);
    addEventListener("pointerdown", tap, { capture: true });
    return () => {
      removeEventListener("keydown", key);
      removeEventListener("pointerdown", tap, { capture: true });
    };
  }, [on]);

  // Unmounted mid-showcase (development's double mount does this): it's still owed when the table comes back.
  const shown = useRef(initial);
  useEffect(() => {
    shown.current = initial;
  }, [initial]);
  useEffect(
    () => () => {
      if (useShowcase.getState().on) {
        played.delete(shown.current);
        owed.initial = shown.current;
        last.current = null;
      }
      stop();
    },
    [],
  );

  if (round)
    return (
      <div className="showcase-round" role="status">
        {t("Round {round}", { round: 1 })}
      </div>
    );
  if (!card) return null;
  return (
    <div className="showcase-card" style={{ borderColor: card.color }} role="status" key={card.title}>
      <div className="title" style={{ color: card.color }}>
        {card.title}
      </div>
      <div className="line">{card.line}</div>
      <div className="skip">{touch() ? t("Tap to skip") : t("Click or Esc to skip")}</div>
    </div>
  );
}
