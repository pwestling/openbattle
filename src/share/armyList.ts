import type { BaseShape } from "../core";

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
type ArmyListRule = string | { name: string; rating?: number | string; text?: string };

interface ArmyListWeapon {
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
