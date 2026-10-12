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

| Protocol                              | Version                 | Spec                                     | Schema                                                                                                                     |
| ------------------------------------- | ----------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Game record and replay                | `record@2`              | [peer-protocol.md](peer-protocol.md)     | [record.v2](../../schemas/record.v2.schema.json)                                                                           |
| Rules package manifest                | `api: 2` (`MODULE_API`) | [packages.md](packages.md)               | [manifest.v2](../../schemas/manifest.v2.schema.json)                                                                       |
| Module API (`src/sdk`)                | `MODULE_API = 2`        | [../packages.md](../packages.md)         | TypeScript types                                                                                                           |
| Peer protocol                         | `PROTOCOL = 3`          | [peer-protocol.md](peer-protocol.md)     | [peer-message.v3](../../schemas/peer-message.v3.schema.json), [side-message.v2](../../schemas/side-message.v2.schema.json) |
| Site `config.json`                    | none (2)                | [servers.md](servers.md#site-configjson) | [site-config.v2](../../schemas/site-config.v2.schema.json)                                                                 |
| TURN logins                           | none (1)                | [servers.md](servers.md)                 | n/a                                                                                                                        |
| Sandbox host messages (`src/sandbox`) | none                    | n/a (internal)                           | n/a                                                                                                                        |

The first release of the rebuilt core broke every older format on purpose (nothing was in use yet); the registry starts again from here. Formats that other builds could read before (armies, tables, figure packs, campaign books, mail files, ranked results, the board) are gone with the features that wrote them, and come back as new protocols when a feature does.

## Adding or changing a protocol

- **A new format:** give it `format: "open-battle/<name>@1"` (or `v: 1`), add its type to `SCHEMAS` in `scripts/schemas.mjs`, run `pnpm schemas`, and add a row here and a section to a spec page.
- **An additive change:** run `pnpm schemas` and commit the schema with the code. Say what was added in the spec page.
- **A breaking change:** a new major. Write a proposal first (or, while nothing outside depends on the format, say so here). Give the new major its own schema file (`<name>.v<major>.schema.json`).
