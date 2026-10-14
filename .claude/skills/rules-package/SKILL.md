---
name: rules-package
description: Write or change an Open Battle rules package (a single JS file players load at runtime) that adds rules to a game or a whole new game. Use when asked for a house rule, an ability, a mod, or a new game as a package.
---

# Write a rules package

A published package is one import-free ES module, shared peer to peer by its SHA-256. Only the host resolves macro effects; trusted peers may run pure presentation callbacks in their own sandboxes. Every byte change is a new version every player must accept again.

## Steps

1. **Pick the kind.** `kind: "system"` is a whole game: the default export is a module (`api: MODULE_API`, `id`, `quantities`, `pointer`, `actions`, `macros`, `hooks`, `panel`, `setup`). `kind: "extension"` adds capabilities to the games its `systems` name (a prefix match). Read [docs/packages.md](../../../docs/packages.md).
2. **Start from an example**, never a blank file: `examples/packages/ember-skirmish.js` exercises the runtime contract. For typed multi-file authoring, start from `examples/authoring/lantern-game/index.ts` and read [docs/authoring.md](../../../docs/authoring.md). `pnpm package:build <entry.ts> --out <file.js>` checks and bundles source imports into the one-file artifact; publish only that artifact.
3. **Write the manifest as a plain literal.** The app reads it without running the file, so no variables, calls, spreads or template strings. Read the current `MODULE_API` in `src/sdk/index.ts` and use it for `api` (do not copy an old guide's number); give a stable `id` (`author.name`), a semver `version`, and an `adds` sentence that tells a stranger what the code will do.
4. **Write the rules** against the types in `src/sdk/index.ts`:
   - a game's own moves are macros: generators that yield `ctx.roll`, `ctx.input` (structured proposals) or `ctx.ask` (one choice), `ctx.emit` (only the core's primitive events), `ctx.set`, `ctx.secret`, `ctx.reveal`, `ctx.note`;
   - read the game only through `ctx.view`, roll only with `ctx.roll`, keep lasting state with `ctx.set` or quantities;
   - spatial inputs are proposals, not moves; interpret and recheck resumed views/references before emitting effects. Domain bounds describe representable data, not unoverrideable game rules. Ordinary answers are public recorded JSON; use secret/reveal for device-held commitments;
   - treat `available` strings and panel `warning` fields as advisory. Inside a macro, use `if (!(yield* ctx.warn(args.by, reason))) return` before proposed effects/dice; cancellation is not an automatic rollback and proceeding does not make malformed events valid;
   - use `setup(view, player)` for player-owned profile/roster/scenario intake: typed fields or JSON paste/upload start registered macros with `args.form` and `args.data`. Validate/version the package's own data format before effects; submitted data is public. No universal army schema or implicit state mutation is provided;
   - extensions declare `requires: [{id,hash?}]`, prefix new global IDs with `${manifest.id}:`, and name intentional replacements with `overrides` (kind, id, system, dependency provider `from`; `on` for quantities). `ctx.set`/`view.own` are package-local; deliberate shared writes use explicit `module/set`. Start from `examples/packages/ember-supplies.js` for an extension;
   - use build-time `src/sdk/authoring.ts` helpers for stable namespaced IDs and entity creation with explicit starting quantities. `QuantityDef.initial` is consumed by these helpers, not the reducer; existing entities change only through explicit events. Preserve explicit zero/false/null overrides;
   - no `Math.random`, `Date`, timers, or mutable execution state outside the generator: the host replays a macro from the start after an answer. Shared pure helpers and constant definitions are fine; persistent state belongs in recorded quantities or `ctx.set`;
   - a macro spans one action, never a phase; keep `applies`, `available` and `targets` quick and pure; any call over 250 ms shuts the package off.
5. **Bump `version`** in the manifest on every published change (patch for fixes, minor for new rules, major when a saved game or replay would play differently).
6. **Exercise it.** Build typed sources, then use `pnpm package:scenario <scenario.json>` on trusted local code to inspect setup, questions, reconstructed continuation, diagnostics and package-free replay. This is an authoring tool, not a test suite or security sandbox. Also play it: run `pnpm dev`, load the built file on the debug page, start hotseat and two-tab play; a third tab without package code must stay in sync.
7. **Run the `ip-check` skill** on the file before it is shared.

## Don't

- Don't leave imports in published package bytes; local source imports must be bundled away. The sandbox has no network or module resolution.
- Don't put a publisher's names, stats, points or rules text in the file. Players bring their own army data.
- Don't change a published package's `id`: saved games name it.
