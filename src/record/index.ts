// Record: the log and the table it folds to. Realizes design/surfaces/record.html.
// Pure functions over plain data: no network, storage, clock or randomness.
import { problemWith } from "./check.ts";
import { fold } from "./fold.ts";
import type { Action, Log, PlayerId, Problem, Size, Table } from "./types.ts";

export type * from "./types.ts";

const notYet = (op: string): never => {
  throw new Error(`record.${op} is not built yet`);
};

export function newLog(size: Size): Log {
  return { size: { width: size.width, depth: size.depth }, entries: [] };
}

export function check(log: Log, action: Action, by: PlayerId): Problem | null {
  const problem = problemWith(log, fold(log, log.entries.length), action, by);
  return problem === null ? null : { problem };
}

export function append(log: Log, action: Action, by: PlayerId): Log {
  const problem = check(log, action, by);
  if (problem) throw new Error(problem.problem);
  return { size: log.size, entries: [...log.entries, { n: log.entries.length + 1, by, action: structuredClone(action) }] };
}

export function tableAt(log: Log, upTo: number = log.entries.length): Table {
  return fold(log, upTo);
}

export function fingerprint(table: Table): string {
  return notYet("fingerprint");
}
