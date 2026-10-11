# Peer protocol

**`PROTOCOL = 1`** (`src/protocol.ts`). Stable. Schemas: [peer-message.v1](../../schemas/peer-message.v1.schema.json) (everything) and [side-message.v1](../../schemas/side-message.v1.schema.json) (the part outside the game log). Code: `src/net/transport.ts` (the messages), `src/net/session.ts` (what a peer does with them).

Players' browsers talk directly over WebRTC data channels. This page is what two builds must agree on to share a table. [compatibility.md](../compatibility.md) explains what happens when they don't.

## Meeting

- Peers find each other through Trystero: public Nostr relays by default, or a WebSocket signalling relay (`server/relay.mjs`). The app id is `open-battle-dev`, and the room id comes from the invite link (`?room=`). Signalling carries only the WebRTC handshake.
- Every game message is one JSON value sent on the Trystero action `msg`. Media (voice) travels as WebRTC media streams.
- A peer that isn't the host greets with `hello`. The host answers with `host`. Both carry `v: { protocol, build }`.
- A peer whose `protocol` differs is **parked**: the host sends it no events, drops its intents and never hands it the host role. Both sides show a "can't play together" banner. A peer with the same protocol but another `build` gets a banner only. Builds from before this check send no `v` and are taken to share the protocol.

## Roles and authority

One peer is the **host**. Clients send `intent` messages: what the player wants to do. The host turns each intent into a logged event (rolling any dice) and sends it to everyone as `event`. Late joiners and reconnecting peers get the whole `record`, or the `events` they missed after their `hello` says how far they got. `check` carries the host's state checksum after an earlier event, so a peer that drifted notices. `sync` and `yield` hand the host role over when the host leaves. Spectators receive events, optionally after a `delay`, and send no intents.

## The event log

The log is the game. Each entry is a `LoggedEvent`:

| Field    | Meaning                                                                                      |
| -------- | -------------------------------------------------------------------------------------------- |
| `seq`    | Its number, counting up from the record's `initial.seq`                                      |
| `by`     | The player who asked for it                                                                  |
| `at`     | The host's clock (ms). For replays only, never for rules                                     |
| `event`  | The event: `{ type: "<area>/<verb>", … }`. About 150 types, defined in `src/core/actions.ts` |
| `host`   | The peer that was host when it was logged                                                    |
| `told`   | Its dice were rolled at the real table and typed in                                          |
| `intent` | Under shared dice: the intent it came from, so the other ranked player can roll it again     |
| `seed`   | Under shared dice, for a rules package's event: the seed its sandbox was given               |

Events and intents are versioned together by `PROTOCOL`, not one by one. The reducer is deterministic: the same `initial` and the same events give the same table on every device with the same build and packages. Rules packages add events of their own under their package's namespace. Those are covered by the package's hash, not by `PROTOCOL`.

## Outside the log

Side messages (`SideMessage`) are never logged or checksummed. Any peer may send them to any other:

- **Content by hash:** `asset/want` and `asset/part` (figure and terrain models, by their id), `package/want`, `package/part` and `package/status` (rules packages, by SHA-256), `campaign/want` and `campaign/part` (campaign books, by SHA-256). Content travels in 48 KB base64 parts. The receiver checks package and campaign bytes against the hash before keeping them.
- **Table talk:** `talk` (pings, arrows, areas, lines, chat, reactions), `talk/clear`, `talk/cam`, `talk/moment`, `talk/shake`, `talk/reel`, `talk/drag`, `talk/plan`, `talk/voice`.
- **Review rooms:** `review/lead`, `review/hello`, `review/note`, `review/unnote`, `review/notes`.
- **Armies from a TTS table:** `army/offer`, `army/take`.

## Changing the protocol

- **Allowed within `PROTOCOL = 1`:** an optional field on a message or event that older builds can do without, and a new side message type. A peer ignores any message whose `t` it doesn't know or can't read, and any field it doesn't know (`receive` in `src/net/session.ts`, tested in `src/net/session.test.ts`).
- **Needs `PROTOCOL = 2` and a proposal:** a new event or intent type in the core game (older hosts would reject the intent and older peers can't replay the event), any change to how an existing event changes the table, a new required field, or a change to meeting and authority above.

The schemas are generated from these types, so any such change also shows up as a schema change in review (`pnpm schemas:check`).
