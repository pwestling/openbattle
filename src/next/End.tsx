import { useMemo } from "react";
import { create } from "zustand";
import { reelLength, startReel } from "../broadcast/Moments";
import { useReel } from "../broadcast/reel";
import { t, tn } from "../i18n";
import { pendingScores } from "../missions/scoring";
import { NET_PARAMS } from "../net/config";
import { bothSigned, RankedSign } from "../ranked/RankedGame";
import { reviewThisGame } from "../replay/review";
import { useSandbox } from "../sandbox/runtime";
import { openShare } from "../share/store";
import { useStore } from "../store";
import { useGame } from "../ui/hooks";
import { missionOf, Result } from "../ui/Missions";
import { battleOver } from "../ui/StatsScreen";
import { VIEWER } from "../viewer/flag";

/** Whether the player asked for the battle stats from the end card: only then does the classic stats screen open. */
export const useEndStats = create<{ asked: boolean }>(() => ({ asked: false }));

/** Out to the front door, keeping the relay settings (the door remembers the game and who against). */
function toDoor(): void {
  const here = new URLSearchParams(location.search);
  const q = new URLSearchParams();
  for (const k of NET_PARAMS) if (here.get(k)) q.set(k, here.get(k)!);
  location.assign(q.size ? `${location.pathname}?${q}` : location.pathname);
}

/**
 * The end of the battle (ui-next): the result first, then what to do next.
 * Scores still to confirm, or a ranked result to sign, are the lit step;
 * after that, Play again. Highlights, stats with the coach's review, notes
 * and sharing are plain choices. Odds and luck stay in the stats.
 */
export function NextEnd() {
  const game = useGame();
  const record = useStore((s) => s.record);
  const scrub = useStore((s) => s.scrub);
  const stats = useStore((s) => s.stats);
  const session = useStore((s) => s.session);
  const watching = useStore((s) => VIEWER || (!!s.session && !s.review && s.role === "spectator"));
  const reeling = useReel((s) => s.index !== null);
  const asked = useEndStats((s) => s.asked);
  const answers = useSandbox((s) => s.app);
  const mission = missionOf(game);
  const over = battleOver(game) && scrub === null;
  const pending = useMemo(
    () => (over ? pendingScores(record, game, mission) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [over, record, game, mission, answers],
  );
  const reel = useMemo(() => (over ? reelLength(record) : 0), [over, record]);
  if (!over || reeling || (asked && stats === true)) return null;
  const signing = !!game.ranked && !bothSigned(game);
  // Scores to confirm and a result to sign carry their own lit button; Play again waits for them.
  const settled = !pending.length && !signing;
  const showStats = () => {
    useEndStats.setState({ asked: true });
    useStore.getState().set({ stats: true });
  };
  return (
    <section className={`obn-end${settled ? "" : " settling"}`} aria-label={t("The battle is over")}>
      <span className="obn-label">
        {[game.mission?.name, tn(game.turn.round - 1, "{n} round", "{n} rounds")].filter(Boolean).join(" · ")}
      </span>
      <Result />
      <RankedSign />
      {settled && !watching && (
        <button className="obn-lit" onClick={toDoor}>
          {t("Play again")} ▸
        </button>
      )}
      <div className="obn-end-choices">
        {reel > 0 && (
          <button className="obn-plain" onClick={startReel}>
            {t("Watch the highlights")}
          </button>
        )}
        <button className="obn-plain" onClick={showStats}>
          {t("Battle stats and review")}
        </button>
        {session && !watching && (
          <button className="obn-plain" onClick={reviewThisGame}>
            {t("Replay with notes")}
          </button>
        )}
        {!watching && (
          <button className="obn-plain" onClick={openShare}>
            {t("Share")}
          </button>
        )}
        {(!settled || watching) && (
          <button className="obn-plain" onClick={toDoor}>
            {t("Back to the front door")}
          </button>
        )}
      </div>
    </section>
  );
}
