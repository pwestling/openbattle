// Session: one game as this browser takes part in it. Realizes design/surfaces/session.html.
//
// A game's link is 8 random characters, "-", and the host's browser id (ADR-022), so every browser
// knows who the host is before trusting anything it is sent. A game reopened from a saved file adds
// "-N" (Record's reopen). The address to share is this page with ?game= and the link.
import * as archive from "../archive/index.ts";
import { connect, thisBrowser } from "../link/index.ts";
import { newLog, reopen, tableAt, type Action, type CardId, type DeckId, type Fingerprint, type Log, type Size } from "../record/index.ts";
import { Game, randomValue, type Me, type Snapshot } from "./game.ts";

export type { Me, Snapshot };
export type { Ask } from "./wire.ts";

export interface Session {
  act(action: Action): Promise<void>;
  roll(dice: number, sides: number, label?: string): Promise<number[]>;
  draw(deck: DeckId, cards: number, to: "hand" | "table"): Promise<CardId[]>;
  watch(listener: (now: Snapshot) => void): () => void;
  resync(): Promise<void>;
  addFile(source: Blob | URL): Promise<Fingerprint>;
  leave(): void;
}

const linkShape = /^[A-Za-z0-9_-]{8}-[A-Za-z0-9_-]{22}(-(0|[1-9][0-9]*))?$/;

/** The address to share for a game. */
const addressOf = (id: string) => `${location.origin}/?game=${id}`;

/** The game's link from an address with ?game=, or the link itself. Null if it is not one. */
function gameOf(link: string): string | null {
  let id = link;
  try {
    id = new URL(link).searchParams.get("game") ?? "";
  } catch {
    // Not an address: the link itself.
  }
  return linkShape.test(id) ? id : null;
}

/**
 * Rejects if the relay cannot be reached. Given a saved log, the new game starts from it (Record's
 * reopen), and this browser joins it unless already a player there.
 */
export async function open(size: Size, me: Me, from?: Log): Promise<Session> {
  if (from && Object.keys(tableAt(from).players).length === 0) throw new Error("That saved game has no players.");
  const browser = await thisBrowser();
  const fresh = `${randomValue().slice(0, 8)}-${browser.id}`;
  const log = from ? reopen(from, fresh, browser.id) : newLog(size, fresh, browser.id);
  const link = await connect(log.link);
  const game = new Game(link, log, browser.id, addressOf(log.link), me);
  if (!tableAt(log).players[browser.id]) {
    game.joinAsHost(me, browser.publicKey);
  }
  return game;
}

/** Rejects if the link is malformed. */
export async function enter(link: string, as: Me | "watch"): Promise<Session> {
  const id = gameOf(link);
  if (!id) throw new Error("That is not a game link.");
  const host = id.slice(9, 31);
  const [browser, saved] = await Promise.all([thisBrowser(), archive.load(id)]);
  if (browser.id === host && !saved) throw new Error("This browser started that game but no longer has it.");
  const log = saved?.log.link === id && saved.log.host === host ? saved.log : newLog({ width: 60, depth: 44 }, id, host);
  const known = saved && saved.me !== "watch" && tableAt(log).players[saved.me] ? saved.me : null;
  const joining = known ? "back" : as;
  const game = new Game(await connect(id), log, known ?? "watch", addressOf(id), joining);
  if (browser.id !== host) await game.ready();
  return game;
}
