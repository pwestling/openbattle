# Servers

Every server the app talks to is open source and lives in `server/`. Anyone may run one, and the app talks to any server that speaks these APIs, so a fork or a club can run its own. They are **provisional**: they follow the [shared rules](README.md#the-rules-every-protocol-keeps) (extra fields are ignored, changes only add), and once someone outside this repository depends on one, a change that breaks it moves the API under a `/v2/` prefix.

All of them allow requests from any origin (CORS `*`), use no cookies or accounts, and answer JSON unless noted. Behind the self-host kit's Caddy they also answer under their prefix (`/relay`). [self-host.md](../self-host.md) covers running them.

## Site config.json

Schema: [site-config.v2](../../schemas/site-config.v2.schema.json). Code: `SiteConfig` and `loadSiteConfig` in `src/net/config.ts`; served by `server/relay.mjs`.

A self-hosted build fetches `config.json` from its own site as it opens, to learn where to meet and which servers to use:

| Field    | Meaning                                                                            |
| -------- | ---------------------------------------------------------------------------------- |
| `signal` | WebSocket signalling relays (`wss://…/relay`). When set, Nostr is not used to meet |
| `nostr`  | Nostr relays to meet on instead of the public defaults                             |
| `turn`   | `RTCIceServer` entries, usually short-lived TURN logins                            |

Every field is optional. A field the app doesn't know is ignored, and a malformed or missing file is the same as an empty one.

## Signalling relay

`server/relay.mjs`. A Trystero WebSocket relay at `/relay` (only WebRTC handshakes go through it), plus `GET /config.json` (above) and `GET /health.json` (whether the relay and the TURN server answer).

## TURN logins

`server/turn-worker.mjs` (a Cloudflare Worker). `GET /` answers `{ turn: RTCIceServer[], ttl }`: short-lived TURN logins. The app fetches it as it opens when built with `VITE_TURN_CONFIG` ([cloudflare-turn.md](../cloudflare-turn.md)).
