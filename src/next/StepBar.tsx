import { useEffect, useMemo, useState } from "react";
import { soloPlays } from "../bot/solo";
import { aliveModels, sidePlayers } from "../core";
import { gameText, t } from "../i18n";
import { pendingScores } from "../missions/scoring";
import { focusOn } from "../render/focus";
import { useSandbox } from "../sandbox/runtime";
import { useCanControl, useJoining, useStore } from "../store";
import { UndoButton } from "../ui/Hud";
import { useGame } from "../ui/hooks";
import { missionOf } from "../ui/Missions";
import { stepFor, type StepButton } from "./step";

/** Select a unit and bring it into view. */
export function pickUnit(id: string): void {
  const s = useStore.getState();
  const unit = s.game.units[id];
  if (!unit) return;
  s.select(id);
  const models = aliveModels(s.game, unit);
  if (models.length)
    focusOn(
      models.reduce((a, m) => a + m.position.x, 0) / models.length,
      models.reduce((a, m) => a + m.position.y, 0) / models.length,
    );
}

/**
 * The attack's or charge's own next button (a roll, or Declare attack once a
 * target is set), watched so the bar can offer the same press where the gold
 * always is. Interim, until the attack flow lives in the bar.
 */
function useSheetPrimary(): { el: HTMLButtonElement; label: string } | null {
  const [seen, setSeen] = useState<{ el: HTMLButtonElement; label: string } | null>(null);
  useEffect(() => {
    const find = () => {
      // The phase's own verb on the unit card counts too (Shoot, Charge, Fight); its other buttons
      // (Advance, Fall back) are choices, not the step (UX N15).
      const b =
        document.querySelector<HTMLButtonElement>(
          ":is(.obn-sheet-wrap .panel.attack, .obn-sheet-wrap .charge-declare) button.primary:not(:disabled)",
        ) ??
        [
          ...document.querySelectorAll<HTMLButtonElement>(
            ".obn-sheet-wrap .unitcard button.primary:not(:disabled)",
          ),
        ].find((x) => /^(shoot|charge|fight)\b/i.test(x.textContent?.trim() ?? "")) ??
        null;
      const label = b?.textContent?.trim() ?? "";
      setSeen((old) => (old?.el === b && old?.label === label ? old : b ? { el: b, label } : null));
    };
    find();
    const watch = new MutationObserver(find);
    watch.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["disabled"],
    });
    return () => watch.disconnect();
  }, []);
  return seen;
}

/** Whether the classic phase panel is folded on the page (its chip is hidden in ui-next: the bar opens it). */
function usePlayChip(): HTMLButtonElement | null {
  const [el, setEl] = useState<HTMLButtonElement | null>(null);
  useEffect(() => {
    const find = () => setEl(document.querySelector<HTMLButtonElement>(".panel.play.collapsed button"));
    find();
    const watch = new MutationObserver(find);
    watch.observe(document.body, { childList: true, subtree: true });
    return () => watch.disconnect();
  }, []);
  return el;
}

/** The players this screen plays: both sides on one screen (less the computer's), else this browser's own. */
function useMine(): string[] {
  const game = useStore((s) => s.game);
  const canControl = useCanControl();
  const role = useStore((s) => s.role);
  const joining = useJoining();
  if (role === "spectator" || joining) return [];
  return Object.values(game.players)
    .filter((p) => p.seat !== undefined && canControl(p.id) && !soloPlays(game, p.id))
    .map((p) => p.id);
}

/**
 * The step bar (ui-next): the phase rail, one sentence on what to do now,
 * the units left, and the one lit thing to press. When it's someone else's
 * go it says what they're doing, in their colour, and lights nothing.
 */
export function StepBar() {
  const game = useGame();
  const record = useStore((s) => s.record);
  const scrub = useStore((s) => s.scrub);
  const dispatch = useStore((s) => s.dispatch);
  const selected = useStore((s) => s.selected);
  const mine = useMine();
  const answers = useSandbox((s) => s.app);
  const mission = missionOf(game);
  const pending = useMemo(
    () => (scrub === null ? pendingScores(record, game, mission) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [record, game, mission, scrub, answers],
  );
  // The computer confirms its own scores, as the classic score panel did for it.
  useEffect(() => {
    for (const p of pending) {
      const bot = sidePlayers(game, p.seat).find((x) => soloPlays(game, x.id));
      if (!bot || p.ask) continue;
      dispatch(
        {
          type: "score/confirm",
          key: p.key,
          seat: p.seat,
          round: p.round,
          vp: p.guessed ? p.vp : 0,
          why: `${p.rule}: ${p.why}`,
          ...(p.guessed ? {} : { skipped: true }),
        },
        bot.id,
      );
    }
  }, [pending, game, dispatch]);
  const draft = useStore((s) => s.draft);
  const step = stepFor({ game, mine, pending, selected, draft });
  const mirror = useSheetPrimary();
  const playChip = usePlayChip();
  const [asking, setAsking] = useState<StepButton | null>(null);
  // A question asked about one moment doesn't carry over to the next.
  const key = `${game.turn.round}/${game.turn.phase}/${game.turn.activeSeat}`;
  const [askedAt, setAskedAt] = useState(key);
  if (askedAt !== key) {
    setAskedAt(key);
    setAsking(null);
  }
  if (step.tone === "over" || step.tone === "setup" || scrub !== null) return null;
  const color = sidePlayers(game, step.seat)[0]?.color;
  const press = (b: StepButton) => {
    if (b.confirm && asking !== b) return setAsking(b);
    setAsking(null);
    if (b.intent) dispatch(b.intent, b.as);
  };
  // With the next unit picked, its card holds the lit step: the bar repeats it, so the gold stays here (UX N7).
  const own = step.next ? step.next !== selected : step.buttons.some((b) => b.lit);
  const echo = !own && step.tone === "job" && mirror ? mirror : null;
  const lit = own || !!echo;
  return (
    <section
      className={`obn-bar ${step.tone}`}
      style={{ ["--side" as string]: color }}
      aria-label={t("Next step")}
      data-lit={lit ? "bar" : "none"}
    >
      {step.rail && (
        <ol className="obn-rail" aria-label={t("Phases")}>
          {step.rail.names.map((n, i) => (
            <li
              key={`${n}${i}`}
              className={i < step.rail!.current ? "done" : i === step.rail!.current ? "on" : ""}
              aria-current={i === step.rail!.current ? "step" : undefined}
            >
              {gameText(n)}
            </li>
          ))}
        </ol>
      )}
      <div className="obn-bar-row">
        <div className="obn-say" role="status" aria-live="polite">
          <strong>{step.say}</strong>
          {(step.sub || (playChip && step.tone === "job")) && (
            <span>
              {step.sub}
              {playChip && step.tone === "job" && (
                <>
                  {" "}
                  <button className="obn-link small" onClick={() => playChip.click()}>
                    {t("Stratagems and abilities ▸")}
                  </button>
                </>
              )}
            </span>
          )}
          {/* One unit left shows too: its chip is the lit step (UX N25). */}
          {step.units && (step.units.length > 1 || !!step.next) && (
            <div className="obn-left" aria-label={t("Units")}>
              {step.units.map((u) => (
                <button
                  key={u.id}
                  className={`obn-unit${u.done ? " done" : ""}${u.id === step.next && u.id !== selected ? " obn-lit" : ""}${u.id === selected ? " picked" : ""}`}
                  // Picked where the camera is: the table stays in view (UX N18).
                  onClick={() => useStore.getState().select(u.id)}
                >
                  {u.name}
                </button>
              ))}
            </div>
          )}
        </div>
        {asking ? (
          <div className="obn-ask" role="alert">
            <span>{asking.confirm}</span>
            <button
              className="obn-plain"
              onClick={() => {
                setAsking(null);
                if (asking.intent) dispatch(asking.intent, asking.as);
              }}
            >
              {t("{label} anyway", { label: asking.label })}
            </button>
            <button className="obn-quiet" onClick={() => setAsking(null)}>
              {t("Not yet")}
            </button>
          </div>
        ) : (
          <div className="obn-buttons">
            {step.tone === "job" && <UndoButton />}
            {echo && (
              <button className="obn-lit" onClick={() => echo.el.click()}>
                {echo.label} ▸
              </button>
            )}
            {step.buttons.map((b) => (
              <button
                key={b.label}
                className={b.lit && !step.next ? "obn-lit" : "obn-plain"}
                onClick={() => press(b)}
              >
                {b.label}
                {b.lit && !step.next ? " ▸" : ""}
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
