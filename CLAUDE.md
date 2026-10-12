# Open Battle

A peer-to-peer tabletop engine for miniatures wargames: WebRTC between players and a host-authoritative event log. A game is a sandbox-loaded rules package; agents write the packages (humans no longer write code), so there are no editors for them. The app is being rebuilt from a minimal base: the core, the network, the sandbox and a bare debug page (`src/App.tsx`), with a 3D table to come back later and 40k to be built as a package on top. The old app is at git tag `pre-minimal-cut`.

Start with the architecture page, [docs/architecture.html](docs/architecture.html) (published as an artifact), and [CONTRIBUTING.md](CONTRIBUTING.md).

**Keep `docs/architecture.html` and its published artifact up to date as you change components or how they interact.** It is a one-page diagram whose components zoom into their own diagrams; update the affected level in the same commit as the change.

## Rules that never bend

- **No publisher IP.** Never commit unit names, stats, points, rules text, art or models from Games Workshop or any other publisher, not even in tests or comments. Sample armies are invented. Run the `ip-check` skill when in doubt.
- **`src/core` is deterministic.** No `Math.random`, `Date`, timers or DOM. Dice come from the rng passed in. Package and module procedures read the game only through `ctx.view` and roll only with `ctx.roll`.
- **Everything peers must agree on is an event in the log.** Undo, replays, late joining, "What if" branches and desync checks all depend on it.
- **Rules are advisory.** A check is a warning the player can override, never a wall.
- **Compatibility is a promise.** Every file, link, message and server API others can use is a versioned protocol listed in [docs/protocols](docs/protocols/README.md). Within a major version, changes only add. Read it and [docs/compatibility.md](docs/compatibility.md) before changing an event's shape, a file format, the network messages, `MODULE_API` or what a ranked result signs.

## Checks

```sh
pnpm format && pnpm lint && pnpm typecheck && pnpm schemas:check
```

- Type check with `pnpm typecheck` (`tsc -b`). `tsc --noEmit -p .` checks nothing here.
- Tests, soak runs and CI were deleted on purpose while the play experience is rebuilt. Do not add them back unasked.
- `pnpm schemas:check` fails when a type behind a protocol changed without its schema. Additive change: `pnpm schemas` and commit. Breaking change: a new major version (docs/protocols/README.md).
- `pnpm deadcode` (knip) must stay clean: delete what is unused rather than exporting it.
- There is no CI (only the deploy workflow), no unit tests, no soak and no browser smoke test. Check a change by playing it.

## Where things go

- Games are package files ([docs/packages.md](docs/packages.md)), loaded in the sandbox. There are no built-in games.
- The page's styles are in `src/styles.css`.

## Delegating to subagents

For file searches, information gathering and simple tasks across the codebase that fit in under about 100k tokens of context, fan out Haiku 5.5 subagents (`model: "haiku"`) instead of doing the reading in the main session. Split independent questions across agents and launch them in one message so they run in parallel. Give each a narrow scope and say what to report back (paths, line numbers, a short conclusion, not file dumps). Keep design decisions, cross-cutting changes and anything needing more than ~100k tokens of context in the main session.

## Skills

`.claude/skills/` has guided workflows: `rules-package`, `ip-check`, `verify-change` and `propose-change`.
