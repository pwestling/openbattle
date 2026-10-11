import type { BaseShape, WeaponProfile } from "../core";
import type { ImportedRoster, ImportedUnit } from "../systems/wh40k/roster";

/**
 * Army list v1 (DRAFT, docs/protocols/army-list.md; schema in
 * schemas/army-list.v1.schema.json): a builder-neutral army list any army
 * builder can write and Open Battle reads. The `format` line carries the
 * major version; a minor revision only adds optional fields, and a reader
 * ignores fields it doesn't know. Builder-specific shapes are adapters that
 * map into this one (a system module's own reader).
 */

export const ARMY_LIST_FORMAT = "open-battle/army-list@1";

/** A special rule: "Tough(3)", or its name, rating and the player's own text. */
export type ArmyListRule = string | { name: string; rating?: number | string; text?: string };

export interface ArmyListWeapon {
  name: string;
  /** How many the unit carries; one a model when missing. */
  count?: number;
  /** Inches; 0 or missing for a melee weapon unless `kind` says otherwise. */
  range?: number;
  kind?: "ranged" | "melee";
  /** The weapon's characteristics by the game's ids or names ("A": 2, "AP": 1). */
  characteristics?: Record<string, string | number>;
  rules?: ArmyListRule[];
}

export interface ArmyListUnit {
  name: string;
  /** Models in the unit; 1 when missing. */
  size?: number;
  points?: number;
  /** Each model's characteristics by the game's ids or names ("Q": "4+", "Defense": 4). */
  characteristics?: Record<string, string | number>;
  rules?: ArmyListRule[];
  keywords?: string[];
  base?: BaseShape;
  weapons?: ArmyListWeapon[];
}

export interface ArmyListV1 {
  format: typeof ARMY_LIST_FORMAT;
  name: string;
  /** The Open Battle game system it is for, by id. */
  system?: string;
  points?: number;
  /** The builder that wrote it. */
  builder?: { name?: string; version?: string; url?: string };
  /** Rules packages the list is written for: an https link each, with the file's SHA-256 when known. */
  packages?: { url: string; sha256?: string }[];
  units: ArmyListUnit[];
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** Whether this is an Army list v1 file (its format line and a units list). */
export function isArmyList(data: unknown): data is ArmyListV1 {
  return isObj(data) && data.format === ARMY_LIST_FORMAT && Array.isArray(data.units);
}

/** A rule as the unit card shows it: "Tough(3)". */
function ruleLabel(r: ArmyListRule): string {
  if (typeof r === "string") return r.trim();
  const rating = r.rating === undefined || r.rating === "" ? "" : String(r.rating);
  return rating && !r.name.includes("(") ? `${r.name}(${rating})` : r.name.trim();
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "weapon";

const strings = (o: Record<string, string | number> | undefined): Record<string, string> =>
  Object.fromEntries(
    Object.entries(isObj(o) ? o : {}).flatMap(([k, v]) =>
      typeof v === "string" || (typeof v === "number" && Number.isFinite(v)) ? [[k, String(v)]] : [],
    ),
  );

const DEFAULT_BASE: BaseShape = { shape: "round", diameterMm: 25 };

function baseOf(b: unknown): BaseShape | undefined {
  if (!isObj(b)) return undefined;
  const n = (v: unknown) => (typeof v === "number" && v > 0 && v < 1000 ? v : undefined);
  if (b.shape === "round" && n(b.diameterMm)) return { shape: "round", diameterMm: n(b.diameterMm)! };
  if ((b.shape === "oval" || b.shape === "rect") && n(b.widthMm) && n(b.depthMm))
    return { shape: b.shape, widthMm: n(b.widthMm)!, depthMm: n(b.depthMm)! };
  return undefined;
}

/** One unit for the table: its models carry the unit's characteristics, and its weapons spread over them. */
export function armyListUnit(u: ArmyListUnit): ImportedUnit {
  const size = Math.max(1, Math.min(200, Math.floor(Number(u.size) || 1)));
  const ids = new Set<string>();
  const weapons = (Array.isArray(u.weapons) ? u.weapons : [])
    .filter((w) => isObj(w) && typeof w.name === "string" && w.name.trim())
    .map((w) => {
      let id = slug(w.name);
      for (let i = 2; ids.has(id); i++) id = `${slug(w.name)}-${i}`;
      ids.add(id);
      const range = typeof w.range === "number" && w.range > 0 ? w.range : 0;
      const chars = strings(w.characteristics);
      if (range > 0) chars.Range = String(range);
      const kind = w.kind ?? (range > 0 ? "ranged" : "melee");
      const profile: WeaponProfile = {
        id,
        name: w.name.trim(),
        kind,
        chars,
        keywords: (w.rules ?? []).map(ruleLabel).filter(Boolean),
      };
      return { profile, count: Math.max(1, Math.floor(Number(w.count) || size)) };
    });
  const carried: string[][] = Array.from({ length: size }, () => []);
  for (const w of weapons) for (let i = 0; i < w.count; i++) carried[i % size]!.push(w.profile.id);
  const chars = strings(u.characteristics);
  const abilities = (u.rules ?? []).map((r) => ({
    name: ruleLabel(r),
    text: typeof r === "object" && typeof r.text === "string" ? r.text : "",
  }));
  return {
    name: u.name.trim(),
    base: baseOf(u.base) ?? DEFAULT_BASE,
    sheet: {
      weapons: Object.fromEntries(weapons.map((w) => [w.profile.id, w.profile])),
      abilities: abilities.filter((a) => a.name),
      keywords: (u.keywords ?? []).filter((k) => typeof k === "string"),
      ...(typeof u.points === "number" ? { points: u.points } : {}),
    },
    models: carried.map((weaponIds, i) => ({
      profile: { name: size > 1 ? `${u.name.trim()} ${i + 1}` : u.name.trim(), chars },
      weapons: weaponIds,
    })),
  };
}

/** An Army list v1 file as an army for the table, read generically: characteristics by the game's names. */
export function armyListRoster(list: ArmyListV1): ImportedRoster {
  const warnings: string[] = [];
  const units = list.units.flatMap((u) => {
    if (!isObj(u) || typeof u.name !== "string" || !u.name.trim()) {
      warnings.push("A unit with no name was left out");
      return [];
    }
    return [armyListUnit(u)];
  });
  const points =
    typeof list.points === "number" ? list.points : units.reduce((n, u) => n + (u.sheet.points ?? 0), 0);
  return {
    name: typeof list.name === "string" && list.name.trim() ? list.name.trim() : "Army list",
    ...(points ? { points } : {}),
    units,
    warnings,
  };
}
