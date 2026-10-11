import { useEffect, useMemo, useState } from "react";
import { useStore } from "../store";
import { useLibrary } from "../packages/library";
import { packageArmiesFor, type PackageArmy } from "../packages/armies";
import { ARMY_FORMAT, useShelf } from "../packages/shelf";
import { armyListRoster } from "../share/armyList";
import { systemModule } from "../systems";
import type { ImportedRoster } from "../systems/wh40k/roster";
import { t } from "../i18n";

/**
 * Armies the game's rules packages bring (#82b, `export const armies`, read
 * as data): offered beside the game's own sample armies, labelled with the
 * package, and to put on the army shelf.
 */
function usePackageArmies(system: string): PackageArmy[] {
  const named = useStore((s) => s.game.packages?.packages);
  const library = useLibrary((s) => s.packages);
  useEffect(() => {
    void useLibrary.getState().load();
  }, []);
  return useMemo(() => {
    const here = (named ?? []).flatMap((p) => (library[p.hash] ? [library[p.hash]!] : []));
    return packageArmiesFor(here, system);
  }, [named, library, system]);
}

/** A package army as the game reads it: its own Army list reader, or the generic one. */
function packageArmyRoster(army: PackageArmy, system: string): ImportedRoster {
  return systemModule(system).readArmyList?.(army.list) ?? armyListRoster(army.list);
}

const label = (a: PackageArmy) => t("{army} · {package}", { army: a.list.name, package: a.from.name });

/** Pick one of the packages' armies, as a sample army is picked. */
export function PackageArmySelect({
  system,
  onPick,
}: {
  system: string;
  onPick: (roster: ImportedRoster) => void;
}) {
  const armies = usePackageArmies(system);
  if (!armies.length) return null;
  return (
    <select
      aria-label={t("Armies from rules packages")}
      value=""
      onChange={(e) => {
        const army = armies[Number(e.target.value)];
        if (army) onPick(packageArmyRoster(army, system));
      }}
    >
      <option value="">{t("From a rules package…")}</option>
      {armies.map((a, i) => (
        <option key={`${a.from.hash}:${i}`} value={i}>
          {label(a)}
        </option>
      ))}
    </select>
  );
}

/** The packages' armies, each one click from the army shelf. */
export function PackageArmiesToShelf({ system }: { system: string }) {
  const armies = usePackageArmies(system);
  const [put, setPut] = useState<Record<number, boolean>>({});
  if (!armies.length) return null;
  return (
    <details className="fold shelf">
      <summary>{t("Armies from rules packages ({count})", { count: armies.length })}</summary>
      <ul>
        {armies.map((a, i) => (
          <li key={`${a.from.hash}:${i}`}>
            <span>{label(a)}</span>
            <button
              className="small"
              disabled={put[i]}
              onClick={() => {
                const roster = packageArmyRoster(a, system);
                useShelf.getState().put({
                  format: ARMY_FORMAT,
                  id: crypto.randomUUID(),
                  name: roster.name,
                  system,
                  savedAt: Date.now(),
                  roster,
                  figures: {},
                });
                setPut((p) => ({ ...p, [i]: true }));
              }}
            >
              {put[i] ? t("On your shelf") : t("Put on your shelf")}
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}
