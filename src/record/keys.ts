// Players' keys and the bytes the other player signs in a sealed exchange (ADR-022).
// The record never checks a signature; Session signs and verifies these exact bytes.
import { sha256Bytes } from "./sha256.ts";
import type { PlayerId } from "./types.ts";

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

export function toBase64url(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i]! << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    const chars = Math.min(4, Math.ceil(((bytes.length - i) * 8) / 6));
    for (let c = 0; c < chars; c++) out += alphabet[(n >> (18 - c * 6)) & 63];
  }
  return out;
}

/** The bytes of base64url text without padding, or null if it isn't that. */
export function fromBase64url(text: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(text) || text.length % 4 === 1) return null;
  const out = new Uint8Array(Math.floor((text.length * 6) / 8));
  let bits = 0;
  let value = 0;
  let at = 0;
  for (const ch of text) {
    value = ((value << 6) | alphabet.indexOf(ch)) & 0xffffff;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[at++] = (value >> bits) & 255;
    }
  }
  return out;
}

/**
 * The player id a browser's key gives: base64url of the first 16 bytes of the SHA-256 of the raw
 * public key, which the join carries as base64url. Null if the key is not base64url.
 */
export function playerIdOf(publicKey: string): PlayerId | null {
  const raw = fromBase64url(publicKey);
  return raw ? toBase64url(sha256Bytes(raw).slice(0, 16)) : null;
}

/** The parts of a roll or a shuffled draw that the other player's signature covers. */
export type Exchange =
  | { kind: "roll"; dice: number; sides: number; seal: string; guestValue: string }
  | { kind: "draw"; deck: string; cards: number; seal: string; guestValue: string };

/**
 * The bytes the other player signs: the UTF-8 of a JSON object with its keys in alphabetical order,
 * holding the game's link, the kind of action, what is rolled or drawn, the seal and their value.
 * {"dice":2,"guestValue":"…","kind":"roll","link":"…","seal":"…","sides":6} for a roll, and
 * {"cards":1,"deck":"…","guestValue":"…","kind":"draw","link":"…","seal":"…"} for a draw.
 */
export function signedBytes(link: string, exchange: Exchange): Uint8Array {
  const fields =
    exchange.kind === "roll"
      ? { dice: exchange.dice, guestValue: exchange.guestValue, kind: "roll", link, seal: exchange.seal, sides: exchange.sides }
      : { cards: exchange.cards, deck: exchange.deck, guestValue: exchange.guestValue, kind: "draw", link, seal: exchange.seal };
  return new TextEncoder().encode(JSON.stringify(fields));
}
