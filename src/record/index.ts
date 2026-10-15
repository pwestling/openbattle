// Record: the log and the table it folds to. Realizes design/surfaces/record.html.
// Pure functions over plain data: no network, storage, clock or randomness.
import { problemWith } from "./check.ts";
import { fold } from "./fold.ts";
import { sha256 } from "./sha256.ts";
import type { Action, Log, PlayerId, Problem, Size, Table } from "./types.ts";

export type * from "./types.ts";
export { guestStatement, playerIdOf } from "./keys.ts";

export function newLog(size: Size, link: string, host: PlayerId): Log {
  return { size: { width: size.width, depth: size.depth }, link, host, entries: [] };
}

export function check(log: Log, action: Action, by: PlayerId): Problem | null {
  const problem = problemWith(log, fold(log, log.entries.length), action, by);
  return problem === null ? null : { problem };
}

export function append(log: Log, action: Action, by: PlayerId): Log {
  const problem = check(log, action, by);
  if (problem) throw new Error(problem.problem);
  return { size: log.size, link: log.link, host: log.host, entries: [...log.entries, { n: log.entries.length + 1, by, action: structuredClone(action) }] };
}

export function tableAt(log: Log, upTo: number = log.entries.length): Table {
  return fold(log, upTo);
}

/** The first 16 hex digits of the SHA-256 of the table written out with its keys in sorted order. */
export function fingerprint(table: Table): string {
  return sha256(canonical(table)).slice(0, 16);
}

/** JSON with every object's keys sorted, so equal tables give equal text however they were built. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const keys = Object.keys(value).filter((k) => (value as { [k: string]: unknown })[k] !== undefined).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical((value as { [k: string]: unknown })[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
