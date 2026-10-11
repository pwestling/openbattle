import type { BaseShape } from "../../core";
import type { ImportedRoster, ImportedUnit } from "../wh40k/roster";
import {
  ARMY_LIST_FORMAT,
  armyListRoster,
  armyListUnit,
  isArmyList,
  type ArmyListUnit,
  type ArmyListV1,
} from "../../share/armyList";

/**
 * Army lists for Quality d6 (#82), read from the file a player brings and
 * kept on their device like any imported army. Every list goes through
 * Army list v1 (src/share/armyList.ts, docs/protocols/army-list.md), read
 * natively; the other shapes are adapters that map into it:
 *
 *  - Army list v1 JSON (`"format": "open-battle/army-list@1"`).
 *  - A unit builder's JSON export: an object with a `units` list (or the
 *    list itself, or under `list` or `army`). Each unit has a name, a size,
 *    a quality and a defense ("4+" or 4), points (`cost` or `points`),
 *    special rules (strings, or `{ name, rating }`), and equipment
 *    (`equipment`, `weapons` or `loadout`): each item a name, a count, a
 *    range, attacks and its own special rules; an item with no attacks
 *    gives its rules (`content`) to the unit. Read tolerantly: fields it
 *    doesn't know are ignored.
 *  - Text, one unit to a line and its weapons on the lines after it:
 *
 *        Lantern Guard [5] Q4+ D4+ | 120pts | Fearless, Tough(3)
 *        5x Long Rifle (24", A1, AP(1)), 5x Knife (A1)
 *
 * Special rules are kept by name; the system's rules bind to the ones it
 * knows (system.ts) and the rest are reminders for the players. Tough(X)
 * becomes each model's Wounds.
 */

export interface WeaponSpec {
  name: string;
  /** Inches; 0 or none for a melee weapon. */
  range?: number;
  attacks: number | string;
  ap?: number;
  /** Its special rules by name, e.g. "Blast(3)". */
  rules?: string[];
  /** How many the unit carries; one a model when missing. */
  count?: number;
}

export interface UnitSpec {
  name: string;
  size: number;
  quality: number;
  defense: number;
  points?: number;
  rules: string[];
  weapons: WeaponSpec[];
  /** A rule's description, where the player's file gives one (it stays on their device). */
  texts?: Record<string, string>;
}

/** Tough(X) among a unit's rules: X, else 1. */
function toughOf(rules: string[]): number {
  for (const r of rules) {
    const m = /^tough\s*\(?\s*(\d+)/i.exec(r.trim());
    if (m) return Number(m[1]);
  }
  return 1;
}

/** A base for a model with this many wounds: a guess the import summary lets players change. */
function baseFor(wounds: number): BaseShape {
  return { shape: "round", diameterMm: wounds >= 9 ? 80 : wounds >= 6 ? 60 : wounds >= 3 ? 40 : 25 };
}

/** A unit in Army list v1 terms: Quality, Defense and Wounds on each model, its weapons' attacks and AP. */
function listUnit(spec: UnitSpec): ArmyListUnit {
  const wounds = toughOf(spec.rules);
  return {
    name: spec.name,
    size: spec.size,
    ...(spec.points !== undefined ? { points: spec.points } : {}),
    characteristics: { Q: `${spec.quality}+`, D: `${spec.defense}+`, W: wounds },
    rules: spec.rules.map((name) => (spec.texts?.[name] ? { name, text: spec.texts[name] } : name)),
    base: baseFor(wounds),
    weapons: spec.weapons.map((w) => ({
      name: w.name,
      ...(w.range ? { range: w.range } : {}),
      ...(w.count !== undefined ? { count: w.count } : {}),
      characteristics: { A: String(w.attacks), ...(w.ap ? { AP: w.ap } : {}) },
      rules: w.rules ?? [],
    })),
  };
}

/** One unit, as the table takes it: its models with Quality, Defense and Wounds, and who carries what. */
export const buildUnit = (spec: UnitSpec): ImportedUnit => armyListUnit(listUnit(spec));

/** Units in Army list v1 terms, as a list for this game. */
const toArmyList = (name: string, units: UnitSpec[]): ArmyListV1 => ({
  format: ARMY_LIST_FORMAT,
  name,
  system: "qd6-1",
  units: units.map(listUnit),
});

/**
 * An Army list v1 file read for this game: as any system reads it, and
 * then Tough(X) gives Wounds and a base to fit, where the list gives none.
 */
export function readQd6ArmyList(list: ArmyListV1): ImportedRoster {
  const roster = armyListRoster(list);
  const units = roster.units.map((u, i): ImportedUnit => {
    const given = list.units[i];
    const chars = given?.characteristics ?? {};
    const wounds = toughOf(u.sheet.abilities.map((a) => a.name));
    const hasW = ["W", "Wounds", "Tough"].some((k) => chars[k] !== undefined);
    return {
      ...u,
      ...(given?.base
        ? {}
        : { base: baseFor(hasW ? Number(chars.W ?? chars.Wounds ?? chars.Tough) || 1 : wounds) }),
      models: hasW
        ? u.models
        : u.models.map((m) => ({
            ...m,
            profile: { ...m.profile!, chars: { ...m.profile!.chars, W: String(wounds) } },
          })),
    };
  });
  return { ...roster, units };
}

// ---------------------------------------------------------------------------
// JSON
// ---------------------------------------------------------------------------

type Json = Record<string, unknown>;

const isObj = (v: unknown): v is Json => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown): string | undefined =>
  typeof v === "string" ? v.trim() || undefined : typeof v === "number" ? String(v) : undefined;
/** The first number in a value: 4, "4+", "24\"", "A3". */
const numOf = (v: unknown): number | undefined => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const m = typeof v === "string" ? /-?\d+(\.\d+)?/.exec(v) : null;
  return m ? Number(m[0]) : undefined;
};
const field = (o: Json, ...names: string[]): unknown => {
  for (const n of names) if (o[n] !== undefined && o[n] !== null) return o[n];
  return undefined;
};

/** A special rule given as "Tough(3)", or as `{ name: "Tough", rating: 3 }`. */
function ruleName(r: unknown): string | undefined {
  if (typeof r === "string") return r.trim() || undefined;
  if (!isObj(r)) return undefined;
  const name = str(field(r, "name", "label", "key"));
  if (!name) return undefined;
  const rating = str(field(r, "rating", "value", "x"));
  return rating && !name.includes("(") ? `${name}(${rating})` : name;
}

function rulesOf(v: unknown): { names: string[]; texts: Record<string, string> } {
  const names: string[] = [];
  const texts: Record<string, string> = {};
  for (const r of Array.isArray(v) ? v : []) {
    const name = ruleName(r);
    if (!name || names.includes(name)) continue;
    names.push(name);
    const text = isObj(r) ? str(field(r, "description", "text")) : undefined;
    if (text) texts[name] = text;
  }
  return { names, texts };
}

function weaponFromJson(w: unknown): WeaponSpec | null {
  if (!isObj(w)) return null;
  const name = str(field(w, "name", "label"));
  if (!name) return null;
  const rules = rulesOf(field(w, "specialRules", "rules", "special")).names;
  const ap = numOf(field(w, "ap", "AP"));
  // A rules list that carries AP keeps it there; an `ap` field adds it.
  if (ap && !rules.some((r) => /^ap\b/i.test(r))) rules.push(`AP(${ap})`);
  return {
    name,
    range: numOf(field(w, "range", "rng")) ?? 0,
    attacks: str(field(w, "attacks", "a")) ?? "1",
    rules,
    ...(numOf(field(w, "count", "amount", "qty")) !== undefined
      ? { count: numOf(field(w, "count", "amount", "qty"))! }
      : {}),
  };
}

/** Gear with no attacks of its own (a shield, a banner): the rules it gives the unit. */
function itemRules(w: unknown): string[] {
  if (!isObj(w) || field(w, "attacks", "a") !== undefined || Array.isArray(w.profiles)) return [];
  return rulesOf(field(w, "content", "specialRules", "rules")).names;
}

/** A piece of gear as weapons: one, or one for each profile of a weapon with several. */
function weaponsFromJson(w: unknown): WeaponSpec[] {
  if (!isObj(w)) return [];
  if (Array.isArray(w.profiles)) {
    const count = field(w, "count", "amount", "qty");
    return w.profiles.flatMap(
      (p) => weaponFromJson(isObj(p) && count !== undefined ? { count, ...p } : p) ?? [],
    );
  }
  if (field(w, "attacks", "a") === undefined && field(w, "content") !== undefined) return [];
  return weaponFromJson(w) ? [weaponFromJson(w)!] : [];
}

function unitFromJson(u: unknown, warnings: string[]): UnitSpec | null {
  if (!isObj(u)) return null;
  const name = str(field(u, "customName", "name", "label"));
  if (!name) return null;
  if (field(u, "joinToUnit", "joinedTo") !== undefined)
    warnings.push(`${name} joins another unit in the list: set it up beside that unit`);
  const quality = numOf(field(u, "quality", "qua", "q", "Q"));
  const defense = numOf(field(u, "defense", "defence", "def", "d", "D"));
  if (quality === undefined || defense === undefined)
    warnings.push(`${name}: no ${quality === undefined ? "quality" : "defense"} in the list; 4+ used`);
  const { names, texts } = rulesOf(field(u, "specialRules", "rules", "special"));
  const gear = field(u, "loadout", "equipment", "weapons");
  for (const r of (Array.isArray(gear) ? gear : []).flatMap(itemRules)) if (!names.includes(r)) names.push(r);
  const points = numOf(field(u, "cost", "points", "pts"));
  return {
    name,
    size: numOf(field(u, "size", "models", "count")) ?? 1,
    quality: quality ?? 4,
    defense: defense ?? 4,
    ...(points !== undefined ? { points } : {}),
    rules: names,
    texts,
    weapons: (Array.isArray(gear) ? gear : []).flatMap(weaponsFromJson),
  };
}

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

/** Split at commas outside brackets. */
function topLevel(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of s) {
    if (ch === "(" || ch === "[") depth++;
    if (ch === ")" || ch === "]") depth = Math.max(0, depth - 1);
    if (ch === "," && depth === 0) {
      if (cur.trim()) out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

const HEADER = /^(.+?)\s*\[(\d+)\]\s*Q\s*(\d)\+?\s*D\s*(\d)\+?\s*(.*)$/i;

/** "5x Long Rifle (24", A1, AP(1))" or "Knife (A1)". */
function weaponFromText(part: string): WeaponSpec | null {
  const m = /^(?:(\d+)\s*x\s*)?(.+?)\s*\((.*)\)\s*$/i.exec(part.trim());
  if (!m) return null;
  let range = 0;
  let attacks = "1";
  const rules: string[] = [];
  for (const bit of topLevel(m[3]!)) {
    const r = /^(\d+)\s*(?:"|''|in\b)/i.exec(bit);
    const a = /^A\s*(\d+|D\d+)$/i.exec(bit);
    if (r) range = Number(r[1]);
    else if (a) attacks = a[1]!;
    else rules.push(bit);
  }
  return { name: m[2]!.trim(), range, attacks, rules, ...(m[1] ? { count: Number(m[1]) } : {}) };
}

/** A unit header's tail: "| 120pts | Fearless, Tough(3)". */
function tail(rest: string): { points?: number; rules: string[] } {
  let points: number | undefined;
  const rules: string[] = [];
  for (const part of rest
    .split("|")
    .map((p) => p.trim())
    .filter(Boolean)) {
    const pts = /^(\d+)\s*(?:pts|points|p)\.?$/i.exec(part);
    if (pts) points = Number(pts[1]);
    else rules.push(...topLevel(part));
  }
  return { ...(points !== undefined ? { points } : {}), rules };
}

/** Read a text list: the units it has, and a name from a first line that isn't a unit. */
function parseQd6Text(text: string): { name?: string; units: UnitSpec[] } {
  const units: UnitSpec[] = [];
  let name: string | undefined;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/^[+\-*\s]+|[+\s]+$/g, "").trim();
    if (!line) continue;
    const h = HEADER.exec(line);
    if (h) {
      const { points, rules } = tail(h[5]!);
      units.push({
        name: h[1]!.trim(),
        size: Number(h[2]),
        quality: Number(h[3]),
        defense: Number(h[4]),
        ...(points !== undefined ? { points } : {}),
        rules,
        weapons: [],
      });
      continue;
    }
    const unit = units[units.length - 1];
    const gear = topLevel(line).map(weaponFromText);
    if (unit && gear.length && gear.every((g) => g)) unit.weapons.push(...(gear as WeaponSpec[]));
    else if (!units.length && !name) name = line.replace(/\[[^\]]*\]/g, "").trim() || undefined;
  }
  return { ...(name ? { name } : {}), units };
}

/** The units a JSON list holds, and its name. */
function parseQd6Json(data: unknown, warnings: string[] = []): { name?: string; units: UnitSpec[] } {
  const root = isObj(data) ? data : { units: data };
  const holder = isObj(root.list) ? root.list : isObj(root.army) ? root.army : root;
  const list = field(holder, "units", "entries");
  const units = (Array.isArray(list) ? list : []).flatMap((u) => unitFromJson(u, warnings) ?? []);
  const name = str(field(holder, "name", "title")) ?? str(field(root, "name", "title"));
  return { ...(name ? { name } : {}), units };
}

/** The units list of a unit builder's JSON export, wherever it sits. */
function builderUnits(data: unknown): unknown[] | null {
  const root = isObj(data) ? data : { units: data };
  const holder = isObj(root.list) ? root.list : isObj(root.army) ? root.army : root;
  const list = field(holder, "units", "entries");
  return Array.isArray(list) ? list : null;
}

/**
 * Whether JSON looks like a unit builder's export this game reads: no
 * format line, and units with a quality and a defense. Lets a dropped file
 * or a shared link open as an army (src/share/links.ts).
 */
export function isQualityList(data: unknown): boolean {
  if (isObj(data) && data.format !== undefined) return false;
  const units = builderUnits(data);
  return (
    !!units?.length &&
    units.every(isObj) &&
    units.some(
      (u) =>
        field(u as Json, "quality", "qua") !== undefined &&
        field(u as Json, "defense", "defence") !== undefined,
    )
  );
}

/** A unit builder's JSON export, mapped into Army list v1 (the adapter). */
export function builderArmyList(data: unknown, fallbackName: string, warnings: string[] = []): ArmyListV1 {
  const parsed = parseQd6Json(data, warnings);
  const root = isObj(data) ? data : {};
  const points =
    numOf(field(root, "listPoints", "points")) ?? numOf(isObj(root.list) ? root.list.points : undefined);
  return { ...toArmyList(parsed.name ?? fallbackName, parsed.units), ...(points ? { points } : {}) };
}

/** Read a list file (Army list v1, a unit builder's JSON, or text) into an army for the table. */
export async function importQd6List(fileName: string, data: Uint8Array): Promise<ImportedRoster> {
  const text = new TextDecoder().decode(data).replace(/^\uFEFF/, "");
  const warnings: string[] = [];
  const fallback = fileName.replace(/\.[^.]+$/, "");
  const trimmed = text.trim();
  let list: ArmyListV1;
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    let json: unknown;
    try {
      json = JSON.parse(trimmed);
    } catch {
      throw new Error(`${fileName} isn't a list this game reads: the JSON doesn't parse`);
    }
    const format = (json as { format?: unknown } | null)?.format;
    // Another format, or a later major of Army list: turned away, never half-read.
    if (!isArmyList(json) && format !== undefined)
      throw new Error(`${fileName} is a ${String(format)} file, which this game doesn't read`);
    list = isArmyList(json) ? json : builderArmyList(json, fallback, warnings);
  } else {
    const parsed = parseQd6Text(text);
    list = toArmyList(parsed.name ?? fallback, parsed.units);
  }
  if (!list.units.length)
    throw new Error(`No units found in ${fileName}: expected lines like "Wardens [5] Q4+ D4+ | 100pts"`);
  for (const u of list.units) if (!u.weapons?.length) warnings.push(`${u.name}: no weapons in the list`);
  const roster = readQd6ArmyList(list);
  return { ...roster, warnings: [...warnings, ...roster.warnings] };
}
