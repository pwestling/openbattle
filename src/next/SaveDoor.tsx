import { useEffect, useMemo, useState } from "react";
import { listSystems } from "../core/content";
import { DEFAULT_SYSTEM } from "../core/content/turn";
import { t, tn } from "../i18n";
import { bringTable } from "../tts/bring";
import { hostTtsOnline } from "../tts/online";
import { openTtsGame } from "../tts/open";
import { readScriptedUnit } from "../tts/scripted";
import { scanTable } from "../tts/table";
import { systemLabel } from "../ui/systemLabels";
import { NAME_KEY, savedName, useInviteCopied } from "./start";

/**
 * A Tabletop Simulator save opened at the door (ui-next, UX N2): what's in it
 * as the first column, then who against and your name, and one lit button.
 * The save's terrain, armies where they stood and its decks all come along.
 */
export function SaveDoor({ file, onClose }: { file: File; onClose: () => void }) {
  const [data, setData] = useState<unknown>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let on = true;
    file
      .text()
      .then((s) => on && setData(JSON.parse(s)))
      .catch(() => on && setFailed(true));
    return () => {
      on = false;
    };
  }, [file]);
  const scan = useMemo(() => {
    try {
      return data ? scanTable(data) : null;
    } catch {
      return null;
    }
  }, [data]);
  const [system, setSystem] = useState(DEFAULT_SYSTEM);
  const [swapped, setSwapped] = useState(false);
  const [how, setHow] = useState<"online" | "here">("online");
  const [name, setName] = useState(savedName);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (failed || (data && !scan))
    return (
      <div className="obn-cols">
        <section className="obn-col">
          <p className="obn-warn">{t("That save couldn't be read.")}</p>
          <button className="obn-link" onClick={onClose}>
            {t("Back")}
          </button>
        </section>
      </div>
    );
  if (!scan) return <p className="obn-muted">{t("Reading the save…")}</p>;
  const placed = scan.units.filter((u) => u.placed);
  const decks = scan.decks ?? [];
  const units = scan.units.map((u) => ({ ...u, side: (u.side ^ +swapped) as 0 | 1 }));
  const names = (side: 0 | 1) =>
    units
      .filter((u) => u.side === side)
      .map((u) => readScriptedUnit(u.models)?.name || u.name)
      .slice(0, 4);
  const go = async () => {
    try {
      if (name.trim()) localStorage.setItem(NAME_KEY, name.trim());
    } catch {
      // Not kept.
    }
    setError(null);
    try {
      const brought = await bringTable({ ...scan, units }, system, null, setProgress);
      const lost = brought.lost.length
        ? tn(
            brought.lost.length,
            "{names} couldn't be downloaded: a figure stands in on a plain base, terrain is left out.",
            "{names} couldn't be downloaded: figures stand in on plain bases, terrain is left out.",
            { names: brought.lost.slice(0, 4).join(", ") },
          )
        : "";
      if (how === "online")
        void hostTtsOnline(brought, lost).then((copied) => useInviteCopied.setState({ copied }));
      else openTtsGame(brought, lost);
    } catch {
      setError(t("The save couldn't be brought over."));
    } finally {
      setProgress(null);
    }
  };
  return (
    <div className="obn-cols">
      <section className="obn-col" aria-labelledby="obn-save-h">
        <h2 id="obn-save-h">
          <span className="obn-no">1</span> {t("Your save")}
        </h2>
        <div className="obn-save">
          <strong>{scan.title || file.name}</strong>
          <span>
            {[
              tn(scan.terrain.length, "{n} piece of terrain", "{n} pieces of terrain"),
              tn(placed.length, "{n} unit on the table", "{n} units on the table"),
              ...(decks.length ? [tn(decks.length, "{n} deck of cards", "{n} decks of cards")] : []),
            ].join(" · ")}
          </span>
        </div>
        <label className="obn-field">
          <span className="obn-label">{t("Game")}</span>
          <select value={system} onChange={(e) => setSystem(e.target.value)}>
            {listSystems().map((s) => (
              <option key={s.id} value={s.id}>
                {systemLabel(s.id, s.name)}
              </option>
            ))}
          </select>
        </label>
        {units.length > 0 && (
          <div className="obn-stack obn-sides">
            {([0, 1] as const).map((side) => (
              <div key={side} className="obn-muted small">
                <strong>{side === 0 ? t("You:") : t("Your opponent:")}</strong>{" "}
                {names(side).join(", ") || t("the game's sample army")}
              </div>
            ))}
            <button className="obn-link small" onClick={() => setSwapped(!swapped)}>
              {t("Swap sides")}
            </button>
          </div>
        )}
        <button className="obn-link" onClick={onClose}>
          {t("Not this save")}
        </button>
      </section>
      <section className="obn-col obn-drawer" aria-labelledby="obn-savewho-h">
        <h2 id="obn-savewho-h">
          <span className="obn-no">2</span> {t("Who against?")}
        </h2>
        <div role="radiogroup" aria-labelledby="obn-savewho-h" className="obn-stack">
          {(
            [
              [
                "online",
                t("A friend online"),
                t("You get a link to send. Their army is offered when they sit."),
              ],
              ["here", t("Both sides, this screen"), t("Pass the screen each turn.")],
            ] as const
          ).map(([id, title, line]) => (
            <button
              key={id}
              role="radio"
              aria-checked={how === id}
              className={`obn-pick${how === id ? " on" : " dim"}`}
              onClick={() => setHow(id)}
            >
              <strong>{title}</strong>
              <span>{line}</span>
            </button>
          ))}
        </div>
      </section>
      <section className="obn-col obn-drawer" aria-labelledby="obn-saveready-h">
        <h2 id="obn-saveready-h">
          <span className="obn-no">3</span> {t("Get ready")}
        </h2>
        <label className="obn-field">
          <span className="obn-label">{t("Your name")}</span>
          <input
            value={name}
            className={how === "online" && !name.trim() ? "obn-lit-field" : undefined}
            maxLength={32}
            placeholder={t("What should the others call you?")}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <button
          className="obn-lit"
          disabled={!!progress || (how === "online" && !name.trim())}
          onClick={() => void go()}
        >
          {how === "online" ? t("Host the table") : t("Open the table")} ▸
        </button>
        {progress && (
          <p className="obn-muted" role="status">
            {progress}
          </p>
        )}
        {error && <p className="obn-warn">{error}</p>}
      </section>
    </div>
  );
}
