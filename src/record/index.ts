// Record: the log and the table it folds to. Realizes design/surfaces/record.html.
// Pure functions over plain data: no network, storage, clock or randomness.
import { problemWith } from "./check.ts";
import { fold } from "./fold.ts";
import { sha256 } from "./sha256.ts";
import type { Action, Log, PlayerId, Problem, Size, Table } from "./types.ts";

export type * from "./types.ts";
export { guestStatement, playerIdOf } from "./keys.ts";

export function newLog(size: Size, link: string, host: PlayerId): Log {
  return { size: { width: size.width, depth: size.depth }, link, host, copied: 0, entries: [] };
}

/**
 * A new game from a saved one: its entries, copied as they are, under a new link and host. The link
 * gets "-N" on the end, N the number copied, so everyone who has the link knows where the copied
 * entries end, and every signature in the new game covers it; the host can't move it later.
 */
export function reopen(saved: Log, link: string, host: PlayerId): Log {
  const copied = saved.entries.length;
  return { size: saved.size, link: `${link}-${copied}`, host, copied, entries: saved.entries };
}

/**
 * How many copied entries a link says its game starts with. A link is 8 random characters, "-" and
 * the 22-character host id, as Session makes it; a reopened game's link then has "-N". Read by
 * position, since a host id may itself hold "-" and digits.
 */
function copiedIn(link: string): number {
  const ending = /^-(0|[1-9][0-9]*)$/.exec(link.slice(31));
  return ending ? Number(ending[1]) : 0;
}

export function check(log: Log, action: Action, by: PlayerId): Problem | null {
  const problem = badLog(log) ?? problemWith(log, fold(log, log.entries.length), action, by);
  return problem === null ? null : { problem };
}

/**
 * Whether a log that came from elsewhere (another browser, a saved file) could have been built here:
 * every entry after the copied ones is checked again, in order, as append would have checked it.
 */
export function checkLog(log: Log): Problem | null {
  const shape = badLog(log);
  if (shape) return { problem: shape };
  let built: Log = { ...log, entries: log.entries.slice(0, log.copied) };
  for (const entry of log.entries.slice(log.copied)) {
    if (entry.n !== built.entries.length + 1) return { problem: `Action ${entry.n} is out of order.` };
    const problem = check(built, entry.action, entry.by);
    if (problem) return { problem: `Action ${entry.n}: ${problem.problem}` };
    built = { ...built, entries: [...built.entries, entry] };
  }
  return null;
}

function badLog(log: Log): string | null {
  if (typeof log.link !== "string" || typeof log.host !== "string") return "A log needs its game's link and host.";
  if (!Number.isInteger(log.copied) || log.copied < 0 || log.copied > log.entries.length)
    return "A log's copied entries must be some of its first entries.";
  if (log.copied !== copiedIn(log.link)) return "A log's copied entries must be as many as its link says.";
  return null;
}

export function append(log: Log, action: Action, by: PlayerId): Log {
  const problem = check(log, action, by);
  if (problem) throw new Error(problem.problem);
  return { ...log, entries: [...log.entries, { n: log.entries.length + 1, by, action: structuredClone(action) }] };
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
