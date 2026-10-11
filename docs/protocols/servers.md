# Servers

Every server the app talks to is open source and lives in `server/`. Anyone may run one, and the app talks to any server that speaks these APIs, so a fork or a club can run its own. The board's API is stable and has its own page, [board-protocol.md](../board-protocol.md). The others are **provisional**: they follow the [shared rules](README.md#the-rules-every-protocol-keeps) (extra fields are ignored, changes only add), and once someone outside this repository depends on one, a change that breaks it moves the API under a `/v2/` prefix.

All of them allow requests from any origin (CORS `*`), use no cookies or accounts, and answer JSON unless noted. Behind the self-host kit's Caddy they also answer under their prefix (`/relay`, `/mailbox`, `/seed`, `/host`). [self-host.md](../self-host.md) covers running them.

## Site config.json

Schema: [site-config.v1](../../schemas/site-config.v1.schema.json). Code: `SiteConfig` and `loadSiteConfig` in `src/net/config.ts`; served by `server/relay.mjs`.

A self-hosted build fetches `config.json` from its own site as it opens, to learn where to meet and which servers to use:

| Field        | Meaning                                                                            |
| ------------ | ---------------------------------------------------------------------------------- |
| `signal`     | WebSocket signalling relays (`wss://…/relay`). When set, Nostr is not used to meet |
| `nostr`      | Nostr relays to meet on instead of the public defaults                             |
| `turn`       | `RTCIceServer` entries, usually short-lived TURN logins                            |
| `mailbox`    | The play-by-mail mailbox's address                                                 |
| `openTables` | `true` turns on the open tables board for this site                                |
| `board`      | The site's own board (`…/relay/board`)                                             |
| `trackers`   | WebTorrent trackers for shared files                                               |
| `seeders`    | Seed nodes for shared files                                                        |
| `hostServer` | A host server players can open games on                                            |

Every field is optional. A field the app doesn't know is ignored, and a malformed or missing file is the same as an empty one. The same settings can come from page parameters ([links.md](links.md#other-links)).

## Signalling relay

`server/relay.mjs`. A Trystero WebSocket relay at `/relay` (only WebRTC handshakes go through it), plus `GET /config.json` (above) and `GET /health.json` (whether the relay and the TURN server answer).

## Mailbox

`server/mailbox.mjs`. Holds play-by-mail files ([files.md](files.md#play-by-mail-turn)) for two players who share a mailbox id. It checks nothing about the game; files are signed and replayed on the receiving device.

| Request                   | Answer                                                                       |
| ------------------------- | ---------------------------------------------------------------------------- |
| `GET /vapid`              | `{ publicKey }`, the web push key, or `{ publicKey: null }`                  |
| `GET /health`             | `{ ok, push }`                                                               |
| `GET /box/<id>?after=<n>` | `{ files: [...] }`: the files with `index` above `n`, oldest first           |
| `POST /box/<id>`          | A mail file. `{ ok, index }`; 409 if a different file already has that index |
| `POST /box/<id>/push`     | `{ player, subscription }`: be told by web push when the other player posts  |

A mailbox id is 20 to 64 characters of `A-Za-z0-9_-`. It is the only key, so it travels only in the invitation.

## Seed node

`server/seeder.mjs`. Keeps shared files by SHA-256 and serves them as torrent web seeds ([sharing-files.md](../sharing-files.md)).

| Request                 | Answer                                                                                                                                   |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /info`             | `{ ok, contact, maxFileBytes, ttlDays }`                                                                                                 |
| `PUT /blob/<sha256>`    | The file's bytes. 201 when kept, 200 if already here, 400 if the bytes don't hash to the name, 413 too big, 429 too many, 451 taken down |
| `GET /blob/<sha256>`    | The bytes (`application/octet-stream`, `Range` supported, cacheable for ever)                                                            |
| `HEAD /blob/<sha256>`   | Whether it's here                                                                                                                        |
| `DELETE /blob/<sha256>` | With `Authorization: Bearer <admin token>`: drop it and block the hash                                                                   |

## Host server

`server/host.mjs`. Sits in a room as its host from a machine that stays on, for built-in game systems only.

| Request                   | Answer                                                |
| ------------------------- | ----------------------------------------------------- |
| `GET /info`               | `{ build, rooms, maxRooms }`                          |
| `POST /rooms`             | `{ room, system?, teamSize? }`: host a new game there |
| `GET /rooms/<room>`       | `{ hosted }`                                          |
| `POST /rooms/<room>/wake` | Come back to a room it left while it stood empty      |

The host server speaks the [peer protocol](peer-protocol.md) like any player's browser, so its `build` must share the players' `PROTOCOL`.

## TURN logins

`server/turn-worker.mjs` (a Cloudflare Worker). `GET /` answers `{ turn: RTCIceServer[], ttl }`: short-lived TURN logins. The app fetches it as it opens when built with `VITE_TURN_CONFIG` ([cloudflare-turn.md](../cloudflare-turn.md)).
