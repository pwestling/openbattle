// Record: the log and the table it folds to. Realizes design/surfaces/record.html.
// Pure functions over plain data: no network, storage, clock or randomness.
import type { Action, Log, PlayerId, Problem, Size, Table } from "./types.ts";

export type * from "./types.ts";

const notYet = (op: string): never => {
  throw new Error(`record.${op} is not built yet`);
};

export function newLog(size: Size): Log {
  return notYet("newLog");
}

export function check(log: Log, action: Action, by: PlayerId): Problem | null {
  return notYet("check");
}

export function append(log: Log, action: Action, by: PlayerId): Log {
  return notYet("append");
}

export function tableAt(log: Log, upTo?: number): Table {
  return notYet("tableAt");
}

export function fingerprint(table: Table): string {
  return notYet("fingerprint");
}
