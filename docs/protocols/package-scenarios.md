# Package authoring scenarios

**Format:** `open-battle/package-scenario@1`. **Schema:** [package-scenario.v1](../../schemas/package-scenario.v1.schema.json). **Type:** [PackageScenario](../../src/authoring/scenario.ts). This provisional local-authoring format is separate from game records, peer messages and package API versions.

Run with `pnpm package:scenario <file.json>`. **This executes trusted local package code in the Node process.** It is not the browser's security sandbox; do not run untrusted downloaded packages. The build command checks/bundles without executing the package.

## Document

| Field      | Meaning                                                                             |
| ---------- | ----------------------------------------------------------------------------------- |
| `format`   | Required exact major identifier                                                     |
| `packages` | Nonempty list of built JavaScript package paths, relative to this document          |
| `system`   | Selected game ID                                                                    |
| `players`  | Starting participant records (`id`, `name`, `color`, optional explicit `seat`/data) |
| `seed`     | Optional unsigned 32-bit deterministic randomness seed                              |
| `steps`    | Ordered operations below                                                            |

Package bytes are hashed and their literal manifests/dependencies are checked by the real loader. The recorded `game/packages` selection pins exact dependency-ordered hashes. Participants and actions go through the host's mechanical validation; no malformed request is silently skipped. Unknown fields are ignored for forward compatibility within this major.

## Operations

| `op`          | Fields and behavior                                                                                                  |
| ------------- | -------------------------------------------------------------------------------------------------------------------- |
| `intent`      | `from`, `intent`: resolve the supplied host intent; macro starts use actual package code                             |
| `answer`      | `from`, `answer`: submit ordinary JSON to the pending input; recipient/domain validation still applies               |
| `reconstruct` | Requires suspension; rebuild the record and a fresh engine with the exact same package composition before continuing |
| `appState`    | `player`: evaluate the package's current action/panel/setup callbacks and retain their report                        |
| `assert`      | `path: string[]`, `equals: JSON`, optional `target: "state"                                                          | "appState" | "waiting"` (default state); exact own-key data lookup and deep comparison |
| `assertHash`  | `hash`: compare the current deterministic state hash                                                                 |
| `replay`      | Rebuild the resolved record without loading any package, then compare hashes                                         |

Array indexes in an assertion path are string segments. Unsafe prototype keys are not paths. The runner drains recorded reaction obligations using the loaded providers and deterministic RNG, not fabricated callback results. Questions use the same input commands as browser play; secret device workflows are not ordinary JSON answers.

## Results and failures

Reports use `format: "open-battle/package-scenario-report@1"` and [package-scenario-report.v1](../../schemas/package-scenario-report.v1.schema.json), defined by `ScenarioOutput`. Failures before execution return `{ format, ok: false, error }` with no fabricated record. Started runs include the full state/record report even when they fail. Unknown optional fields remain ignorable.

The JSON report exposes operation results, presentation snapshots, waiting input, structured package diagnostics, terminal macro errors, final state, record and live/package-free replay hashes. Seeded runs with unchanged sources/operations reproduce the same game data. A finished scenario cannot leave an unanswered input.

Unknown format majors/operations, malformed data, rejected intents or answers, failed assertions, callback diagnostics, macro failure and unfinished execution fail with a nonzero exit. Inspect the report rather than treating the presence of any record as success. Failed macros retain their already emitted valid effects, matching ordinary play.

The checked-in [Lantern scenario](../../examples/authoring/lantern-game/scenario.json) demonstrates explicitly materialized starting quantities, a numeric input, reconstruction before its answer and completed package-free replay. Build the example before running its scenario; paths refer to the generated artifact, not TypeScript source.

This tool does not replace playing packages in the app or verify WebRTC, participant UI gating, iframe startup or code isolation. It is not a permanent automated test suite or CI service.
