import { ARMY_LIST_FORMAT, isArmyList, type ArmyListV1 } from "../share/armyList";
import { systemMatches, type StoredPackage } from "./library";
import { readLiteral } from "./manifest";

/**
 * Armies a package brings (#82b, docs/protocols/packages.md): `export const
 * armies = [...]`, each entry an Army list v1 document
 * (docs/protocols/army-list.md). Read as data, like a faction pack's
 * `faction`, never run. An entry the reader can't take is a warning, not a
 * failure: the package's other armies and rules still load.
 */
export function readPackageArmies(source: string): { armies: ArmyListV1[]; warnings: string[] } {
  const data = readLiteral(source, "armies");
  if (!data) return { armies: [], warnings: [] };
  if ("error" in data) return { armies: [], warnings: [data.error] };
  if (!Array.isArray(data.value)) return { armies: [], warnings: ["`armies` must be a list."] };
  const armies: ArmyListV1[] = [];
  const warnings: string[] = [];
  for (const [i, entry] of data.value.entries()) {
    const format = (entry as { format?: unknown } | null)?.format;
    if (typeof format === "string" && format !== ARMY_LIST_FORMAT)
      warnings.push(`armies[${i}] is ${format}, which this version of Open Battle doesn't read.`);
    else if (!isArmyList(entry)) warnings.push(`armies[${i}] isn't an ${ARMY_LIST_FORMAT} list with units.`);
    else if (typeof entry.name !== "string" || !entry.name.trim()) warnings.push(`armies[${i}] has no name.`);
    else if (!entry.units.length) warnings.push(`armies[${i}] (${entry.name}) has no units.`);
    else armies.push(entry);
  }
  return { armies, warnings };
}

/** Each package's armies by hash: a hash names exact bytes, so they are read once. */
const read = new Map<string, { armies: ArmyListV1[]; warnings: string[] }>();
/** A package's armies, and what about them it couldn't read (for its consent sheet and details). */
export function packageArmiesReport(p: StoredPackage): { armies: ArmyListV1[]; warnings: string[] } {
  let got = read.get(p.hash);
  if (!got) read.set(p.hash, (got = readPackageArmies(p.source)));
  return got;
}
const armiesOf = (p: StoredPackage) => packageArmiesReport(p).armies;

/** An army from a package, with the package it came from (for its label). */
export interface PackageArmy {
  list: ArmyListV1;
  from: { hash: string; name: string; version: string };
}

/**
 * The armies the given packages bring for a game system: an army naming a
 * `system` goes to that game; one that names none, to the games the package
 * says it is for. Lesson and faction packages carry other data and bring none.
 */
export function packageArmiesFor(packages: StoredPackage[], system: string): PackageArmy[] {
  return packages.flatMap((p) => {
    if (p.manifest.kind !== "extension" && p.manifest.kind !== "system") return [];
    const from = { hash: p.hash, name: p.manifest.name, version: p.manifest.version };
    return armiesOf(p)
      .filter((list) =>
        list.system
          ? systemMatches(list.system, system)
          : p.manifest.systems.some((s) => systemMatches(s, system)),
      )
      .map((list) => ({ list, from }));
  });
}
