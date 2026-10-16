// What stored or loaded data must look like before the archive hands it out as a game.
import type { Action, Log } from "../record/index.ts";
import type { Saved } from "./index.ts";

/** Whether stored data has the shape of a saved game; anything else counts as nothing saved. */
export function isSaved(value: unknown): value is Saved {
  if (typeof value !== "object" || value === null) return false;
  const { log, me } = value as Partial<Saved>;
  return typeof me === "string" && isLog(log);
}

export function isLog(value: unknown): value is Log {
  if (typeof value !== "object" || value === null) return false;
  const { size, link, host, copied, entries } = value as Partial<Log>;
  return (
    typeof link === "string" &&
    typeof host === "string" &&
    Number.isInteger(copied) &&
    typeof size === "object" &&
    size !== null &&
    typeof size.width === "number" &&
    typeof size.depth === "number" &&
    Array.isArray(entries) &&
    entries.every(isEntry)
  );
}

// Every kind of action, so a renamed or added kind in the record fails to compile here.
const KINDS: Record<Action["kind"], true> = {
  join: true,
  rename: true,
  "place terrain": true,
  "remove terrain": true,
  "add to army": true,
  move: true,
  "set aside": true,
  return: true,
  group: true,
  ungroup: true,
  phase: true,
  counter: true,
  mark: true,
  roll: true,
  "add deck": true,
  shuffle: true,
  draw: true,
  "move card": true,
  undo: true,
};

/** An entry numbered, by someone, of a known kind. Whether the action makes sense is the record's to judge. */
function isEntry(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const { n, by, action } = value as { n?: unknown; by?: unknown; action?: unknown };
  if (typeof n !== "number" || typeof by !== "string" || typeof action !== "object" || action === null) return false;
  const kind = (action as { kind?: unknown }).kind;
  return typeof kind === "string" && Object.hasOwn(KINDS, kind);
}
