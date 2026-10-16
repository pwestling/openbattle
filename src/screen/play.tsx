// What every part of the table screen shares: the moment shown, who you are, and how to act.
import { createContext, useContext, useRef } from "react";
import type { Action, PlayerId, Table } from "../record/index.ts";
import type { Session, Snapshot } from "../session/index.ts";

export interface Play {
  session: Session;
  now: Snapshot;
  /** The table shown: now, or an earlier moment while looking back through the log. */
  table: Table;
  /** This browser's player, or null for a spectator. */
  me: PlayerId | null;
  /** The log number being looked back at, or null for now. */
  lookingAt: number | null;
  /** True for spectators, while the host is away, and while looking back. */
  readOnly: boolean;
  /** Sends an action; on refusal shows a short note saying why and resolves false. */
  act(action: Action): Promise<boolean>;
  note(text: string): void;
  /** Selects these models or terrain pieces on the table. */
  select(ids: string[]): void;
  /** A fresh id for something this player creates. */
  newId(): string;
}

export const PlayContext = createContext<Play | null>(null);

export function usePlay(): Play {
  const play = useContext(PlayContext);
  if (!play) throw new Error("usePlay outside the table");
  return play;
}

/**
 * A value quick clicks build on. While changes this browser sent are still on their way it is the
 * last one sent, so a second click doesn't repeat the first; once they are all back it is the one shown.
 */
export function useBuildOn<T>(shown: T): { get(): T; send(next: T, sending: Promise<unknown>): void } {
  const state = useRef({ value: shown, shown, pending: 0 });
  state.current.shown = shown;
  if (state.current.pending === 0) state.current.value = shown;
  return {
    get: () => state.current.value,
    send(next, sending) {
      const s = state.current;
      s.value = next;
      s.pending++;
      void sending.finally(() => {
        if (--s.pending === 0) s.value = s.shown;
      });
    },
  };
}

/** Which edge a player sits at: the first to join at the near edge (y = 0), the second at the far one. */
export function edgeOf(table: Table, player: PlayerId | null): number {
  const seat = player ? Object.keys(table.players).indexOf(player) : -1;
  return seat === 0 ? -1 : seat === 1 ? 1 : 0;
}

export function playerName(table: Table, player: PlayerId | null | undefined): string {
  return (player && table.players[player]?.name) || "Someone";
}
