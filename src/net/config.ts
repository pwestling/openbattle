/**
 * Where peers find each other. By default browsers meet through public Nostr
 * relays (only the WebRTC handshake goes through them). If those are
 * unreliable, run your own signalling relay (`pnpm relay`, see README) and
 * point the app at it. Players behind strict NATs may also need a TURN server.
 *
 * Settings come from the page URL (so an invite link carries them), from the
 * site's own config.json (a self-hosted server, see docs/self-host.md: built
 * with VITE_SITE_CONFIG=config.json) or from build-time env vars, in that order:
 *   ?signal=wss://relay.example.com        VITE_SIGNAL_URL
 *   ?nostr=wss://a.example,wss://b.example VITE_NOSTR_RELAYS
 *   ?turn=turn:host:3478&turnUser=u&turnPass=p
 *                                          VITE_TURN_URL, VITE_TURN_USER, VITE_TURN_PASS
 *   ?forceTurn=1   send everything through TURN, to test a TURN server
 *   VITE_TURN_CONFIG=https://turn.example.workers.dev/
 *                  a TURN login service (server/turn-worker.mjs, #77): fresh,
 *                  short-lived logins fetched as the page opens; without it,
 *                  or while it doesn't answer, there's no TURN (STUN only)
 */
export interface NetConfig {
  /** Self-hosted WebSocket signalling relays; when set, Nostr is not used. */
  signal: string[];
  /** Custom Nostr relays (default: Trystero's public list). */
  nostr: string[];
  turn: RTCIceServer[];
  /** Only connect through TURN (a test of the TURN server). */
  forceTurn?: boolean;
}

/** A site's config.json (docs/protocols/servers.md). @public */
export type SiteConfig = Partial<NetConfig>;

const list = (v: string | null | undefined) =>
  (v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

/** What the site's config.json said, once loaded. */
let site: SiteConfig = {};

/**
 * Fetch the site's config.json when this build asks for one. A self-hosted
 * server answers it with its relay and fresh TURN logins (server/relay.mjs).
 * Never throws: without it the app falls back to the defaults.
 */
export async function loadSiteConfig(
  url = import.meta.env.VITE_SITE_CONFIG as string | undefined,
): Promise<void> {
  if (!url) return;
  try {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(3000) });
    if (!res.ok) return;
    const body = (await res.json()) as SiteConfig;
    site = {
      ...(Array.isArray(body.signal) && body.signal.length ? { signal: body.signal } : {}),
      ...(Array.isArray(body.nostr) && body.nostr.length ? { nostr: body.nostr } : {}),
      ...(Array.isArray(body.turn) && body.turn.length ? { turn: body.turn } : {}),
    };
  } catch {
    // An unreachable or malformed config.json is the same as none.
  }
}

/** TURN logins from the login service (VITE_TURN_CONFIG), and when they were fetched. */
let minted: { turn: RTCIceServer[]; at: number; ttl: number } | null = null;
let minting: Promise<void> | null = null;

function mint(url: string): Promise<void> {
  minting = (async () => {
    try {
      const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(5000) });
      const body = (await res.json()) as { turn?: RTCIceServer[]; ttl?: number };
      const turn = Array.isArray(body.turn)
        ? body.turn.filter((s) => s && s.urls && typeof s.username === "string")
        : [];
      if (turn.length) minted = { turn, at: Date.now(), ttl: Math.max(600, Number(body.ttl) || 3600) };
    } catch {
      // No logins: games still connect wherever STUN is enough.
    }
  })();
  return minting;
}

/**
 * Fetch TURN logins from the site's login service (#77), if this build has
 * one, and fetch fresh ones before they run out while the page stays open.
 * Never throws and never holds up the page.
 */
export function loadTurnLogins(url = import.meta.env.VITE_TURN_CONFIG as string | undefined): void {
  if (!url || minting) return;
  void mint(url);
  setInterval(() => {
    if (!minted || Date.now() - minted.at > (minted.ttl * 1000) / 2) void mint(url);
  }, 60_000);
}

export function netConfig(search = typeof location === "undefined" ? "" : location.search): NetConfig {
  const q = new URLSearchParams(search);
  const env = import.meta.env;
  const turnUrls = list(q.get("turn") ?? (site.turn ? null : env.VITE_TURN_URL));
  const username = q.get("turnUser") ?? env.VITE_TURN_USER;
  const credential = q.get("turnPass") ?? env.VITE_TURN_PASS;
  const fromUrl = (key: string) => (q.has(key) ? list(q.get(key)) : null);
  const signal = fromUrl("signal") ?? site.signal ?? list(env.VITE_SIGNAL_URL);
  return {
    signal,
    nostr: fromUrl("nostr") ?? site.nostr ?? list(env.VITE_NOSTR_RELAYS),
    turn: turnUrls.length
      ? [{ urls: turnUrls, ...(username ? { username, credential } : {}) }]
      : (site.turn ?? minted?.turn ?? []),
    ...(q.get("forceTurn") === "1" ? { forceTurn: true } : {}),
  };
}
