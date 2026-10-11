import { useEffect, useState } from "react";
import { matchPoints, pointsOf } from "../bot/matchPoints";
import type { Level } from "../bot/player";
import { characterName, levelName } from "../bot/solo";
import { startSolo, type OwnArmy } from "../bot/startSolo";
import { DEFAULT_SYSTEM } from "../core";
import { ownGame } from "../games/riftLanterns";
import { t, tn } from "../i18n";
import { useShelf } from "../packages/shelf";
import { systemModule } from "../systems";
import type { ImportedRoster } from "../systems/wh40k/roster";

/**
 * Get ready against the computer (ui-next, UX N1): your army as a choice
 * (the sample, one off your shelf, or a list read now) and one lit button,
 * "Start against Steady". The computer fields its sample army, cut to your
 * points if you ask.
 */
export function ComputerArmy({ system, level }: { system: string; level: Level }) {
  const { armies, load } = useShelf();
  const [pick, setPick] = useState<string>("sample");
  const [read, setRead] = useState<ImportedRoster | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [match, setMatch] = useState(false);
  useEffect(() => {
    void load();
  }, [load]);
  const shelf = Object.values(armies)
    .filter((a) => (a.system || DEFAULT_SYSTEM) === system)
    .sort((a, b) => b.savedAt - a.savedAt);
  const module = ownGame(system) ? null : systemModule(system);
  const sample = module?.sample(0);
  const theirs = module?.sample(1);
  const readFile = async (file: File) => {
    setError(null);
    try {
      const parse = module?.importRoster ?? (await import("../systems/wh40k/roster")).parseRosterFile;
      const roster = await parse(file.name, new Uint8Array(await file.arrayBuffer()));
      if (!roster.units.length) return setError(t("That file has no units this game can read."));
      setRead(roster);
      setPick("read");
    } catch {
      setError(t("That file has no units this game can read."));
    }
  };
  const shelved = shelf.find((a) => a.id === pick);
  const roster = pick === "read" ? read : shelved ? shelved.roster : (sample ?? null);
  const pts = roster ? pointsOf(roster) : 0;
  const theirPts = theirs ? pointsOf(theirs) : 0;
  const far = !!(pts && theirPts && Math.abs(pts - theirPts) > 0.25 * Math.min(pts, theirPts));
  const start = () => {
    const mine: OwnArmy | undefined =
      pick === "read" && read
        ? { roster: read }
        : shelved
          ? { roster: shelved.roster, shelf: shelved }
          : undefined;
    const cut = match && far && theirs ? matchPoints(theirs, pts) : null;
    if (!mine && !cut) return startSolo(system, level);
    startSolo(system, level, { ...(mine ?? { roster: sample! }), ...(cut ? { theirs: cut } : {}) });
  };
  const choice = (id: string, name: string, sub?: string) => (
    <button
      key={id}
      role="radio"
      aria-checked={pick === id}
      className={`obn-pick small${pick === id ? " on" : ""}`}
      onClick={() => setPick(id)}
    >
      <strong>{name}</strong>
      {sub && <span>{sub}</span>}
    </button>
  );
  const ptsLine = (r: ImportedRoster) => {
    const p = pointsOf(r);
    return [
      tn(r.units.length, "{n} unit", "{n} units"),
      ...(p ? [t("{points} pts", { points: p })] : []),
    ].join(" · ");
  };
  return (
    <>
      <span className="obn-label">{t("Your army")}</span>
      <div className="obn-stack" role="radiogroup" aria-label={t("Your army")}>
        {choice(
          "sample",
          sample ? sample.name : t("A sample army"),
          sample ? t("Sample · {line}", { line: ptsLine(sample) }) : undefined,
        )}
        {shelf.map((a) => choice(a.id, a.name, t("Your shelf · {line}", { line: ptsLine(a.roster) })))}
        {read && choice("read", read.name, t("Just read · {line}", { line: ptsLine(read) }))}
        {!ownGame(system) && (
          <label className="obn-link obn-file">
            {t("Import a list…")}
            <input
              type="file"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void readFile(f);
              }}
            />
          </label>
        )}
        {error && <p className="obn-warn">{error}</p>}
      </div>
      {far && (
        <label className="obn-tick">
          <input type="checkbox" checked={match} onChange={(e) => setMatch(e.target.checked)} />
          {t("The computer's army is {n} pts: match my points", { n: theirPts })}
        </label>
      )}
      <button className="obn-lit" onClick={start}>
        {t("Start against {who}", { who: `${levelName(level)}` })} ▸
      </button>
      <p className="obn-muted">{t("{name} plays the far side.", { name: characterName(level) })}</p>
    </>
  );
}
