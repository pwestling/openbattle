# Open Battle protocols

Everything Open Battle writes for someone else to read is a protocol: a file a player saves, a link another site makes, a message between browsers, a server's HTTP API, a rules package's manifest. Forks, mods, tools and other servers build on these, so each one has a version, a written spec, a machine-readable schema where it is JSON, and frozen test files that every later build must still read.

This page lists them all and sets the rules they share. Each spec page says what is special about its own.

## The rules every protocol keeps

1. **Every document says what it is.** Files carry `format: "open-battle/<name>@<major>"`. Other documents carry `v: <major>`. Peers announce `PROTOCOL` when they meet. A server API answers under `/v<major>/`.
2. **Readers ignore what they don't know.** An unknown field is skipped, never an error, so a newer writer can add one without breaking older readers. The schemas allow extra fields for this reason. A writer must not count on an older reader using a field it added.
3. **Within a major version, changes only add.** A new optional field, a new value where readers already skip unknown values, or a new message type that older peers ignore are allowed. Removing, renaming or retyping a field, making one required, or changing what a value means is a new major version.
4. **Readers keep reading every major they ever read** once something outside the repository depends on it. Until then a new major may replace the old one (as the rebuilt core did), saying so here.
5. **A newer major is named, not guessed at.** A reader given a major it doesn't know says the file came from a newer Open Battle. It never opens a newer file the wrong way.
6. **Identity is by content.** Packages are named by the SHA-256 of their bytes. The same bytes always mean the same thing.
7. **The code is the source, the schema follows it.** Schemas are generated from the TypeScript types that read and write each format (`pnpm schemas`). `pnpm schemas:check` fails when a type changes and its schema doesn't, so any change to a protocol shows up in review. Additive changes regenerate the schema. Breaking changes need a new major and a proposal ([GOVERNANCE.md](../../GOVERNANCE.md#changes-that-need-a-proposal)).

**Stability.** _Stable_ protocols follow all the rules above, and changing one needs a proposal. _Provisional_ ones follow the rules but may still get a new major after a short proposal while we learn. _Internal_ ones are not for outside use and may change in any release.

## The registry

| Protocol                              | Version                     | Spec                                                              | Schema                                                                                                                       |
| ------------------------------------- | --------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Game record and replay                | `record@9`                  | [peer-protocol.md](peer-protocol.md)                              | [record.v9](../../schemas/record.v9.schema.json)                                                                             |
| Rules package manifest                | `api: 12` (`MODULE_API`)    | [packages.md](packages.md)                                        | [manifest.v3](../../schemas/manifest.v3.schema.json)                                                                         |
| Module API (`src/sdk`)                | `MODULE_API = 12`           | [../packages.md](../packages.md)                                  | TypeScript types                                                                                                             |
| Peer protocol                         | `PROTOCOL = 11`             | [peer-protocol.md](peer-protocol.md)                              | [peer-message.v11](../../schemas/peer-message.v11.schema.json), [side-message.v2](../../schemas/side-message.v2.schema.json) |
| Site `config.json`                    | none (2)                    | [servers.md](servers.md#site-configjson)                          | [site-config.v2](../../schemas/site-config.v2.schema.json)                                                                   |
| TURN logins                           | none (1)                    | [servers.md](servers.md)                                          | n/a                                                                                                                          |
| Sandbox host messages (`src/sandbox`) | none                        | n/a (internal)                                                    | n/a                                                                                                                          |
| Local package authoring scenario      | `package-scenario@1`        | [package-scenarios.md](package-scenarios.md)                      | [package-scenario.v1](../../schemas/package-scenario.v1.schema.json)                                                         |
| Local package scenario report         | `package-scenario-report@1` | [package-scenarios.md](package-scenarios.md#results-and-failures) | [package-scenario-report.v1](../../schemas/package-scenario-report.v1.schema.json)                                           |

The first release of the rebuilt core broke every older format on purpose (nothing was in use yet); the registry starts again from here. Formats that other builds could read before (armies, tables, figure packs, campaign books, mail files, ranked results, the board) are gone with the features that wrote them, and come back as new protocols when a feature does.

**Current composition cutover:** API 12, record@9, protocol 11, manifest schema v3. Dependencies and content pins are enforced before import; symbols require explicit provider-targeted replacements. Extensions have local module-state namespaces retained in macro state/steps. See [composition](../packages.md#composing-a-game-and-extensions).

**Historical setup/data-intake cutover:** API 11; record@8/protocol 10 unchanged. Frozen actor-specific setup descriptors collect typed fields and arbitrary JSON file/paste data locally, then submit ordinary `form`/`data` arguments to registered macros. Packages own/version their data formats and emit existing primitives; there is no engine army schema. See [setup/data intake](../packages.md#setup-forms-and-player-owned-data).

**Historical advisory-flow cutover:** API 10, record@8, protocol 10. Warned actions retain targets; panel warnings and macro `yield* ctx.warn` use explicit proceed/cancel flows. Forced starts acknowledge a reason and log it using existing primitives. These guarantees remain current. See [advisory flow](../packages.md#advisory-warnings-and-explicit-overrides).

**Historical recorded-input cutover:** API 9, record@8, protocol 9. `ctx.input` descriptors and JSON answers support choices, multiple/ordered selections, scalars, explicit references and spatial proposals. `ctx.ask` constructs a choice input. `macro/step.answered` retains accepted answers even on terminal/error steps. These mechanics remain current. See [recorded input](../packages.md#recorded-player-input).

**Historical lifecycle cutover:** API 8, record@7, protocol 8. Recorded reaction obligations survive host reconstruction and cancel on undo; explicit structural dependencies protect ownership/containment; model membership is reciprocal. Macro command address history follows claims, loads are atomic, and composition is pinned while work remains owed. These guarantees remain current. See [execution continuity](../engine.md#execution-continuity).

**Historical explicit-seating cutover:** API 7, record@6, protocol 7. Joins record only an explicit optional seat; no side filling or capacity. `player/set` accepts a nonnegative seat or null to clear it. Removed `GameSettings`/`state.settings`/`settings/set` and core team/opposition helpers. Packages own relationships, turn order and deployment. These mechanics remain current; see [engine contract](../engine.md#participants-and-explicit-seats).

**Runtime API 6:** deeply readonly views/arguments/results and shared structural primitive validation. Valid effects still replay without package code; these guarantees remain in the current API.

**Ranked/shared-dice removal:** `record@5`, peer protocol 6, API 5. Removed rank keys, dice commitments/seeds/reveals, RNG overlays and `LoggedEvent.intent`/`seed`; ordinary injected RNG, resolved outcomes and generic choice secrets remain.

Under rule 4, unreleased rebuild package majors replace older ones without adapters, assuming no external dependents. Current packages declare API 12 and publish new bytes. The composition cutover requires namespace metadata in macro states/steps, record@9 and peer protocol 11; manifest schema v3 defines strict dependencies and replacements. Unsupported earlier records/caches/packages are rejected, not translated. Reassess before external release.

**Historical geometry cutover:** `record@4`, protocol 5, API 4. Neutral geometric queries replaced engine LOS/cover/vision policy. See [geometry migration](packages.md#geometry-api-4-cutover).

**Historical card cutover:** `record@2` and protocol 3 were replaced by `record@3` and protocol 4, with `MODULE_API` moving from 2 to 3. That work replaced per-player decks/piles with neutral cards and ordered collections, required API-2 package migration, and retained manifest schema v2. Those version numbers describe the earlier cutover, not today's supported contracts.

## Adding or changing a protocol

- **A new format:** give it `format: "open-battle/<name>@1"` (or `v: 1`), add its type to `SCHEMAS` in `scripts/schemas.mjs`, run `pnpm schemas`, and add a row here and a section to a spec page.
- **An additive change:** run `pnpm schemas` and commit the schema with the code. Say what was added in the spec page.
- **A breaking change:** a new major. Write a proposal first (or, while nothing outside depends on the format, say so here). Give the new major its own schema file (`<name>.v<major>.schema.json`).
