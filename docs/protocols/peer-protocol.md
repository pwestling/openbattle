# Peer protocol

**`PROTOCOL = 11`** (`src/protocol.ts`). Schemas: [peer-message.v11](../../schemas/peer-message.v11.schema.json) and [side-message.v2](../../schemas/side-message.v2.schema.json). Code: `src/net/transport.ts` and `src/net/session.ts`.

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

| Field       | Meaning                                                                                                                      |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `seq`       | Its number, counting up from the record's `initial.seq`                                                                      |
| `by`        | The player who asked for it                                                                                                  |
| `at`        | The host's clock (ms). For replays only, never for rules                                                                     |
| `event`     | The event: `{ type: "<area>/<verb>", ... }`, defined in `src/core/actions.ts`                                                |
| `host`      | The peer that was host when it was logged                                                                                    |
| `reactions` | Optional ordered obligations `{ id, system, macro, args, by, cause, depth }` owed by this trigger; recorded before broadcast |

The events are the core's primitives (entities, quantities, tags, modifiers, moves, dice, secrets, cards and ordered collections, the pointer) and `macro/step`, the envelope in which a rules module logs the primitives it expanded into. The reducer is a pure fold: the same `initial` and events give the same table on every device with the same build, with or without the game's package.

Records use `format: "open-battle/record@9"` ([record.v9](../../schemas/record.v9.schema.json)). Card state is `cards` and `cardCollections`, keyed by ID. Every card has exactly one collection membership; collections have no game role. `collection/add` creates an empty collection, `collection/remove` removes an empty one, `card/add` inserts an identity, `cards/remove` deletes identities and memberships, `cards/move` inserts a batch in request order, and `card/set` updates physical fields, ownership or visibility. Insertion indexes refer to the destination after moved cards are removed; zero is the top and an omitted index appends.

A `collection/shuffle` intent contains the collection ID; its event contains the complete resolved `order`, a permutation of current membership. Only the host draws RNG; a module requests it through `ctx.shuffle`. Replays restore that recorded order, including when a macro resumes after a question. Invalid references, duplicates, out-of-range indexes and malformed permutations do not alter card state.

Card visibility is a trusted-tabletop presentation permission: `"all"` or an explicit player-ID list (empty means nobody). Name/face views are redacted for unauthorized viewers; ownership and face-up orientation do not confer access. Full records still contain identities, assets and order, and the debug inspectors expose them. This is not encrypted private hands or proof of a fair hidden draw. Player-chosen secrets remain a separate commitment/reveal protocol.

Record@9 stores neutral physical geometry, explicit participant seats, resolved effects, accepted ordinary input answers and reaction obligations, not sight/alliance policy or ranked/shared-dice bookkeeping. There is no `settings` field or `settings/set`. `player/join` never allocates a seat; absence means unseated (or preserves an existing recorded seat on rejoin). `player/set` records a nonnegative seat identifier, null to clear it, or omission to preserve it; only the sending identity may edit itself, with existing host/hotseat dispatch authority. Multiple players may share seats; the core infers no relationship or capacity. `player/claim` rebinds identity and its recorded seat, not a two-side position.

Rank keys, dice seed lifecycle and verification metadata remain removed. The host uses injected RNG, including sandbox seeds; replay folds resolved outcomes without RNG or reroll verification. Earlier protocols cannot share current tables, and earlier records/caches are not adapted.

Geometry queries are read-only and deterministic, not new events. Packages choose explicit 2D footprints or 3D bodies/solids/hulls/prisms and interpret raw segment hits/sample ray counts as their own LOS/cover/arc/unit rules ([API 4](packages.md#geometry-api-4-cutover)). Only the primitive effects they emit enter history; folding a record still needs no package. Unsupported old records are rejected and old room caches are not reused under the registry's pre-external-use replacement rule; there is no legacy reader or sight shim.

`macro/start`, `MacroState` and `macro/step` may carry a `reaction` ID. A committed started step consumes its recorded obligation, including a logged execution error. Recovery reconstructs unstarted work from active triggers, not from current hook tables. Trigger undo cancels queued obligations and undoes caused runs; undoing a reaction itself cancels its effects without rerunning it. Duplicate inner triggers have separate IDs, chains stop four runs deep, and branching/composition changes are refused while execution remains owed.

`MacroState.namespace` and every `macro/step.namespace` retain the executable owner's module-state namespace: whole-game system ID or extension manifest ID. `ctx.set` emits `module/set` for that recorded owner. Continuation rejects a different registered owner; completed replay folds primitive effects without dependency/registry access. API 12 and manifest.v3 add strict dependency/hash checks and explicit symbol replacements at composition time.

Macro state records historical-to-current participant mappings and the exact waiting command. Results record effective secret recipients and translated primitive address mappings at execution time. Original command keys remain unchanged; replay rejects premature completion or a changed suspension command. Engine-owned addresses follow identity claims; arbitrary package JSON does not.

Ordinary questions store `{ player, question, input: InputSpec }`. `macro/answer.answer` is a finite JSON value, checked against the recorded domain and named participant before advancing. Each accepted ordinary answer appears in `macro/step.answered: { player, command, value, head }`, even on terminal/error steps; pending scripts also retain result history. Selection order and reference kind/ID survive serialization and claims without opaque-data rewriting. Secret/reveal answers remain strings with the existing checks. Point/pose/path answers propose geometry in inches/radians, never apply a move or impose rule/table bounds. See [input vocabulary](../packages.md#recorded-player-input).

Forced `macro/start` intents may carry `warning: string`, nonempty and only accepted with `force: true`. The host reevaluates the code action, rejects an acknowledged reason that differs from its current warning, and logs the current action reason (or explicit panel acknowledgement) as a primitive `log/note` before effects. A non-forced warned start, failed callback, malformed intent/effect or overlapping macro is not made valid by acknowledgement. Panel reasons are explicit caller acknowledgements, not a host evaluation of a panel callback. `ctx.warn` uses existing ordinary choice inputs and notes, so no new event/record shape is needed.

Undo expands all requested roots through engine-owned structural prerequisites and macro causality. Ownership, containment, collection membership/bounds/permutations, modifiers, secrets and executable composition are structural dependencies; opaque package data is not. Late routed results cannot commit after leave, host demotion or router replacement.

## Outside the log

Side messages (`SideMessage`) are never logged or checksummed. Any peer may send them to any other: `package/want`, `package/part` and `package/status` carry rules packages by SHA-256 in 48 KB base64 parts. The receiver checks the bytes against the hash before keeping them.

## Changing the protocol

- **Allowed within one `PROTOCOL`:** an optional field on a message or event that older builds can do without, and a new side message type. A peer ignores messages whose `t` it doesn't know and fields it doesn't use (`receive` in `src/net/session.ts`).
- **Needs the next `PROTOCOL` and a proposal:** a new event or intent type in the core game (older hosts would reject the intent and older peers can't replay the event), any change to how an existing event changes the table, a new required field, or a change to meeting and authority above.

The schemas are generated from these types, so any such change also shows up as a schema change in review (`pnpm schemas:check`).

## History

| `PROTOCOL` | What changed                                                                                                                                                                                              |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 11         | Recorded macro owner namespaces and package-local extension data; strict dependencies/content pins and explicit symbol providers/replacements; record@9, manifest.v3, module API 12                       |
| 10         | Explicit advisory force/warning acknowledgements, warning notes and stale-reason rejection; warned targets retained, ctx.warn and panel warning contract; record@8 unchanged, module API 10               |
| 9          | Declarative input descriptors, structured JSON macro answers and accepted-answer metadata (including terminal/error steps); choice/multi/scalar/reference/spatial proposals; record@8, module API 9       |
| 8          | Recorded reaction obligations/consumption, reclaimed macro address history, reciprocal membership and structural undo; atomic pinned composition and async authority; record@7, module API 8              |
| 7          | Explicit optional seats and seat changes/clearing; implicit two-side allocation, GameSettings/settings/set and team/opposition helpers removed; record@6, module API 7                                    |
| 6          | Ranked/shared-dice keys, seed lifecycle and verification log metadata removed; injected RNG and resolved outcomes retained; record@5, module API 5                                                        |
| 5          | Neutral geometric queries replace engine LOS/cover/vision policy; explicit blocker shapes; terrain policy fields/settings removed, terrain bags and optional token geometry added; record@4, module API 4 |
| 4          | Neutral cards and ordered collections replace per-player decks/piles; resolved shuffle orders; trusted-tabletop visibility; record format `open-battle/record@3`, module API 3                            |
| 3          | The core rebuilt as physical primitives: entities with `q` and `tags`, modifiers, `pointer/set`, `macro/step`; record format `open-battle/record@2`. Side messages other than packages removed            |
| 2          | Reaction windows and simultaneous phases (gone with the old rules engine)                                                                                                                                 |
| 1          | The first protocol                                                                                                                                                                                        |

Builds on different protocols can't share a table: each shows the other's version in the "can't play together" banner.
