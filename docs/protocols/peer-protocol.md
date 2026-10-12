# Peer protocol

**`PROTOCOL = 3`** (`src/protocol.ts`). Schemas: [peer-message.v3](../../schemas/peer-message.v3.schema.json) (everything) and [side-message.v2](../../schemas/side-message.v2.schema.json) (the part outside the game log). Code: `src/net/transport.ts` (the messages), `src/net/session.ts` (what a peer does with them).

Players' browsers talk directly over WebRTC data channels. This page is what two builds must agree on to share a table. [compatibility.md](../compatibility.md) explains what happens when they don't.

## Meeting

- Peers find each other through Trystero: public Nostr relays by default, or a WebSocket signalling relay (`server/relay.mjs`). The app id is `open-battle-dev`, and the room id comes from the invite link (`?room=`). Signalling carries only the WebRTC handshake.
- Every game message is one JSON value sent on the Trystero action `msg`.
- A peer that isn't the host greets with `hello`. The host answers with `host`. Both carry `v: { protocol, build }`.
- A peer whose `protocol` differs is **parked**: the host sends it no events, drops its intents and never hands it the host role. Both sides show a "can't play together" banner. A peer with the same protocol but another `build` gets a banner only. Builds from before this check send no `v` and are taken to share the protocol.

## Roles and authority

One peer is the **host**. Clients send `intent` messages: what the player wants to do. The host turns each intent into a logged event (rolling any dice) and sends it to everyone as `event`. Late joiners and reconnecting peers get the whole `record`, or the `events` they missed after their `hello` says how far they got. `check` carries the host's state checksum after an earlier event, so a peer that drifted notices. `sync` and `yield` hand the host role over when the host leaves. Spectators receive events, optionally after a `delay`, and send no intents.

## The event log

The log is the game. Each entry is a `LoggedEvent` (`src/core/log.ts`):

| Field    | Meaning                                                                                  |
| -------- | ---------------------------------------------------------------------------------------- |
| `seq`    | Its number, counting up from the record's `initial.seq`                                  |
| `by`     | The player who asked for it                                                              |
| `at`     | The host's clock (ms). For replays only, never for rules                                 |
| `event`  | The event: `{ type: "<area>/<verb>", ... }`, defined in `src/core/actions.ts`            |
| `host`   | The peer that was host when it was logged                                                |
| `told`   | Its dice were rolled at the real table and typed in                                      |
| `intent` | Under shared dice: the intent it came from, so the other ranked player can roll it again |
| `seed`   | Under shared dice, for a macro step: the seed its sandbox was given                      |

The events are the core's primitives (entities, quantities, tags, modifiers, moves, dice, secrets, decks, the pointer) and `macro/step`, the envelope in which a rules module's action logs the primitives it expanded into. The reducer is a pure fold: the same `initial` and the same events give the same table on every device with the same build, with or without the game's rules package. Only the host needs the package, to resolve a new macro.

## Outside the log

Side messages (`SideMessage`) are never logged or checksummed. Any peer may send them to any other: `package/want`, `package/part` and `package/status` carry rules packages by SHA-256 in 48 KB base64 parts. The receiver checks the bytes against the hash before keeping them.

## Changing the protocol

- **Allowed within one `PROTOCOL`:** an optional field on a message or event that older builds can do without, and a new side message type. A peer ignores any message whose `t` it doesn't know or can't read, and any field it doesn't know (`receive` in `src/net/session.ts`, tested in `src/net/session.test.ts`).
- **Needs the next `PROTOCOL` and a proposal:** a new event or intent type in the core game (older hosts would reject the intent and older peers can't replay the event), any change to how an existing event changes the table, a new required field, or a change to meeting and authority above.

The schemas are generated from these types, so any such change also shows up as a schema change in review (`pnpm schemas:check`).

## History

| `PROTOCOL` | What changed                                                                                                                                                                                   |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3          | The core rebuilt as physical primitives: entities with `q` and `tags`, modifiers, `pointer/set`, `macro/step`; record format `open-battle/record@2`. Side messages other than packages removed |
| 2          | Reaction windows and simultaneous phases (gone with the old rules engine)                                                                                                                      |
| 1          | The first protocol                                                                                                                                                                             |

Builds on different protocols can't share a table: each shows the other's version in the "can't play together" banner.
