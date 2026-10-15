// What stored or loaded data must look like before the archive hands it out as a game.
import type { Log } from "../record/index.ts";
import type { Saved } from "./index.ts";

/** Whether stored data has the shape of a saved game; anything else counts as nothing saved. */
export function isSaved(value: unknown): value is Saved {
  if (typeof value !== "object" || value === null) return false;
  const { log, me } = value as Partial<Saved>;
  return typeof me === "string" && isLog(log);
}

export function isLog(value: unknown): value is Log {
  if (typeof value !== "object" || value === null) return false;
  const { size, entries } = value as Partial<Log>;
  return (
    typeof size === "object" &&
    size !== null &&
    typeof size.width === "number" &&
    typeof size.depth === "number" &&
    Array.isArray(entries) &&
    entries.every((e: unknown) => typeof e === "object" && e !== null && typeof (e as { n?: unknown }).n === "number")
  );
}
