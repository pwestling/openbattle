import { useEffect, useMemo, useState } from "react";
import { soloPlays, useSolo } from "../bot/solo";
import { aliveModels, rollerSeat, sidePlayers, type Intent } from "../core";
import { gameText, t } from "../i18n";
import { displayName } from "../i18n/names";
import { pendingScores } from "../missions/scoring";
import { focusOn } from "../render/focus";
import { useSandbox } from "../sandbox/runtime";
import { useCanControl, useJoining, useStore } from "../store";
import { UndoButton } from "../ui/Hud";
import { useGame } from "../ui/hooks";
import { missionOf } from "../ui/Missions";
import { workOrder } from "../core/content/nextWork";
import { useCoach } from "../teach/store";
import { setPlanning, usePlan } from "../ui/plan";
import { useLit } from "./lit";
import { recapLine } from "./recap";
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
  const mineKey = mine.join("\n");
  const recap = useMemo(
    () => recapLine(record, game, mineKey ? mineKey.split("\n") : []),
    [record, game, mineKey],
  );
  const stuck = useStuckFinish();
  const step = stepFor({ game, mine, pending, selected, draft });
  const mirror = useSheetPrimary();
  // An empty phase moves on by itself after a beat, so the rail ticks past it (Jobs review). Not straight
  // after an Undo, which would only step forward again, nor in a lesson, which walks every phase, nor
  // online, where a peer still loading the game's rules would disagree with the step.
  const online = useStore((s) => !!s.roomId && s.mode !== "hotseat");
  const skip = step.tone === "job" && step.empty ? step.buttons.find((b) => b.lit && b.intent) : undefined;
  const skipKey =
    skip &&
    !online &&
    !draft &&
    !game.attack &&
    !game.procedure &&
    !game.reaction &&
    !game.pending &&
    record.events.at(-1)?.event.type !== "undo" &&
    useCoach.getState().lesson === null
      ? `${record.events.length}`
      : null;
  useEffect(() => {
    if (!skipKey || !skip?.intent) return;
    const { intent, as } = skip;
    const timer = window.setTimeout(() => dispatch(intent, as), SKIP_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skipKey]);
  // Planning your next turn on the other side's (#81): the bar's quiet choice while you wait.
  const planning = usePlan((s) => s.on);
  const self = useStore((s) => (s.mode === "hotseat" ? null : (s.session?.selfId ?? null)));
  const selfSeat = self && mine.includes(self) ? game.players[self]?.seat : undefined;
  const canPlan =
    step.tone === "wait" &&
    selfSeat !== undefined &&
    game.turn.round >= 1 &&
    game.turn.activeSeat !== selfSeat;
  const litNext = step.tone === "job" ? (step.next ?? null) : null;
  useEffect(() => {
    useLit.setState({ unitId: litNext });
    return () => useLit.setState({ unitId: null });
  }, [litNext]);
  if (step.tone === "over" || step.tone === "setup" || scrub !== null) return null;
  const color = sidePlayers(game, step.seat)[0]?.color;
  const press = (b: StepButton) => {
    if (b.intent) dispatch(b.intent, b.as);
  };
  // With the next unit picked, its card holds the lit step: the bar repeats it, so the gold stays here (UX N7).
  // The computer waits for your pick in its own fight order (UX N29); this lets it fight on.
  const order = step.tone === "job" ? workOrder(game) : null;
  const bot = sidePlayers(game, game.turn.activeSeat).find((p) => soloPlays(game, p.id));
  const letGo = !!bot && !!order?.picker && mine.includes(order.picker) && !game.attack && !game.procedure;
  const own = step.next ? step.next !== selected : step.buttons.some((b) => b.lit);
  // While dice are rolling, only this screen's own roll is echoed: never a declare button (Fight,
  // Shoot) during the computer's or the other player's attack (UX N41).
  const rolling = !!(game.attack || game.procedure);
  const rollsHere =
    !rolling ||
    (sidePlayers(game, rollerSeat(game) ?? -1).some((p) => mine.includes(p.id)) &&
      !!mirror?.el.closest(".panel.attack"));
  const echo = !own && step.tone === "job" && mirror && rollsHere ? mirror : null;
  // When the dice are this screen's to roll, the instruction keeps the sub line and the recap waits (UX 531).
  const myRoll = rolling && sidePlayers(game, rollerSeat(game) ?? -1).some((p) => mine.includes(p.id));
  const lit = own || !!echo;
  return (
    <section
      className={`obn-bar ${step.tone}${step.buttons.some((b) => b.intent?.type === "score/confirm") ? " scoring" : ""}`}
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
          {/* What just happened takes the sub line's place, so the bar keeps one height (Jobs review). */}
          {canPlan && planning ? (
            <span>
              {t("Drag your models to plan moves; pick a unit, then click an enemy to plan its shots.")}
            </span>
          ) : recap && !myRoll ? (
            <span className="obn-recap">{recap}</span>
          ) : (
            step.sub && <span>{step.sub}</span>
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
        <div className="obn-buttons">
          {step.tone === "job" && <UndoButton />}
          {letGo && (
            <button
              className="obn-plain"
              onClick={() => useSolo.setState({ letGo: useStore.getState().record.events.length })}
            >
              {t("Let {name} fight on", { name: displayName(bot!.name) })}
            </button>
          )}
          {canPlan && (
            <button className="obn-plain" aria-pressed={planning} onClick={() => setPlanning(!planning)}>
              {planning ? t("Done planning") : t("Plan my turn")}
            </button>
          )}
          {stuck && (
            <button className="obn-plain" onClick={() => dispatch(stuck.intent, stuck.as)}>
              {t("Go on")} ▸
            </button>
          )}
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
      </div>
    </section>
  );
}

/** How long an empty phase shows before the bar moves past it. */
const SKIP_MS = 1000;

/**
 * The computer's finished attack still on the table a few seconds on: a backstop so the game can
 * never sit at "Done." with nothing to press (UX N40b). The computer normally clears it itself.
 */
function useStuckFinish(): { intent: Intent; as: string } | null {
  const game = useGame();
  const events = useStore((s) => s.record.events.length);
  const proc = game.procedure;
  const attack = game.attack;
  const by = proc?.run.done
    ? proc.by
    : attack?.stage === "done"
      ? game.units[attack.spec.attackerUnitId]?.owner
      : undefined;
  const finished = by && soloPlays(game, by) ? by : null;
  const [late, setLate] = useState<number | null>(null);
  useEffect(() => {
    if (!finished) return;
    const timer = window.setTimeout(() => setLate(events), 3000);
    return () => window.clearTimeout(timer);
  }, [finished, events]);
  if (!finished || late !== events) return null;
  return { intent: { type: proc ? "procedure/clear" : "attack/clear" }, as: finished };
}
