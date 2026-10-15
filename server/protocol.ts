// The relay's published protocol on WebSocket /signal?game={link}. Realizes design/surfaces/relay.html.
// The link module speaks it; nothing else does. The Link+Relay build owns this file.

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

/** Stays the same for one browser across visits. */
export type BrowserId = string;

/** Sent by a browser. The first message announces it; after that it forwards handshake data. */
export type ToRelay = { kind: "hello"; browser: BrowserId } | { kind: "signal"; to: BrowserId; data: Json };

/** Sent by the relay. */
export type FromRelay =
  | { kind: "here"; browsers: BrowserId[] }
  | { kind: "arrived"; browser: BrowserId }
  | { kind: "left"; browser: BrowserId }
  | { kind: "signal"; from: BrowserId; data: Json };

/** The largest message the relay accepts, in bytes (ADR-020: protects the server). */
export const maxMessage = 64 * 1024;

/** Game links are letters, digits, - and _. */
export const linkPattern = /^[A-Za-z0-9_-]+$/;
