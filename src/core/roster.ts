/**
 * An army list as the app reads it in: units, their models and sheets. Every
 * game's roster reader (a package's `readArmyList`, a shelf army, an Army list v1
 * file) produces this.
 */
import type { Army, BaseShape, Characteristics, StandInLook, UnitSheet } from "./types";

// ---------------------------------------------------------------------------
// Public result types
// ---------------------------------------------------------------------------

interface ImportedModel {
  profile: { name: string; chars: Characteristics };
  /** Keys of `sheet.weapons`; a key repeats if the model carries two. */
  weapons: string[];
  /** Its own base, when it differs from the unit's (a character on a bigger base). */
  base?: BaseShape;
  /** Its stand-in figure's shape and colour (a game's own sample armies). */
  look?: StandInLook;
  /** Its height in inches, for line of sight; from the base when missing. */
  height?: number;
  /** Where it stood on the table it came from (a TTS save, #73): deployed there, on the deploying side. */
  at?: { x: number; y: number; facing: number };
}

export interface ImportedUnit {
  name: string;
  sheet: UnitSheet;
  models: ImportedModel[];
  base: BaseShape;
  /** Characteristics the roster left blank, for the player to fill in before deploying. */
  missing?: string[];
  /** A suggested frontage for a ranked block (rank-and-flank sample armies). */
  files?: number;
  /** Starts in reserves, off the table (a TTS unit still in its bag). */
  reserve?: boolean;
}

export interface ImportedRoster {
  name: string;
  points?: number;
  /** The army's own colour (a package's faction): its player takes it on deploying, unless someone has it. */
  color?: string;
  units: ImportedUnit[];
  /** The detachment, its rules and stratagems (#49); none when the roster names none. */
  army?: Army;
  /** Packages the list says it was written for (Army list v1 `packages`): offered before playing. */
  named?: { url: string; sha256?: string }[];
  warnings: string[];
}
