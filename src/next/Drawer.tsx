import { useEffect, useRef, useState } from "react";
import { CampaignFold } from "../campaign/CampaignUI";
import { t } from "../i18n";
import { RankedOffer, RankedSign } from "../ranked/RankedGame";
import { reviewThisGame } from "../replay/review";
import { useCanControl, useStore } from "../store";
import { ArmyImport, PhotoFigures } from "../ui/ArmyImport";
import { CardDecks } from "../ui/Cards";
import { GameSettings } from "../ui/GameSettings";
import { GameLog, GameMenu, StatsButton } from "../ui/Hud";
import { useGame } from "../ui/hooks";
import { SecretMissions } from "../ui/Missions";
import { SecretObjectives } from "../ui/SecretObjectives";
import { battleOver } from "../ui/StatsScreen";
import { TemplateTools } from "../ui/TemplateTools";
import { TextSizePicker } from "../ui/TextSizePicker";
import { switchUi } from "./flag";

/**
 * ⋯ (ui-next): everything that isn't the next step, in one place. The view,
 * the ruler, your secret cards and missions, armies, the dice roller, the log,
 * game settings, and leaving. Keys work the same with it closed.
 */
export function Drawer({ onClose }: { onClose: () => void }) {
  const {
    record,
    session,
    dispatch,
    view,
    setView,
    resetView,
    role,
    editing,
    xray,
    plates,
    measuring,
    director,
    set,
  } = useStore();
  const game = useStore((s) => s.game);
  const shown = useGame();
  const canControl = useCanControl();
  const mine = Object.values(game.players).filter((p) => p.seat !== undefined && canControl(p.id));
  const round = game.turn.round;
  const playing = role !== "spectator";
  const [count, setCount] = useState(2);
  const [sides, setSides] = useState(6);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("button")?.focus();
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, [onClose]);
  const over = battleOver(shown);
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
        <h3 className="obn-label">{t("View")}</h3>
        <div className="obn-row wrap">
          <button onClick={() => setView(view === "top" ? "3d" : "top")}>
            {view === "top" ? t("3D view") : t("Top-down view")}
          </button>
          {playing && (
            <button className={measuring ? "on" : ""} onClick={() => set({ measuring: !measuring })}>
              {t("Ruler")} <kbd>M</kbd>
            </button>
          )}
          <button onClick={resetView}>
            {t("Reset view")} <kbd>Home</kbd> {/* i18n-ignore: a key */}
          </button>
          <button aria-pressed={plates} onClick={() => set({ plates: !plates })}>
            {plates ? "✓ " : ""}
            {t("Unit names")}
          </button>
          <button aria-pressed={xray} onClick={() => set({ xray: !xray })}>
            {xray ? "✓ " : ""}
            {t("X-ray terrain")} <kbd>X</kbd>
          </button>
          <button aria-pressed={director} onClick={() => set({ director: !director })}>
            {director ? "✓ " : ""}
            {t("Follow action")}
          </button>
          {playing && (round === 0 || editing) && (
            <button
              className={editing ? "on" : ""}
              onClick={() => set({ editing: !editing, selectedTerrain: null })}
            >
              {editing ? t("Done editing") : t("Edit terrain")}
            </button>
          )}
        </div>
        <TextSizePicker />
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
        <h3 className="obn-label">{t("Your cards and missions")}</h3>
        <SecretObjectives players={mine} />
        <SecretMissions players={mine} />
        <CardDecks players={mine} />
        {game.campaign && <CampaignFold />}
      </section>
      {playing && mine.length > 0 && (
        <section>
          <h3 className="obn-label">{t("Armies")}</h3>
          {mine.map((p) => (
            <PhotoFigures key={p.id} owner={p.id} name={mine.length > 1 ? p.name : null} />
          ))}
          <ArmyImport players={mine} />
        </section>
      )}
      {playing && (
        <section>
          <h3 className="obn-label">{t("Roll dice")}</h3>
          <div className="obn-row">
            <input
              type="number"
              min={1}
              max={100}
              value={count}
              aria-label={t("How many dice")}
              onChange={(e) => setCount(Number(e.target.value))}
            />
            <span>{t("D")}</span>
            <select value={sides} aria-label={t("Sides")} onChange={(e) => setSides(Number(e.target.value))}>
              {[3, 6, 8, 10, 12, 20].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <button onClick={() => dispatch({ type: "dice/roll", count, sides })}>{t("Roll")}</button>
          </div>
          <TemplateTools />
        </section>
      )}
      <section>
        <h3 className="obn-label">{t("Game")}</h3>
        <GameSettings />
        <RankedOffer />
      </section>
      <section>
        <h3 className="obn-label">{t("What happened")}</h3>
        {session && !over && (
          <button
            onClick={() => {
              // The replay bar's own handle, tucked out of sight in ui-next.
              document.querySelector<HTMLButtonElement>(".replaybar.tucked button")?.click();
              onClose();
            }}
          >
            {t("Look back over the game")}
          </button>
        )}
        <GameLog />
      </section>
      <button className="obn-link" onClick={() => switchUi(false)}>
        {t("Switch to the classic layout")}
      </button>
    </aside>
  );
}
