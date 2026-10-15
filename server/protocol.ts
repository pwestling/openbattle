// The relay's published protocol. Realizes design/surfaces/relay.html.
// The link module speaks it; nothing else does. The Link+Relay build owns this file.
// Changes only add, within a version.

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

/** Stays the same for one browser across visits. */
export type BrowserId = string;

/**
 * Sent by a browser on WebSocket /signal?game={link}. The first message must be hello, answering the
 * relay's challenge; after that the browser only forwards handshake data to another browser under the same link.
 * In hello, browser must be the id worked out from publicKey (ADR-022), and signature is publicKey's
 * signature of helloText(nonce, game).
 */
export type ToRelay =
  | { kind: "hello"; browser: BrowserId; publicKey: string; signature: string }
  | { kind: "signal"; to: BrowserId; data: Json };

/**
 * Sent by the relay. "challenge" comes first, as soon as the socket opens. "here" answers hello with the other browsers already announced under the link.
 * "signal" carries handshake data; from is set by the relay, never by the sender.
 */
export type FromRelay =
  | { kind: "challenge"; nonce: string }
  | { kind: "here"; browsers: BrowserId[] }
  | { kind: "arrived"; browser: BrowserId }
  | { kind: "left"; browser: BrowserId }
  | { kind: "signal"; from: BrowserId; data: Json };

/** The largest message the relay accepts, in bytes (ADR-020: protects the server). Larger closes the socket. */
export const maxMessage = 64 * 1024;

/** Game links are letters, digits, - and _. */
export const linkPattern = /^[A-Za-z0-9_-]+$/;

/**
 * What a browser signs to announce itself: the relay's nonce and the game link, so a hello can't be
 * replayed elsewhere. ECDSA P-256 with SHA-256, signature as raw r||s, base64url, like every key here.
 */
export const helloText = (nonce: string, game: string) => `openbattle relay hello\n${nonce}\n${game}`;

/** Socket close codes the relay uses, beyond the standard ones. */
export const closeCode = {
  /** The first message was not hello, or a message was not in this protocol. */
  notProtocol: 4000,
  /** The same browser announced itself again under this link, from another tab or visit; the newest one stays. */
  replaced: 4001,
  /** hello's signature or id does not match its public key. */
  notProven: 4002,
} as const;

/** GET /turn answers this, shaped as an RTCIceServer. Valid for 24 hours; 503 when TURN is not configured. */
export type TurnCredentials = { urls: string[]; username: string; credential: string };

/** GET /health answers this. */
export type Health = { signal: boolean; turn: boolean };
