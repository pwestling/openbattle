# Agent-facing package authoring

Author locally in typed modules; publish one import-free JavaScript package. The engine still runs API-12 package bytes and logs primitive events. Authoring helpers do not add game rules, consult metadata in the reducer, or initialize existing entities implicitly.

## Build a typed package

```sh
pnpm package:build examples/authoring/lantern-game/index.ts --out examples/authoring/lantern-game/lantern-game.js
pnpm package:scenario examples/authoring/lantern-game/scenario.json
```

The build checks the source graph with strict TypeScript, then bundles local imports into one browser ES module with an inline source map. Its literal `export const manifest` remains readable without executing code. Type errors, a nonliteral or incompatible manifest, and remaining runtime imports are build failures. An unsuccessful build does not replace an existing artifact. Build output reports the content hash; every byte change is a new package requiring player consent.

Use the [multi-file Lantern example](../examples/authoring/lantern-game/index.ts) as the typed starting point, the [SDK](../src/sdk/index.ts) for runtime contracts, and [package guide](packages.md) for inputs, warnings, setup and composition. Local source imports are build-time dependencies only; the published file has no imports. Build tooling does not execute the package. The scenario tool does execute it: run only code you trust.

## Deterministic identities

Import `namespacedId` from `src/sdk/authoring.ts`. IDs derive solely from the supplied namespace and stable parts. There are no counters, timestamps or random values. Use a package prefix for extension additions and derive entity IDs from recorded data, such as participant identity and a recorded creation sequence. Reconstructing the same macro must recreate the same identities. The helper rejects unsafe or oversized IDs rather than truncating them into collisions.

Namespaces use safe letters/digits/`_`/`.`/`-` without `:`; parts use safe string keys (including `:`) or safe integers. This keeps the literal namespace prefix while making typed length-framed parts unambiguous. For example `namespacedId("author.game", "model", "p1")` returns `author.game:s5:model:s2:p1`; numeric `1` is distinct from string `"1"`. A module ID containing `:` is valid at runtime, but cannot be passed directly as this helper's namespace.

## Explicit starting quantities

`QuantityDef.initial` is a declared starting value, not an automatic reducer default. Import the helpers from [src/sdk/authoring.ts](../src/sdk/authoring.ts):

- `initialQuantities(definitions, kind, overrides?)` creates a fresh quantity bag for that entity kind.
- `unitAdd(definitions, unit, models)`, `modelAdd(definitions, model)` and `tokenAdd(definitions, token)` return concrete creation primitives with defaults beneath each entity's explicit `q` values.

Explicit `0`, `false` and `null` override defaults. Nested values are copied: editing a constructed entity cannot mutate a definition or another entity. Invalid JSON, unsafe keys and duplicate definitions fail before an event is returned. For an existing entity, emit explicit `q/set` events; for player starting values, use `initialQuantities` and emit `q/set`. Do not emit player/session intents from macros.

The record contains actual starting quantities. A peer with no package and a completed replay see the same values; neither reads `QuantityDef` during folding. Helpers are an opt-in authoring convenience, not a new source of authoritative state.

## Package scenarios

`pnpm package:scenario <scenario.json>` runs a versioned [package scenario](protocols/package-scenarios.md) through the actual sandbox engine and host event resolver with seeded randomness. Package paths are relative to the scenario file. A scenario supplies participants and operations: start actions, answer inputs, reconstruct a suspended execution, inspect presentation and assert state values.

Reports include the record, waiting question, structured diagnostics and live/replay hashes. Rejected intents, callback errors, macro failures, failed assertions and unfinished input produce a nonzero exit. Completed replay is rebuilt without package code. This is a local authoring tool, not restored CI, a unit-test suite or proof of network/iframe isolation.

## Diagnose package code

Package load, presentation and execution failures carry structured metadata: exact package hash, package ID when known, game, callback, relevant symbol/actor and message. Source URL, line and column appear only when the thrown stack provides a real package frame. Coordinates refer to the generated package; use its inline source map in a debugger to trace original TypeScript.

Graph-wide preflight errors may have no single proven provider (`hash: ""`, no package ID); their message describes the dependency failure. Diagnostics never assign such a failure to an arbitrary first package.

Panel failures are visible even though no failed panel is rendered. Failing action callbacks remain errors, not overridable rule warnings; valid unrelated controls stay available. Setup callback errors retain their existing feedback. A macro failure is still recorded as `macro/step.error`; already emitted valid effects are not rolled back. Reconstruction can recover owner/message from the log, but may not recover the original stack. Presentation refreshes replace diagnostics rather than growing an unbounded history.

Use `ctx.warn` for an advisory game-rule decision, never to suppress a programming error. The [compatibility contract](compatibility.md) remains API 12, record@9, protocol 11 and manifest.v3. The new scenario file has its own major version; helper code and sandbox presentation metadata do not change primitive events or peer messages.
