import { useEffect, useMemo, useState } from "react";
import { DEFAULT_SYSTEM } from "../core";
import { useStore } from "../store";
import { useLibrary, type StoredPackage } from "../packages/library";
import { packageArmiesFor, packageArmiesReport, type PackageArmy } from "../packages/armies";
import { ARMY_FORMAT, useShelf } from "../packages/shelf";
import { armyListRoster } from "../share/armyList";
import { systemModule } from "../systems";
import type { ImportedRoster } from "../systems/wh40k/roster";
import { t, tn } from "../i18n";

/**
 * Armies the game's rules packages bring (#82b, `export const armies`, read
 * as data): offered beside the game's own sample armies, labelled with the
 * package, and to put on the army shelf. Each piece is self-contained, so
 * another screen can mount it.
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

/**
 * Before a game exists (the front door's "Get ready"): the armies of the
 * packages this device trusts for the game. Picking one turns its package on
 * in the game it starts (OwnArmy.packages).
 */
export function useLibraryArmies(system: string): PackageArmy[] {
  const library = useLibrary((s) => s.packages);
  useEffect(() => {
    void useLibrary.getState().load();
  }, []);
  return useMemo(
    () =>
      packageArmiesFor(
        Object.values(library).filter((p) => p.trusted),
        system,
      ),
    [library, system],
  );
}

/** A package army as the game reads it: its own Army list reader, or the generic one. */
export function packageArmyRoster(army: PackageArmy, system: string): ImportedRoster {
  return systemModule(system).readArmyList?.(army.list) ?? armyListRoster(army.list);
}

/** The package an army came from, from this device's library. */
export const packageOf = (army: PackageArmy): StoredPackage | undefined =>
  useLibrary.getState().packages[army.from.hash];

/** "Ash Wardens · from Ember Courts": an army with the package it came from. */
export const packageArmyLabel = (a: PackageArmy) =>
  t("{army} · from {package}", { army: a.list.name, package: a.from.name });

/** What a package brings besides rules, in a line ("Brings 2 armies"), and what of it couldn't be read. */
export function PackageBrings({ pkg }: { pkg: StoredPackage }) {
  if (pkg.manifest.kind !== "extension" && pkg.manifest.kind !== "system") return null;
  const { armies, warnings } = packageArmiesReport(pkg);
  if (!armies.length && !warnings.length) return null;
  return (
    <>
      {armies.length > 0 && (
        <p className="small">
          {tn(armies.length, "Brings {n} army: {names}.", "Brings {n} armies: {names}.", {
            names: armies.map((a) => a.name).join(", "),
          })}
        </p>
      )}
      {warnings.map((w) => (
        <p key={w} className="warn small">
          {t("An army in it can't be used: {why}", { why: w })}
        </p>
      ))}
    </>
  );
}

/**
 * One picker for every army the game offers: its sample armies, then each
 * package's, under the package's name.
 */
export function ArmyPicker({
  system,
  samples,
  onPick,
}: {
  system: string;
  samples: ImportedRoster[];
  onPick: (roster: ImportedRoster, from?: PackageArmy) => void;
}) {
  const armies = usePackageArmies(system);
  const groups = new Map<string, { name: string; armies: [number, PackageArmy][] }>();
  armies.forEach((a, i) => {
    const g = groups.get(a.from.hash) ?? { name: a.from.name, armies: [] };
    g.armies.push([i, a]);
    groups.set(a.from.hash, g);
  });
  // Only the side's own sample: one button, no list to open.
  if (!armies.length && samples.length === 1)
    return <button onClick={() => onPick(samples[0]!)}>{t("Sample army")}</button>;
  return (
    <select
      aria-label={t("Sample army")}
      value=""
      onChange={(e) => {
        const [kind, n] = e.target.value.split(":");
        if (kind === "s" && samples[Number(n)]) onPick(samples[Number(n)]!);
        const army = kind === "p" ? armies[Number(n)] : undefined;
        if (army) onPick(packageArmyRoster(army, system), army);
      }}
    >
      <option value="">{armies.length ? t("Sample or package army…") : t("Sample army…")}</option>
      <optgroup label={t("Sample armies")}>
        {samples.map((a, i) => (
          <option key={i} value={`s:${i}`}>
            {a.name}
          </option>
        ))}
      </optgroup>
      {[...groups].map(([hash, g]) => (
        <optgroup key={hash} label={t("From {package}", { package: g.name })}>
          {g.armies.map(([i, a]) => (
            <option key={i} value={`p:${i}`}>
              {a.list.name}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

/** The packages' armies, each one click from the army shelf; one already there says so. */
export function PackageArmiesToShelf({ system }: { system: string }) {
  const armies = usePackageArmies(system);
  const shelf = useShelf((s) => s.armies);
  const [put, setPut] = useState<Record<number, boolean>>({});
  if (!armies.length) return null;
  // On the shelf already: an army of this game by the same name (the shelf keeps no link to the package).
  const shelved = (a: PackageArmy) =>
    Object.values(shelf).some((s) => s.name === a.list.name && (s.system || DEFAULT_SYSTEM) === system);
  return (
    <details className="fold shelf">
      <summary>{t("Armies from rules packages ({count})", { count: armies.length })}</summary>
      <ul>
        {armies.map((a, i) => (
          <li key={`${a.from.hash}:${i}`}>
            <span>{packageArmyLabel(a)}</span>
            <button
              className="small"
              disabled={put[i] || shelved(a)}
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
              {put[i] || shelved(a) ? t("On your shelf ✓") : t("Put on your shelf")}
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}

/**
 * The front door's "Get ready" for both sides on one screen: the near side's
 * army, when a trusted package brings any for the game (else nothing, and the
 * sample armies play). Picking one turns its package on in the game.
 */
export function PackageArmyChoice({
  system,
  onChange,
}: {
  system: string;
  onChange: (mine: { roster: ImportedRoster; packages: StoredPackage[] } | null) => void;
}) {
  const armies = useLibraryArmies(system);
  const [picked, setPicked] = useState("");
  if (!armies.length) return null;
  return (
    <label className="row small package-army-choice">
      {t("Your side")}{" "}
      <select
        value={picked}
        onChange={(e) => {
          setPicked(e.target.value);
          const army = e.target.value ? armies[Number(e.target.value)] : undefined;
          const pkg = army && packageOf(army);
          onChange(army ? { roster: packageArmyRoster(army, system), packages: pkg ? [pkg] : [] } : null);
        }}
      >
        <option value="">{t("The sample army")}</option>
        {armies.map((a, i) => (
          <option key={`${a.from.hash}:${i}`} value={i}>
            {packageArmyLabel(a)}
          </option>
        ))}
      </select>
    </label>
  );
}
