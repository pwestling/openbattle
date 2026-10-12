import type { GameState, PlayerId } from "./types";
import { secretsWithPrefix, type SecretEntry } from "./secrets";

/**
 * Card decks (#75): a table's own decks, such as the mission cards of a
 * Tabletop Simulator save. A card's face is a cell of an image the player
 * brought (TTS sprite sheets), so its text stays in their pictures: the
 * engine only shuffles, deals and shows. Each player plays their own copy of
 * every deck, as with 40k's secondary missions. A card drawn is a secret
 * (core/secrets.ts) keyed `deck:<deck>:<nnn>` whose value is the card's id:
 * drawn on the player's own device, a hidden hand until revealed. Scoring
 * stays with the players.
 */

/** A card's picture: cell `index` (left to right, then down) of a `cols` × `rows` sheet. */
interface CardFace {
  url: string;
  cols: number;
  rows: number;
  index: number;
}

interface Card {
  id: string;
  name: string;
  face: CardFace;
  back?: CardFace;
  /** Laid out wider than tall (TTS's SidewaysCard). */
  sideways?: boolean;
}

export interface CardDeck {
  id: string;
  name: string;
  cards: Card[];
}

/** A player's discards from one deck, and those shuffled back in. */
export interface CardPile {
  discarded: string[];
  returned: string[];
}

const MAX_DECKS = 40;
const MAX_CARDS = 300;

const text = (x: unknown, n: number) => (typeof x === "string" ? x.trim().slice(0, n) : "");

/** A picture's address, if it's a web one: it ends up in a stylesheet's url(). */
function cleanUrl(x: unknown): string | null {
  const s = text(x, 2000);
  if (!/^https?:\/\/[^\s"'()\\]+$/i.test(s)) return null;
  return s;
}

function cleanFace(x: unknown): CardFace | null {
  const f = x as Partial<CardFace> | null;
  const url = cleanUrl(f?.url);
  if (!url) return null;
  const cols = Math.max(1, Math.min(10, Math.floor(Number(f!.cols) || 1)));
  const rows = Math.max(1, Math.min(10, Math.floor(Number(f!.rows) || 1)));
  const index = Math.max(0, Math.min(cols * rows - 1, Math.floor(Number(f!.index) || 0)));
  return { url, cols, rows, index };
}

/** Decks as they arrive with a table: only what can be shown, within bounds. */
export function cleanDecks(x: unknown): CardDeck[] {
  if (!Array.isArray(x)) return [];
  const ids = new Set<string>();
  return x.slice(0, MAX_DECKS).flatMap((d: Partial<CardDeck> | null) => {
    const id = text(d?.id, 40);
    if (!id || ids.has(id) || !Array.isArray(d!.cards)) return [];
    ids.add(id);
    const seen = new Set<string>();
    const cards = d!.cards.slice(0, MAX_CARDS).flatMap((c: Partial<Card> | null) => {
      const cid = text(c?.id, 40);
      const face = cleanFace(c?.face);
      if (!cid || seen.has(cid) || !face) return [];
      seen.add(cid);
      const back = cleanFace(c!.back);
      return [
        {
          id: cid,
          name: text(c!.name, 80),
          face,
          ...(back ? { back } : {}),
          ...(c!.sideways ? { sideways: true } : {}),
        },
      ];
    });
    return cards.length ? [{ id, name: text(d!.name, 80) || "Cards", cards }] : [];
  });
}

export const deckPrefix = (deck: string) => `deck:${deck}:`;

/** Every card this player has drawn from the deck, in order. */
export function drawn(state: GameState, player: PlayerId, deck: string): [string, SecretEntry][] {
  return secretsWithPrefix(state, player, deckPrefix(deck));
}

export function pileOf(state: GameState, player: PlayerId, deck: string): CardPile {
  return state.cardPiles?.[player]?.[deck] ?? { discarded: [], returned: [] };
}

/** Cards in hand: drawn, not discarded, not shuffled back. */
export function inHand(state: GameState, player: PlayerId, deck: string): [string, SecretEntry][] {
  const pile = pileOf(state, player, deck);
  return drawn(state, player, deck).filter(
    ([k]) => !pile.discarded.includes(k) && !pile.returned.includes(k),
  );
}
