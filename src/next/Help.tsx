import { useEffect, useState } from "react";
import { t } from "../i18n";
import { useHelp } from "../ui/help";
import { KeysSheet } from "../ui/Keys";
import { touch } from "../ui/touch";

/**
 * The "?" sheet in the new layout (naive players 7): three lines on how to play, not a wall of keys.
 * By touch it names no keys at all; with a keyboard, every key is one link away.
 */
export function NextHelp() {
  const open = useHelp((s) => s.keys);
  const [keys, setKeys] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = (e: KeyboardEvent) => e.key === "Escape" && useHelp.setState({ keys: false });
    addEventListener("keydown", close);
    return () => removeEventListener("keydown", close);
  }, [open]);
  // Closed from the keys sheet: the next "?" opens on the three lines again.
  if (!open && keys) setKeys(false);
  if (!open) return null;
  if (keys) return <KeysSheet />;
  const fingers = touch();
  const close = () => {
    setKeys(false);
    useHelp.setState({ keys: false });
  };
  return (
    <div className="modal-backdrop" onClick={close}>
      <div
        className="panel modal obn-help"
        role="dialog"
        aria-label={t("How to play")}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="row spread">
          <h2>{t("How to play")}</h2>
          <button className="quiet" aria-label={t("Close")} onClick={close}>
            ✕
          </button>
        </div>
        <ol>
          <li>
            {fingers
              ? t(
                  "Drag a unit's base to move it. One finger on the table slides the view; two pinch and turn it.",
                )
              : t("Drag a unit's base to move it. Drag the table to turn the view; the wheel zooms.")}
          </li>
          <li>{t("Tap an enemy to shoot, charge or fight it with the unit the bar lights.")}</li>
          <li>
            {t(
              "The gold button in the bar is always the next thing to press. Done ends the phase, and Undo takes back the last thing you did.",
            )}
          </li>
        </ol>
        {!fingers && (
          <button className="obn-link small" onClick={() => setKeys(true)}>
            {t("Every key ▸")}
          </button>
        )}
      </div>
    </div>
  );
}
