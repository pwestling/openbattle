// What browsers in one game say to each other over the link. Only Session speaks this.
// The host's browser keeps the log; everyone else asks it to add actions and follows along.
import type { Action, Entry, Log, Target } from "../record/index.ts";

/** What a roll or a draw asks for, before any value is chosen. */
export type Ask =
  | { kind: "roll"; dice: number; sides: number; label?: string; about?: Target[] }
  | { kind: "draw"; deck: string; cards: number; to: "hand" | "table" };

export type ToHost =
  /** Sent whenever this browser finds the host connected. "back" is a player returning. */
  | { t: "hello"; as: { name: string; colour: string } | "watch" | "back"; publicKey: string }
  | { t: "act"; id: string; action: Action }
  | { t: "ask"; id: string; ask: Ask }
  /** The other player's half of a sealed exchange: their value, signed with the seal. */
  | { t: "guest"; id: string; guestValue: string; guestSignature: string }
  | { t: "resync" }
  | { t: "file"; fingerprint: string; bytes: string; type: string };

export type FromHost =
  | { t: "log"; log: Log }
  | { t: "entry"; entry: Entry; fingerprint: string }
  | { t: "done"; id: string; n: number }
  | { t: "refused"; id: string; problem: string }
  /** Asks the other player for their value: what is rolled or drawn, in which game, and the host's seal. */
  | { t: "seal"; id: string; ask: Ask; link: string; seal: string }
  | { t: "file"; fingerprint: string; bytes: string; type: string };

export type Message = ToHost | FromHost;

export function isMessage(value: unknown): value is Message {
  return typeof value === "object" && value !== null && typeof (value as { t?: unknown }).t === "string";
}
