# Core/module review handoff

## Purpose and status

This document preserves the earlier core/module architecture review and the subsequent discussion about stripping Open Battle down before rebuilding gameplay. It was recovered from the conversation archive, not produced by a fresh audit.

**Conclusion:** keep the deterministic event-log kernel and generator-based rules runtime. Strengthen their boundaries and remove unsupported product assumptions rather than introducing another rules DSL or plugin framework.

The user completed card and neutral-geometry separation, then authorized ranked/shared-dice removal, runtime immutability/shared validation, explicit seating, lifecycle fixes and package-authoring capabilities. Richer recorded input, advisory flow, setup/data intake and predictable composition are implemented. Current contracts are **API 12/record 9/protocol 11/manifest v3**. Earlier cutovers are historical.

## Boundary to preserve

| Layer               | Owns                                                                                                                                         | Must not own                                                                           |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| State/replay kernel | Physical entities, quantities/tags, concrete events, deterministic folding, dice and secret primitives, history/undo, neutral card mechanics | Combat rules, phase progression, scoring, action eligibility, package-dependent replay |
| Module runtime      | Macro execution, recorded command results, questions and continuation, hook dispatch                                                         | Unlogged mutation of authoritative or package-visible game state                       |
| Game package        | Meaning of quantities, turn structure, combat, reactions, scoring, advisory checks, card and collection roles                                | A custom reducer required to reconstruct the table                                     |
| App                 | Rendering, controls, package consent, session lifecycle                                                                                      | Game-specific rules                                                                    |

Preserve these design choices:

- Log resolved outcomes, not instructions to rerun package code. Replay should apply recorded dice and effects without the package.
- Let the pointer store progress without defining what progression means.
- Keep open quantity/tag bags rather than adding game-specific core fields.
- Keep generator macros: branches, loops and player questions remain ordinary code.
- Keep package UI declarative rather than exposing React or the page to packages.
- Keep miniatures-oriented geometry. Models, bases, terrain, distances and units are appropriate substrate; packages decide the consequences of measurements.

## Boundary findings

These are historical findings. Reproductions below were observed during the original review, not rerun while writing this document.

### 1. Package-facing views were mutable at runtime

**Observed:** a panel callback changed a player's quantity to `99` without an event. The host's folded quantity remained `0`, while a subsequent sandbox macro read `99`.

The reviewed `gameView` exposed live state, entities, modifiers and module-owned objects. `GameView` used shallow `Readonly<GameState>`; it did not protect nested values or JavaScript callers. The sandbox isolated the browser environment but did not prevent mutation of its game replica.

**Recommendation:** enforce runtime immutability at package-facing boundaries and expose deeply read-only types. Read-only typing alone does not enforce the event-sourcing invariant.

Start with [core/view.ts](../src/core/view.ts), [sdk/index.ts](../src/sdk/index.ts) and [sandbox/engine.ts](../src/sandbox/engine.ts).

**Fix introduced in API 6, retained in API 7:** deeply frozen views/query results, callback inputs, macro contexts/args, yielded commands and generator results. Memoized traversal protects structurally shared fold state without copying the table. Before/after probes reproduced mutation to 99 and then rejected nested writes; panel/action/layout/hook callbacks and retained command/result aliases were exercised. See [runtime boundary](engine.md#runtime-package-boundary).

### 2. Structural validation differed between direct intents and macro emissions

**Observed:** a macro emitted `q/adjust` with a string delta. It was accepted and produced the quantity `"0bad"`.

The reviewed `emitProblem` checked event types and some protected fields, but macro emissions bypassed some checks applied to direct primitive intents.

**Recommendation:** share structural validation across entry paths. Advisory game legality permits a player to override a rule; it does not permit malformed events to corrupt the representation.

**Current fix:** [core/validate.ts](../src/core/validate.ts) provides `eventProblem` shared by direct intent resolution and macro emissions/generated effects. Malformed JSON, nonfinite quantities/moves, physical fields, references and membership are rejected without a game-legality gate. Before/after probes reproduced `"0bad"` and then preserved quantity 0; valid negative quantity edits, long moves, ask/resume and serialized replay passed. See [structural validation](engine.md#structural-primitive-validation).

### 3. Distinguish replay kernel from execution runtime

`src/core` includes both a package-independent fold and a registry-driven macro interpreter. Generic execution machinery belongs in the engine, but describing the entire directory as package-independent obscures that distinction.

**Recommendation:** make dependencies explicit. A folder split is optional; the important invariant is that folding history never depends on the execution registry. Moving files alone does not improve that invariant.

Start with [core/reducer.ts](../src/core/reducer.ts), [core/log.ts](../src/core/log.ts) and [core/macro.ts](../src/core/macro.ts).

### 4. Continuation and recovery need stronger semantics than replay

Completed history can replay without packages. Resuming a suspended macro still requires the appropriate executable code.

The reviewed `MacroState` identified a run by system and macro ID, and resume looked up the current registration. Extension macros/actions shared a system namespace; `ctx.set` also stored under that system's namespace.

**Recommendation:** make package ownership and override behavior explicit, and bind active runs to the code version they started with rather than only a reusable function ID.

Pending hooks were held in an in-memory `Session` queue. **[INFERENCE, not failover-tested]:** losing the host after the triggering event is logged but before its hook is logged can lose pending work on the successor. If hooks are guaranteed behavior, their outstanding work must be recoverable from history.

Start with [core/macro.ts](../src/core/macro.ts) and [net/session.ts](../src/net/session.ts).

### 5. Keep deliberate conventions separate from game rules

Two reviewed conventions deserve explicit decisions: automatic seating assumed two sides, and quantity modifiers used a fixed algebra of last `set`, summed `add`, then bounds.

These can be useful conventions without being universal rules. Do not expand core policy every time a package needs another interpretation. The seating recommendation is detailed below; modifiers were not recommended for blanket removal.

## Removal candidates before rebuilding gameplay

This was the proposed order of work, not an approved removal plan. The initial recommendation to remove dedicated cards was corrected during discussion and superseded by the completed card work.

| Priority | Candidate                              | Earlier evidence and recommended boundary                                                                                                                                                                      | Current disposition                                                                               |
| -------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 1        | Ranked/shared dice                     | Incomplete end-to-end integration carried through ordinary games. Keep injected RNG and resolved dice events; restore fair-dice machinery only with a complete, exercised workflow.                            | Removed end-to-end; ordinary RNG and resolved outcomes retained                                   |
| 2        | Legacy card deck/pile assumptions      | Per-player deck copies, secret-derived hands and discard/returned bookkeeping were a particular game model, not neutral card mechanics.                                                                        | Replaced; retain engine card support                                                              |
| 3        | LOS game policies                      | Enemy-only blockers, “tall” tags, global vision arcs, three sight modes, terrain occupancy exceptions and obscuring-as-cover answer rules questions. Keep measurements; packages decide eligibility and cover. | Implemented: neutral geometry; package LOS/cover policy                                           |
| 4        | Detailed imported-model sight geometry | Model bands and terrain triangle hulls had no producer/example consumer found in the review. Keep basic bases, heights and simple solids until a real visual table demonstrates the need.                      | Historical removal recommendation not adopted; retained as neutral physical geometry              |
| 5        | Two-side seating/alliance policy       | `player/join` filled seats 0 and 1 up to `teamSize`; team helpers inferred relationships from seats.                                                                                                           | Replaced with explicit recorded optional seats; packages own relationships/turn/deployment policy |

### Ranked/shared-dice evidence

The review found public-key strings and a key map in `ranked.ts`, not a functioning ranked-results experience; seed lookup without a seed-storage writer or complete commitment/reveal lifecycle; a removed verifier referenced by `sharedDice.ts`; and `Session.sharedDiceFor` falling back to ordinary RNG when the host secret was unavailable.

This machinery affected intents, reducers, player rebinding, undo exceptions, log metadata and routing. Removing only one helper would leave the conceptual burden in place. A removal should be a complete, protocol-aware slice.

The historical `core/ranked.ts` and `core/sharedDice.ts` are deleted. [net/session.ts](../src/net/session.ts) now uses injected RNG directly, including sandbox seeds. Removed verification metadata does not affect resolved replay outcomes.

### Other candidates, not firm cut decisions

- **Manual-dice machinery:** `ToldRng`, `NeedDice`, `BadFace` and related log/macro handling had no current UI workflow found. Retain if physical-dice entry is part of the first playable experience; otherwise consider deferring. Start with [core/dice.ts](../src/core/dice.ts).
- **Dormant SDK metadata, historical finding:** quantity definitions were transported/merged without a quantity-rendering consumer found; `QuantityDef.initial` was not automatically applied. Manifest `requires` is now enforced. The authoring kit now consumes initial values explicitly through creation helpers; the reducer still never reads package defaults.

For current geometry/seating, read [core/los.ts](../src/core/los.ts), [core/geometry.ts](../src/core/geometry.ts), [core/terrain.ts](../src/core/terrain.ts), [core/types.ts](../src/core/types.ts), [core/reducer.ts](../src/core/reducer.ts), and [engine boundaries](engine.md). The historical `core/teams.ts` is removed.

### Explicitly not recommended for removal

- Deterministic fold, log, replay, undo and checksums.
- Generator macros, questions and recorded command results.
- Physical units/models/tokens and open quantities/tags.
- Generic module state and secret commitments/reveals.
- Branching solely for minimalism: it was exposed in the debug page and reused existing history.
- Modifiers solely for being an abstraction: the implementation was small, used by the example and avoided duplicating temporary-effect bookkeeping.

## Completed card work: do not repeat the obsolete recommendation

The user clarified that the engine should support cards. The corrected split was **engine card mechanics versus package card rules**, not “remove cards and implement everything in module state.”

Implemented engine responsibilities: card identities and face/back assets, physical fields, ownership, explicit face visibility, ordered collections, add/remove/move/update operations and actual RNG-resolved shuffles. Each card belongs to exactly one collection; shuffles log resolved order so replay does not rerun RNG. Packages assign collection roles, draw counts, eligibility, scoring and card effects.

Removed the old `CardDeck`/`CardPile` model, `deck/*` events and secret-key-derived hands. Generic secrets remain separate. Added `ctx.shuffle(collection)` and perspective-aware `view.cards(...)`; migrated the example and debug controls. Private question choices are hidden from other perspectives.

**User-selected security model:** trusted tabletop. Normal views conceal unauthorized card names/faces, but the replicated record remains inspectable. This is not encrypted-hand secrecy, anti-cheat or proof of a fair hidden draw. A commitment proves consistency of a revealed value with an earlier commitment, not random selection from the remaining deck.

**Historical card cutover:** module API 3, `open-battle/record@3`, peer protocol 4; manifest schema stayed v2 because its shape did not change. Those versions are superseded by the geometry cutover below. There were no legacy shims. Both cutovers rely on the documented pre-external-use rebuild policy; reassess before release if external consumers exist.

Current repository references:

- [Card implementation](../src/core/cards.ts)
- [Package API](packages.md)
- [Protocol registry](protocols/README.md) and [compatibility policy](compatibility.md)
- [Architecture](architecture.html) and [changelog](../CHANGELOG.md)

## Completed geometry work: LOS policy separation is implemented

The approved boundary keeps deterministic physical measurements in the engine and puts LOS, cover, eligible blockers, vision arcs and per-unit aggregation in packages. [Engine boundaries and API](engine.md) documents the full contract; [the package guide](packages.md) explains usage; [the current API](protocols/packages.md#geometry-api-4-cutover), [GeometryView implementation/types](../src/core/los.ts) and [SDK contract](../src/sdk/index.ts) define the new surface.

`view.geometry` replaces `view.visible`/`view.sight` with `segment`, `segment2D`, model-to-model `sample`, `contains`, `overlaps` and `height`. Blocker shapes are explicit: 3D model/token bodies, terrain solids/hull/prism, or strictly 2D footprints. Results are raw contacts and ray counts; there is no implicit hidden/visible/cover answer, relationship filter, occupancy exception or unit sight aggregation. Packages interpret measurements and emit resolved primitive effects, so folding completed history remains package-independent.

At the historical geometry cutover, terrain sight fields and global sight settings were removed while `teamSize` remained. Model bands/hulls remain neutral physical geometry; cards/collections and generic secrets remain. Subsequent work removed ranked/shared dice, enforced readonly views/shared primitive validation, and replaced implicit sides with explicit seats.

Historical geometry cutover: **API 4, record@4, protocol 5**. Current contracts are **API 12, record@9, protocol 11**; manifest schema is v3. Advisory/setup cutovers did not change their historical record@8 shape; the composition cutover now rejects earlier records/caches and requires recorded macro namespaces.

## Completed engine cleanup verification

Ranked removal smoke exercised injected direct/client RNG, routed macro queue ordering, card shuffle, generic secrets, undo, branch protection and package-free serialized replay. Runtime probes exercised nested view writes, all action/panel/layout/hook inputs, retained command/result aliases and equivalent malformed direct/emitted primitives; valid overrides and ask/resume still work.

Seating smoke exercised six unseated joins, arbitrary/shared identifiers, reseating/clearing, rejoin/claim preservation, authority, undo/replay and the example's own setup/muster. Browser play exercised the explicit hotseat preset, change/clear/undo, local host/client setup, an unseated client, reload/reclaim retaining seat 42, and a third participant sharing seat 7. Format/lint/typecheck/schema/deadcode/build checks passed.

Full package iframe/worker startup was not reverified in this cleanup. Package behavior was exercised through the real `SandboxEngine`; the earlier browser `Illegal invocation` bootstrap failure remains a separate known limitation, not hidden by these checks.

## Lifecycle correctness fixes

The follow-up review reproduced nonreciprocal model membership, dangling ownership after undo, lost reactions on host reconstruction, reactions firing after trigger undo, departed-player questions, late results after leave, leaked code from failed loads, and BOM transfer hash changes.

Implemented fixes: reciprocal membership/replacement cleanup; transitive engine structural undo (not package-rule inference); trigger-recorded reaction obligations with distinct IDs and consumption/cancellation semantics; generation-scoped async authority; historical macro command replay with reclaimed engine addresses; atomic isolated package registries and exact-hash composition pinning; lossless UTF-8/BOM storage and hash-proven cache repair. See [execution continuity](engine.md#execution-continuity) and [structural undo](engine.md#structural-undo-and-membership).

Throwaway engine/session scenarios passed for failed batch loads, BOM byte roundtrip, repeated questions/secrets and primitive emissions through two claims, unchanged opaque literals, code mismatch/reconstruction, membership replacement, ownership/card/secret undo closure, pending reaction reconstruction/undo/duplicate triggers and late leave/demotion results. No permanent tests were added.

The real Ember Skirmish package passed muster → phase progression → strike with defender claim → answer/roll → move-hook accounting → cause undo and package-free replay hash. Browser local peers transferred a 342-byte BOM/multibyte package with the original SHA-256 unchanged and without implicitly granting trust. Real IndexedDB recovery restored a previously stripped BOM only with hash proof and preserved its consent. Format, lint, typecheck, schemas, deadcode and production build passed.

## Richer recorded player input

The first package-authoring capability introduced API 9, record@8, protocol 9. `ctx.input` supports single/multiple/ordered choice, finite number/text domains, explicit table references, point, pose and path. `ctx.ask` remains the choice shorthand. Shared descriptor/answer validation rejects malformed or wrong-participant answers without consuming a question. Accepted ordinary answers persist in `macro/step.answered`, including terminal/error steps; spatial answers propose data without implicit table mutation. These mechanics remain current.

Throwaway probes exercised every input kind, ordered/reference fidelity, readonly answers, malformed requests/answers, multiple claims, removed offered references, secret/reveal regressions, JSON reconstruction at every suspension, terminal/failing answer retention, undo reopening and package-free replay. A real host/client/spectator scenario carried structured pose/selection answers through the peer protocol with matching state hashes and terminal-answer metadata.

Browser play exercised every input control against the real `SandboxEngine`: editable invalid drafts, numeric zero, multiline text, reordered choices/references, coordinates/poses/path add/remove/reorder, next-question/undo draft reset, recipient gating and Enter submission. Normal iframe startup still failed with the previously known `Illegal invocation` in `src/sandbox/host.ts`; the disposable browser harness used the real engine directly, so iframe isolation was not verified. Repository format/lint/typecheck/schema/deadcode/build checks passed. No permanent tests were added.

Predictable extension composition is the fourth capability; an authoring kit remains a later task; the user requested at most one capability per turn.

## Standard advisory warning and override flow

The second capability uses API 10/protocol 10 with unchanged record@8 shapes. Warning rows retain targets, and action/panel starts capture exact arguments and participant before an explicit Proceed anyway/Cancel confirmation. Table/session/system/actor changes invalidate pending proposals. Panel `disabled` reasons became `warning`; callback failures are distinct errors. Forced starts recheck the reason and log acknowledgements with existing `log/note` events. `yield* ctx.warn` gives macros a recorded choice/note helper whose false result must stop proposed effects/dice.

Throwaway runtime scenarios passed for cancel/proceed, preserved proposals/targets, replay/reclaimed recipients, stale acknowledgements, callback exceptions, malformed/forbidden primitives and the actual Ember blocked-strike decision before rolling. A host/client/spectator scenario resumed a warning after reconstruction and participant claim, recorded one override before effects, and matched live/serialized replay hashes.

Browser play used the real engine directly, not iframe isolation: targeted, untargeted and panel cancel/proceed paths preserved arguments/senders and recorded reasons; table changes and p1→p2→p1 actor changes discarded stale confirmations. In-macro cancel produced no proposed data or dice; proceed logged the reason then rolled/applied the preserved proposal. Genuine local host/client tabs verified that clients cannot start panel actions naming another participant, while their own warned action executes under their actual identity. The existing iframe bootstrap limitation is unchanged. Format/lint/typecheck/schema/deadcode/build checks passed; no permanent tests were added.

## Package-defined setup and player-data intake

The third capability adds API 11 setup descriptors and JSON paste/file fields, using existing macro arguments and primitives (protocol 10/record@8 unchanged). App drafts remain local until submission; packages own format interpretation and effects. Typed defaults, optional omission and zero/false/null are preserved; metadata names its actor, and late file reads cannot cross newer edits or form/actor changes. Recorded import failures are visible. Pure presentation callbacks may run in trusted peer sandboxes; only the host resolves effects.

Throwaway runtime probes covered frozen actor-specific callbacks, field/default descriptors, malformed/unsafe data, unknown macros, duplicate form IDs, extension contributions, atomic rollback, pinned code, sample validation/import/muster and seat/claim continuity. Draft helpers covered every input kind and partial numeric corrections. Browser play covered all field kinds/defaults, upload/paste, no pre-submit events, current-draft submission, optional omission, package-format failure feedback, warning cancellation, ordinary-input regression, delayed file reads and actor resets.

The real example imported a version-1 Harbor Scouts profile, then visibly mustered 2 models with hp 7/edge 1 and 4-inch spacing; serialized package-free replay matched. An extreme finite spacing/model combination was reproduced as invalid derived coordinates, then rejected before any import effect. Format/lint/typecheck/schema/deadcode/build checks passed. No permanent tests were added. Browser verification used the real engine directly; the existing iframe-isolation limitation is unchanged.

## Predictable extension composition

The fourth capability enforces strict dependency IDs/exact hash pins and deterministic dependency-first execution before import. Source hashes are verified even for cached loads. Duplicate package selections, missing/ambiguous versions, cycles and symbol collisions are visible failures; atomic load preserves prior code. Explicit `overrides` names the current supplying dependency and exact symbol, including `(on,id)` quantities and conditional setup forms. Raw macro-over-action replacement removes stale action metadata and callbacks. Extension additions use package-prefixed global IDs; unprefixed IDs produce visible warnings. Local `ctx.set`/`view.own` keys are isolated under the extension manifest ID, with that owner recorded in macro states and steps.

Throwaway engine scenarios passed for dependency/hash/cycle preflight, version ambiguity, collision/override categories, atomic rollback, raw action replacement, per-entity-kind quantities, conditional setup replacement, namespace-bound actions/panels/forms, reconstructed suspension and package-free replay. A real host/client/spectator scenario resumed an extension's structured input after engine reconstruction, recovered both base/extension hook obligations into separate local namespaces, and matched live and serialized replay hashes.

Browser play uploaded the real game and supplies extension without changing the selected game, blocked unconsented and ambiguous selections, selected/consented to a specific dependency version, and recorded the exact ordered hashes. Base setup/muster and two extension grants produced three models, two command points and separate namespace metadata with identical replay hashes. Naming warnings rendered with provider/hash identity. Leaving before the delayed package commit produced no stale selection. The actual engine was connected directly for gameplay; the pre-existing iframe bootstrap/isolation limitation remains unverified. Repository format/lint/typecheck/schema/deadcode/build checks passed; no permanent tests were added.

## Agent-facing authoring kit and structured diagnostics

The fifth capability adds strict typed-source builds, bundled local modules with literal readable manifests/inline source maps, deterministic prefix-compatible IDs, and explicit default-consuming entity constructors. `QuantityDef.initial` does not become an automatic reducer lookup; starting quantities appear in ordinary primitive data. Scenario input/report formats have their own v1 schemas; API 12/record@9/protocol 11/manifest.v3 are unchanged. The [authoring guide](authoring.md) gives runnable commands and restrictions.

Throwaway helper/CLI scenarios verified JSON/accessor/unsafe/duplicate rejection, no aliases, zero/false/null precedence, typed source/default/manifest/import errors, failed-build output preservation, no author-code execution during build, deterministic reconstructed input/replay, and nonzero failures for invalid scenarios, unfinished input, callback exceptions and terminal macro errors. The checked-in Lantern scenario created unit energy 2/model hp 3, reconstructed its numeric question, recorded answer 4 and matched package-free replay.

Panel disappearance was reproduced before the fix and changed to visible provider/callback diagnostics. Runtime probes exercised panel/setup/action errors, unrelated valid controls/forms, refresh isolation, direct/terminal/validator macro failures, reconstruction and undo. Browser play loaded the actual built artifact, used helper defaults, reconstructed before submitting answer 4 and matched replay hashes. A deliberately failing extension visibly identified package/hash, callback/actor/symbol and real generated-source coordinates; broken eligibility was disabled while a valid action remained playable, and terminal input was still recorded on failure. Gameplay used the actual engine directly; the existing iframe bootstrap limitation remains, not a claim of isolated-worker verification. No permanent tests or CI were added.

The final current-tree audit exercised all eight input kinds through reconstructed continuations, retained warning targets/cancel/proceed, JSON profiles with zero/false/null, dependency-first record hashes, isolated base/extension hook recovery and real Ember setup/muster/supplies. Diagnostic refreshes capped 110 failed rows at 100 entries without hiding a valid control; changing records cleared failures. Format/lint/typecheck, all seven generated schemas, deadcode and production build passed. The architecture's authoring level rendered cleanly and its published copy was refreshed byte-for-byte.

## Verification and limitations

### Original review

- Loaded the actual Ember Skirmish package; exercised a paused question, an intervening move, resume and cascading undo while retaining that move.
- A fresh process with no package loaded reproduced the same state hash.
- Reproduced the mutable-view and malformed-quantity cases described above.
- Played muster → phase progression → strike → defender answer without ranked, shared-dice, deck/pile, branch or secret state. This shows those features were not prerequisites for that path, not that removing their plumbing is automatically safe.
- Browser UI and host failover were not exercised in that review. No files changed during the review itself.

### Completed card implementation

The earlier handoff records installed-Chrome gameplay for shuffle, private draw, perspective switching, public play, discard/recycle/return and debug controls. Engine smoke covered undo, same-collection ordering, malformed requests/permutations, visibility, ownership rebinding, package-independent replay and suspended-shuffle resume without consuming RNG again. Unsupported record@2 was rejected. Formatting, lint, typecheck, schema and deadcode checks passed then. No permanent tests were added.

These are historical verification results, not current-tree verification. The card handoff recorded implementation in the working tree with no commit, push, deployment or proposal issue opened by that task; it does not establish the repository's later commit state.

## How another thread should continue

1. Treat this as a review handoff, not a task list automatically authorized by the user.
2. Inspect current source for the selected concern. Do not assume API-2 line numbers or historical bugs still describe the current implementation.
3. Preserve package-independent replay and separate structural validity from advisory game legality.
4. For removals affecting state/events/SDK/network, read the protocol registry and compatibility policy before choosing a versioned cutover. Do not silently remove contracts within an existing major.
5. Exercise the affected gameplay and replay/undo path. For continuation/recovery work, test the interruption itself, not just completed replay.

The original review found architecture/package docs describing an older rules-as-data/procedure engine. The card work subsequently updated those documents and the architecture artifact, so that observation must not be repeated as a fresh finding without checking.
