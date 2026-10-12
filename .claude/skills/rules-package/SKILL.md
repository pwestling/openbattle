---
name: rules-package
description: Write or change an Open Battle rules package (a single JS file players load at runtime) that adds rules to a game or a whole new game. Use when asked for a house rule, an ability, a mod, or a new game as a package.
---

# Write a rules package

A package is one ES module with no imports, run only on the host in a sandboxed worker and shared peer to peer by its SHA-256. Every byte change is a new version every player must accept again.

## Steps

1. **Pick the kind.** `kind: "system"` is a whole game: the default export is a module (`api: 2`, `id`, `quantities`, `pointer`, `actions`, `macros`, `hooks`, `panel`). `kind: "extension"` adds actions, macros and hooks to the games its `systems` name (a prefix match). Read [docs/packages.md](../../../docs/packages.md).
2. **Start from the example**, never a blank file: `examples/packages/ember-skirmish.js` uses quantities, modifiers, the pointer, a hook, a secret and a question once each.
3. **Write the manifest as a plain literal.** The app reads it without running the file, so no variables, calls, spreads or template strings. Set `api` to `MODULE_API` from `src/sdk/index.ts` (now 2), give a stable `id` (`author.name`), a semver `version`, and an `adds` sentence that tells a stranger what the code will do.
4. **Write the rules** against the types in `src/sdk/index.ts`:
   - a game's own moves are macros: generators that yield `ctx.roll`, `ctx.ask`, `ctx.emit` (only the core's primitive events), `ctx.set`, `ctx.secret`, `ctx.reveal`, `ctx.note`;
   - read the game only through `ctx.view`, roll only with `ctx.roll`, keep lasting state with `ctx.set` or quantities;
   - no `Math.random`, `Date`, timers, or variables outside the generator: the host replays a macro from the start to carry on after an answer;
   - a macro spans one action, never a phase; keep `applies`, `available` and `targets` quick and pure; any call over 250 ms shuts the package off.
5. **Bump `version`** in the manifest on every published change (patch for fixes, minor for new rules, major when a saved game or replay would play differently).
6. **Check it by playing it.** There are no unit tests. Run `pnpm dev`, load the file on the debug page, and start a game in hotseat, then in two tabs; a third tab that never loaded the package can watch and must stay in sync.
7. **Run the `ip-check` skill** on the file before it is shared.

## Don't

- Don't import anything; the sandbox has no network and no modules.
- Don't put a publisher's names, stats, points or rules text in the file. Players bring their own army data.
- Don't change a published package's `id`: saved games name it.
