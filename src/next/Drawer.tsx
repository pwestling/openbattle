import { useEffect, useRef } from "react";
import { CampaignFold } from "../campaign/CampaignUI";
import { t } from "../i18n";
import { RankedOffer, RankedSign } from "../ranked/RankedGame";
import { reviewThisGame } from "../replay/review";
import { useCanControl, useStore } from "../store";
import { CardDecks } from "../ui/Cards";
import { GameSettings } from "../ui/GameSettings";
import { GameLog, GameMenu, StatsButton } from "../ui/Hud";
import { useGame } from "../ui/hooks";
import { SecretMissions } from "../ui/Missions";
import { SecretObjectives } from "../ui/SecretObjectives";
import { battleOver } from "../ui/StatsScreen";
import { TemplateTools } from "../ui/TemplateTools";

/**
 * ⋯ (ui-next): the view, the ruler and the log, plus downloading the replay
 * and leaving from its head (Jobs review: five lines). Secret cards, missions
 * and templates show only in games that have them; game settings and terrain
 * only while setting up. Keys work the same with it closed.
 */
export function Drawer({ onClose }: { onClose: () => void }) {
  const { record, session, view, setView, role, editing, measuring, set } = useStore();
  const game = useStore((s) => s.game);
  const shown = useGame();
  const canControl = useCanControl();
  const mine = Object.values(game.players).filter((p) => p.seat !== undefined && canControl(p.id));
  const round = game.turn.round;
  const playing = role !== "spectator";
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("button")?.focus();
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, [onClose]);
  const over = battleOver(shown);
  const setup = playing && (round === 0 || editing);
  return (
    <aside className="obn-drawer-panel" ref={ref} aria-label={t("Menu")}>
      <div className="obn-sheet-head">
        {/* i18n-ignore */}
        <strong>Open Battle</strong>
        <span className="obn-row">
          <GameMenu record={record} />
          <button className="obn-quiet" onClick={onClose} aria-label={t("Close")}>
            ✕
          </button>
        </span>
      </div>
      <section>
        <div className="obn-row wrap">
          <button onClick={() => setView(view === "top" ? "3d" : "top")}>
            {view === "top" ? t("3D view") : t("Top-down view")}
          </button>
          {playing && (
            <button className={measuring ? "on" : ""} onClick={() => set({ measuring: !measuring })}>
              {t("Ruler")} <kbd>M</kbd>
            </button>
          )}
          {setup && (
            <button
              className={editing ? "on" : ""}
              onClick={() => set({ editing: !editing, selectedTerrain: null })}
            >
              {editing ? t("Done editing") : t("Edit terrain")}
            </button>
          )}
        </div>
        {setup && <GameSettings />}
      </section>
      {(over || !session) && (
        <section>
          <h3 className="obn-label">{t("After the battle")}</h3>
          <div className="obn-row wrap">
            <StatsButton over={over} />
            {session && over && <button onClick={reviewThisGame}>{t("Replay with notes")}</button>}
          </div>
          <RankedSign />
        </section>
      )}
      <section>
        <SecretObjectives players={mine} />
        <SecretMissions players={mine} />
        <CardDecks players={mine} />
        {game.campaign && <CampaignFold />}
        {playing && <TemplateTools />}
        <RankedOffer />
      </section>
      <section>
        <h3 className="obn-label">{t("Log")}</h3>
        <GameLog />
      </section>
    </aside>
  );
}
