import { useState } from "react";
import { listSystems } from "../core/content";
import { t } from "../i18n";
import { FRONT, systemLabel } from "./systemLabels";

/** Where a game's army lists come from, in plain steps. */
const LISTS: Record<string, () => string[]> = {
  "forty-k-11": () => [
    t("Build your list in New Recruit or BattleScribe."),
    t("Save it as a file: New Recruit exports JSON, BattleScribe saves .ros or .rosz. All three read in."),
    t("Yellowscribe army data (the JSON TTS army tools use) reads in too."),
    t("In a game, before the battle starts, press Import a list in the left panel and pick the file."),
    t(
      "Playing in TTS? Open your save with Open a Tabletop Simulator save as a game: the table and both armies come in, Yellowscribe models with their stats.",
    ),
    t("Check the summary: bases are guessed from the unit, and you can change any of them. Then deploy."),
  ],
};

/**
 * "Bring your army" (front door): how to get your own list, figures and rules
 * onto the table, for each game. Nothing ships with the app but sample armies.
 */
export function ArmyGuide({ system, onClose }: { system: string; onClose: () => void }) {
  const games = listSystems().filter((s) => LISTS[s.id]);
  const [at, setAt] = useState(LISTS[system] ? system : (games[0]?.id ?? ""));
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="panel modal guide"
        role="dialog"
        aria-label={t("Bring your army")}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="row spread">
          <h2>{t("Bring your army")}</h2>
          <button className="quiet" title={t("Close")} onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="tabs" role="tablist">
          {games.map((g) => (
            <button
              key={g.id}
              role="tab"
              aria-selected={g.id === at}
              className={g.id === at ? "on" : ""}
              onClick={() => setAt(g.id)}
            >
              {systemLabel(g.id, g.name)}
            </button>
          ))}
        </div>
        <h3>{t("Your list")}</h3>
        <ol>
          {(LISTS[at]?.() ?? []).map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ol>
        <p className="muted small">
          {t(
            "Your list stays with you: it goes to the people in your game and nowhere else. Open Battle comes with no armies but its made-up samples.",
          )}
        </p>
        <h3>{t("Your figures")}</h3>
        <ol>
          <li>
            {t(
              "Any 3D model file works: .glb, .gltf, .stl, .obj or .ply (a scan, or the file you printed from).",
            )}
          </li>
          <li>
            {t("Drag the file onto a unit on the table, or select the unit and use Figures on its card.")}
          </li>
          <li>
            {t("One figure for the whole unit, or one per kind of model. Everyone in the game sees them.")}
          </li>
        </ol>
        <h3>{t("Rules packages")}</h3>
        <p>
          {t(
            "A rules package adds a game, or more {army} and rules to one, as a single file. Add it under Rules packages on the start screen. Everyone in a game checks they have the same version, and a package's code only runs once you have said yes to it.",
            { army: FRONT[at]?.army ?? t("units") },
          )}
        </p>
      </div>
    </div>
  );
}
