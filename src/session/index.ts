// Session: one game as this browser takes part in it. Realizes design/surfaces/session.html.
import type { Action, CardId, DeckId, Fingerprint, Log, PlayerId, Size, Table } from "../record/index.ts";

export interface Me {
  name: string;
  colour: string;
}

/** Everything the screen reads, handed over whole after every change (ADR-016). */
export interface Snapshot {
  /** The game's link. */
  link: string;
  /** Who this browser is in the game. */
  who: { player: PlayerId; host: boolean } | { watching: true };
  log: Log;
  table: Table;
  connection: "connecting" | "playing" | "host away";
  /** This browser's table differs from the host's. */
  disagreement: boolean;
  /** False when the browser refuses storage, so the game is not being kept here. */
  kept: boolean;
}

export interface Session {
  act(action: Action): Promise<void>;
  roll(dice: number, sides: number, label?: string): Promise<number[]>;
  draw(deck: DeckId, cards: number, to: "hand" | "table"): Promise<CardId[]>;
  watch(listener: (now: Snapshot) => void): () => void;
  resync(): Promise<void>;
  addFile(source: Blob | URL): Promise<Fingerprint>;
  leave(): void;
}

/** Rejects if the relay cannot be reached. Given a saved log, the new game starts from it in its first player's seat. */
export async function open(size: Size, me: Me, from?: Log): Promise<Session> {
  throw new Error("session.open is not built yet");
}

/** Rejects if the link is malformed. */
export async function enter(link: string, as: Me | "watch"): Promise<Session> {
  throw new Error("session.enter is not built yet");
}
