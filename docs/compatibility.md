# Compatibility

A table plays the rules its players agree to. Builds, package bytes and wire formats have separate identities; none implies a ranked result or independently verified dice. Ranked keys, result signing, ladders and shared-dice seed protocols are not supported engine features.

Every public format and protocol is listed in [the registry](protocols/README.md). Current unreleased contracts are **peer protocol 11, `open-battle/record@9`, module API 12**.

## The four layers

| Layer       | What it covers                    | Identity                                 | When players differ                                                |
| ----------- | --------------------------------- | ---------------------------------------- | ------------------------------------------------------------------ |
| Protocol    | Events, intents and peer messages | `PROTOCOL` in `src/protocol.ts`          | Peers on different protocols are parked; they cannot share a table |
| App build   | Reducer and application           | Release version and commit (`APP_BUILD`) | Same-protocol builds show a banner naming both builds              |
| Game module | The game's package                | Module ID and package SHA-256            | Peers receive the host's package, checked by hash                  |
| Extensions  | House rules added to a game       | SHA-256 of each file                     | Each player agrees to each package once                            |

Peers announce protocol/build in `hello` and `host` messages. Legacy messages without this metadata retain the existing compatibility handling; that is not an old-record reader.

## Randomness and secrets

The host resolves dice and shuffles with injected RNG. Sandbox macros receive a seed drawn from that RNG. The log stores resolved results and permutations, not originating intents or verification seeds. Replay does not roll again and needs no package code for completed effects. This is deterministic replay, not protection against a dishonest host.

Generic player-chosen secret commitments and checked reveals remain separate from dice. Card face visibility is trusted-tabletop presentation: full identities and order are replicated, not encrypted or independently verified hidden draws.

## Promises for package authors

- Keep a package's `id` across versions; saved games refer to it.
- Use semver: patch for fixes, minor for new rules, major when an existing game plays differently.
- Declare `api: 12` (`MODULE_API` in `src/sdk/index.ts`). Incompatible packages are rejected by name with a reason.
- Every byte change produces a new hash and requires consent again.
- Completed replay folds primitive events without rules code. Resuming a suspended macro still requires its executable package code.
- Exact valid UTF-8 bytes, including BOMs, survive storage and sharing. Previously stripped BOMs are recovered only when reconstructed bytes match the original SHA-256; consent stays attached to that hash.
- Executable composition is pinned while a macro or recorded reaction is unfinished. Loading is atomic; recovery requires the exact recorded ordered hashes. Claims redirect engine-owned command addresses without rewriting arbitrary package JSON.
- Ordinary inputs record structured JSON, including terminal answers; the host validates the declared domain, not game legality. Spatial answers never move the table. `ctx.ask` remains a choice shortcut; secret/reveal transport is unchanged.
- Advisory warnings retain targets and proposals, require an explicit proceed/cancel decision, and log accepted overrides. `yield* ctx.warn` reuses recorded inputs/notes; force never bypasses malformed effects or callback failures.
- Package-defined setup forms collect local drafts/JSON before starting existing macros. Packages own data formats and effects; submitted data is public. No peer or record shape changes were needed for this capability.
- Dependencies are enforced before imports. Exact hash pins, dependency ordering, explicit provider-matching replacements and package-local data namespaces prevent silent composition changes.
- Typed source builds and explicit creation helpers are additive authoring tools. Starting quantities are emitted as concrete data, not applied during folding. Structured callback diagnostics are sandbox-local presentation metadata; API 12, record@9 and protocol 11 remain unchanged. Local scenario files use their own `package-scenario@1` major.

## Unreleased rebuild cutovers

These formats have no known external dependents. Under [registry rule 4](protocols/README.md#the-rules-every-protocol-keeps), new majors replace old rebuild formats without adapters, aliases or legacy readers. Unsupported record formats are rejected; room-cache keys include the current record major. Reassess this assumption before release.

- **Current composition cutover:** API 12, protocol 11, record@9, manifest schema v3. Strict dependencies/hash pins, deterministic dependency ordering, explicit symbol replacements, package-local extension state and recorded macro namespaces replace silent merging. Earlier APIs/records are not adapted; publish new bytes and explicitly migrate intended shared state writes.
- **Historical setup/data intake:** API 11, protocol 10, record@8. Frozen actor-specific setup descriptors, existing input fields and JSON paste/file intake start registered macros with ordinary `form`/`data` arguments. Packages validate/version their own profile/roster/scenario formats and emit existing primitives. API-10 packages publish API-11 bytes; there is no old-package adapter. Wire/record shapes and completed record@8 replay are unchanged.
- **Historical advisory flow:** protocol 10, record@8, API 10. Warned actions retain targets; panel `disabled` became `warning`; explicit confirmations preserve proposals and forced starts carry warning acknowledgements. Macro helpers use existing choice/note primitives. These guarantees remain current, with exact compatible code needed for pending continuation.
- **Historical recorded input:** protocol 9, record@8, API 9. Declarative choices, multiple/ordered selections, scalar data, table references and spatial proposals replaced ordinary ask-command/waiting-option representation. `macro/answer` carries JSON; `macro/step.answered` retains accepted values even when the macro finishes or fails. These mechanics remain current; `ctx.ask` remains the choice shorthand.
- **Historical lifecycle correctness:** protocol 8, record@7, API 8. Triggers record reaction obligations; starting steps consume them, trigger undo cancels them, and host reconstruction resumes only outstanding work. Structural undo expands engine prerequisites, model membership is reciprocal, and macro identity/address history follows claims. Loading is atomic and code is pinned during unfinished execution. These guarantees remain current.
- **Historical explicit seats:** protocol 7, record@6, API 7. Joins no longer fill two sides; selected optional seats and `player/set` seat changes/null clearing are recorded. Generic settings and core alliance helpers are removed. Packages define relationships and turn/deployment policy. These guarantees remain in the current contract.
- **Historical runtime API 6, retained:** deeply readonly views, callback inputs, yielded commands/results and shared structural primitive validation. Copy working data instead of mutating views. That phase did not change valid wire shapes; the composition cutover above defines current versions.
- **Ranked/shared-dice removal:** protocol 6, record@5, API 5. Removed rank keys, dice commitments/seeds/reveals, RNG overlays and verification metadata. Current packages remove uses of those contracts and adopt the current API. Protocol-5 builds cannot share current tables; that cutover retained manifest schema v2.
- **Historical geometry cutover:** protocol 5, record@4, API 4. Replaced sight policy with neutral geometric queries; removed terrain sight/cover fields and global sight settings. See [geometry migration](protocols/packages.md#geometry-api-4-cutover).
- **Historical card cutover:** protocol 4, record@3, API 3. Replaced per-player deck/pile assumptions with neutral cards and ordered collections.

## Forks and servers

The code is MIT; fork freely. Mark a fork's build with a prerelease version (`0.1.0-<name>`). Keeping `PROTOCOL` and its behavior allows sharing tables; changing the contract requires a new protocol number. See [governance](../GOVERNANCE.md#the-open-battle-name).

The optional signalling relay and TURN login service live in `server/` and can be run using [the self-host kit](self-host.md).

Protocol or module API changes need a proposal before publication; see [governance](../GOVERNANCE.md#changes-that-need-a-proposal).
