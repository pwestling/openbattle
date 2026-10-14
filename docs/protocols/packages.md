# Packages

A rules package is one JavaScript module file that is a whole game or adds to one. How to write one is in [../packages.md](../packages.md); this page is the contract between a package and every Open Battle build that loads it.

## Identity

A package is identified by the **SHA-256 of its exact bytes**. Every player's app checks the bytes against the hash before using them, asks the player before running a package it hasn't seen, and treats any byte change as a new package. Packages travel between peers by hash ([peer-protocol.md](peer-protocol.md#outside-the-log)).

Storage keeps lossless valid UTF-8 source, including an initial BOM, so peer transfer re-encoding reproduces the original bytes. A previously stripped BOM is restored only when byte count and reconstructed SHA-256 prove the original content; the original consent/hash remains unchanged.

## The manifest

Schema: [manifest.v3](../../schemas/manifest.v3.schema.json). Code: `Manifest` and `readManifest` in `src/packages/manifest.ts`.

The file starts with `export const manifest = { ... }`. The app reads it as data **without running the file**, so it must be a plain literal: strings, numbers, booleans, arrays and objects, with no expressions or references.

| Field       | Meaning                                                                                          |
| ----------- | ------------------------------------------------------------------------------------------------ |
| `id`        | The package's name for good. Keep it across versions                                             |
| `name`      | Shown to players                                                                                 |
| `version`   | Semver: patch for fixes, minor for new rules, major when an existing game would play differently |
| `author`    | Optional                                                                                         |
| `api`       | The module API it was written for: `MODULE_API` in `src/sdk/index.ts`, now `12`                  |
| `kind`      | `system` (a whole game) or `extension` (adds to the games its `systems` name)                    |
| `systems`   | The game ids it is for                                                                           |
| `requires`  | Other packages it needs, by `id` and optionally `hash`                                           |
| `overrides` | Optional array of `{ system, kind, id, from, on? }` intentional dependency-symbol replacements   |
| `adds`      | Optional: a line saying what it adds, for the consent screen                                     |
| `changelog` | Optional                                                                                         |

## The module API

**`MODULE_API = 12`.** The TypeScript types in [src/sdk/index.ts](../../src/sdk/index.ts), [SetupSpec in src/core/setup.ts](../../src/core/setup.ts), [InputSpec in src/core/input.ts](../../src/core/input.ts), and [GeometryView in src/core/los.ts](../../src/core/los.ts) define the contract, with the guide in [../packages.md](../packages.md). Package code reads deeply readonly views and yields commands; packages own game policy and player-data formats.

Anything an existing package would notice (a removed or renamed field, a changed `ctx` shape, a primitive event whose meaning changes) raises `MODULE_API`. The app refuses a package whose `api` it doesn't support, by name and with the reason.

The messages between the app and the sandbox (`src/sandbox/protocol.ts`) are internal.

## Composition API 12 cutover

The loader validates the entire dependency graph before importing any code. Duplicate selected IDs, malformed requirements, missing dependencies, mismatched lowercase SHA-256 pins and cycles fail atomically. Dependencies precede consumers; compatible whole games precede extensions. The app adds dependency closure, never guesses between installed versions, requires consent per exact hash, and records its ordered selection.

Shared action/macro/quantity/phase/panel IDs cannot silently overwrite another provider. `overrides` declares the current supplying package (`from`, required in `requires`), game selector, symbol kind and ID; quantities also name `on`, and panel ID is `panel`. Action replacement includes its paired macro. Static unused or wrong-provider declarations fail; conditional setup collisions are validated when forms appear. New extension symbols should use `${manifest.id}:` prefixes; violations warn, never rename.

Game-owned local state stays under the game system ID; extensions use their manifest ID for `ctx.set`, `view.own` and all pure callbacks. Recorded `MacroState.namespace` and `macro/step.namespace` pin that owner across reconstruction. Intentional shared writes require explicit primitive `module/set`. Namespace aliases and arbitrary data-key rewriting are absent.

Current contracts are API 12, manifest.v3, record@9 and protocol 11. Earlier records/packages are rejected without adapters. See [composition guide](../packages.md#composing-a-game-and-extensions).

## Setup/data intake API 11 cutover

`ModuleDef.setup(view, player)` returns data-only forms for a known participant. System/extension contributions append in existing load order, with unique form IDs and registered macro targets; callbacks and descriptors are validated without hiding unrelated actions/panels on failure. Frozen views and actor-attributed `AppState` prevent another participant's descriptors being reused. The app shares controlled editors between ordinary macro inputs and setup fields.

Fields use existing `InputSpec` types or setup-only `{ kind: "json" }` paste/file intake, with validated defaults and explicit optional inclusion. Submit sends existing `macro/start` arguments `{ ...spec.args, form: spec.id, data: values }` as the current actor. Editing/uploading is local; submitted values are public in the log. The host validates finite JSON/participant mechanics, while the macro interprets/version-checks its own data format before emitting effects or persisting module data. No universal roster schema, settings, input command, primitive event or new peer/record shape is introduced.

The example's package-owned JSON profile uses `v: 1`, `name`, `models`, `hp`, `edge`, plus a separate spacing field. Its runtime validator defines the representation; the app never decodes that profile as an engine format. Publish incompatible data-format changes under a new version and document the package's schema. See [setup/data guide](../packages.md#setup-forms-and-player-owned-data).

The historical setup cutover declared API 11 with unchanged protocol 10, record@8 and manifest schema v2. Those form/input mechanics remain; current packages publish API-12 bytes and use the composition contract above. Completed current-format effects fold without package code; continuation retains exact-compatible-code requirements.

## Advisory flow API 10 cutover

`available` strings are advisory warnings, not disabled actions: target discovery still runs. Panel buttons replace `disabled?: string` with `warning?: string`. The app retains exact proposals and explicitly confirms Proceed anyway/Cancel; accepted starts send `force: true, warning`. The host rechecks current action reasons, refuses stale mismatches/callback failures, and logs the acknowledged reason with existing `log/note` primitives.

`yield* ctx.warn(player, reason)` gives macros the same pattern using the existing recorded choice/note commands. It returns false on Cancel; Proceed anyway records the override and returns true. Guard proposed effects/dice with that boolean and preserve proposed data in generator locals. This is not rollback or a bypass of package early returns, malformed effects or participant validation.

The historical advisory cutover used API 10; current packages declare API 12 and publish new bytes. There is no `disabled` alias or old-package shim. Peer protocol 10 carries warning acknowledgement; that historical cutover retained record@8 and manifest schema v2. See [advisory flow](../packages.md#advisory-warnings-and-explicit-overrides).

## Recorded input API 9 cutover

`ctx.input(player, question, spec)` yields a data-only `input` command. `ctx.ask` remains a single-choice shorthand producing that same command; there is no ordinary `ask` command or options-only ordinary waiting representation. `macro/answer.answer` is JSON instead of a string-only transport. Secret/reveal commands keep their existing string commitment/reveal transport and discrete secret options.

Descriptors cover single/multiple choices, ordering, finite number/text domains, offered unit/model/token/card/terrain references, and point/pose/path proposals. The app renders controls and the host validates participant/domain before advancing. Accepted ordinary answers persist in `macro/step.answered: { player, command, value, head }`, including when code completes or fails; pending scripts retain results for continuation. Spatial answers have no implicit effect and reference candidates are captured, not reevaluated after suspension. See [the input vocabulary](../packages.md#recorded-player-input).

The historical recorded-input cutover used API 9, record@8 and protocol 9. Current packages declare API 12; existing `ctx.ask` source calls remain unchanged. Older records are not adapted; record@9 is the current readable format, with compatible exact code needed for continuation.

## Lifecycle API 8 cutover

Loads prepare the whole ordered composition before committing executable registries or metadata. Failed loads leave prior successful code intact; engine instances do not share executable registries. While a macro or recorded reaction is pending, different package/system selections are refused. Recovery uses the exact recorded ordered hashes; missing or mismatched code leaves work owed.

Reaction identities and obligations are recorded with their trigger; a committed first step consumes an obligation. Trigger undo cancels queued work and caused runs; undoing a reaction's effects does not rerun it. Macro claims preserve historical command keys/arguments and redirect only engine-owned addresses, including subsequent questions/secrets and emitted player references, owners and card visibility. Historical result mappings keep replay stable through later claims. Arbitrary package JSON and direct historical `args.by` dictionary lookups are not rewritten.

`model/add` maintains reciprocal containment, and undo follows explicit engine structural prerequisites rather than game-rule dependencies. The historical lifecycle cutover used API 8, record@7 and protocol 8; these guarantees remain in current API 12. See [engine contracts](../engine.md#execution-continuity).

## Explicit seating API 7 cutover

`Player.seat` is an optional nonnegative identifier with no engine-owned alliance/edge/turn meaning. Joins never allocate seats; explicit supplied seats are recorded, omission preserves an existing choice on rejoin. `player/set` accepts a seat number or null to clear it. Setup chooses seats, and packages define participant counts, relationships and turn order. Remove `state.settings`, `GameSettings`, `settings/set`, `sidePlayers` and `opposed` uses; game options belong in package data. This historical cutover used API 7; declare current API 12.

## Runtime API 6 cutover

API 6 introduced deeply frozen views/state/query results, callback inputs, macro context/arguments, yielded commands and generator results. Copy data for local editing; emit/set for persistent changes. Shared primitive validation requires finite fields, valid JSON and references/physical mechanics for direct and emitted effects. Game-rule violations remain advisory. These guarantees remain; current packages declare API 12.

## Ranked/shared-dice API 5 cutover

The historical API 5 cutover removed ranked keys/state, dice seed lifecycle and verification metadata. These stay absent. Injected RNG, `ctx.roll`, `ctx.shuffle`, logged outcomes and generic choice secrets remain. Current packages declare API 12; the engine does not promise independently verified fair dice.

## Geometry API 4 cutover

Replace `view.visible` and `view.sight` with `view.geometry`:

```ts
segment(a: Vec3, b: Vec3, blockers: readonly GeometryBlocker[]): SegmentHit[]
segment2D(a: Vec2, b: Vec2, blockers: readonly GeometryBlocker[]): SegmentHit2D[]
sample(observer: string, target: string, options: SampleOptions): SampleMeasurement
contains(object: GeometryRef, point: Vec2): boolean
overlaps(a: GeometryRef, b: GeometryRef): boolean
height(object: GeometryRef): number
```

`GeometryRef` is `{ kind: "model" | "terrain" | "token", id: string }`. A blocker also selects the physical shape:

- Model/token: `shape: "body"` in 3D or `"footprint"` in 2D. A token without a base has a point footprint; explicit body bands can still define its 3D volume. Without a base or bands its body is a zero-size point at its position/elevation and its measured height is 0, even if a standalone height field exists. No miniature is fabricated.
- Terrain: `"solids"` with optional zero-based `solids` indexes (omitted means every solid, including foliage); `"hull"` for an existing triangle mesh; `"prism"` with explicit world-inch `bottom`/`top`; or `"footprint"` for its rotated rectangle in 2D. Hull selection never falls back to solids. Solid kinds describe geometry, not automatic blocker policy.
- Footprints are invalid in a 3D segment/sample, and body/solids/hull/prism are invalid in 2D. Malformed queries, nonfinite inputs, missing references and missing/off sampled models throw `Error`.

`SampleOptions` is `{ mode: "body" | "height" | "footprint", blockers, eyes? }`; observer and target are individual model IDs, never unit/token/terrain IDs. Optional nonempty `eyes` are absolute world-inch `Vec3` points for body/height only. Footprint sampling is strictly 2D regardless of elevation. Explicitly selected observer/target blockers are not exempted; empty blockers mean clear geometry.

Segments return first contact per selected object as `{ object, t, point }`, sorted by `t`, then code-unit lexical kind/ID; endpoints, inside starts and tangency count. Samples return `{ clear, total, fraction, anyClear, allClear, blockers }`: clear rays divided by total rays, not each target point's best eye. Every intersecting blocker contributes to the unique kind/ID-sorted blocker list. Body uses deterministic five eyes and 19 body points (17 per body band); height uses one top eye and three target heights; footprint uses one observer center and target center plus eight rotated rim points at 95% semiaxes. Curved-base overlap uses the existing 48-vertex convex approximation.

The complete [engine boundary and geometry contract](../engine.md) documents exact sample positions, shape fallbacks, tolerances and mesh/curve approximation limits.

Migrate layouts by removing terrain `losHeight`/`sight`/`visibility` and all engine settings (including the later-removed `teamSize`). Store game classifications/options in package data and explicitly select blocker shapes. Token bases/heights/bands are optional; model bands/hulls remain neutral geometry. Actions compute advisory rules and emit primitive effects; replay does not rerun package policy.

The historical geometry cutover used API 4, record@4, protocol 5. Current packages declare API 12 after applying ranked/shared-dice removal, readonly runtime, explicit seating, lifecycle, recorded-input, advisory-flow, setup/data-intake and composition contracts above; there are no old-package adapters.

**Historical API 3 card cutover:** per-player decks/piles became cards and ordered collections, `ctx.shuffle(collection)` and perspective-aware `view.cards(collection, player?)` were added, and `deck/*` was removed. Those card mechanics remain in API 4. Packages still own collection roles, draw counts and card effects; card visibility is trusted-tabletop presentation, not confidentiality.
