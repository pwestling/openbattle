# Contributing to Open Battle

Thanks for helping. Open Battle is a browser-based, peer-to-peer tabletop for miniatures wargames. This page covers how to get it running, what to check before you push, how the code is laid out, and the few rules the project holds to.

## Setup

You need Node 22 or newer and [pnpm](https://pnpm.io). `corepack enable` gives you the right pnpm version.

```sh
pnpm install
pnpm dev          # http://localhost:5173, the debug page
```

The debug page starts an explicit hotseat preset (participants at seats 0 and 1), or hosts/joins a room: open tabs in "local" mode. Choose a seat identifier or stay unseated; the Seating controls record later changes. Packages own player-count/alliance/turn policy. Load a rules package from `examples/` with **Load a package**.

## Before you push

There is no CI. Run these locally:

```sh
pnpm format       # Prettier
pnpm lint         # ESLint
pnpm typecheck    # tsc -b, the real type check
pnpm schemas:check
pnpm deadcode     # knip: delete what is unused
```

Type check with `pnpm typecheck` (or `pnpm tsc -b`). The root `tsconfig.json` only holds project references, so `tsc --noEmit -p .` checks nothing and always passes.

## Code layout

How the pieces fit is on the architecture page, [docs/architecture.html](docs/architecture.html): open a component to see what it owns, what it talks to and which files to read first. In short: `src/core` is the deterministic engine, `src/net` moves intents and events between peers, `src/sandbox` and `src/packages` load and run a game's rules package, `src/sdk` is what a package can use, and `server/` is the optional signalling relay.

## Principles

- **Rules are advisory.** The engine measures, highlights, rolls and reminds, but it never blocks a move or a roll. Every number can be edited and every action can be undone. Players stay in charge, as at a real table. If you add a check, make it a warning, not a wall.
- **The game is an event log.** Players send _intents_. Only the host turns an intent into a numbered, fully resolved _event_ (this is where dice are rolled) and appends it to the log. Every peer applies the same events in the same order, so the table is always the starting state with the log folded over it. Live sync, undo, late joining, spectating, replays and "What if" branches all come from that one log. Code in `src/core` must stay deterministic: no `Math.random`, no clocks, no reading from the DOM.
- **A game is a rules package.** Its rules are partly data (`GameSystem`: characteristics, dice, turn structure, keyword rules, data procedures) and partly code (actions, generator procedures, turn hooks, pure functions), loaded in the sandbox. Use data for simple keywords and modifiers, and code when a rule needs branches or loops. See [docs/packages.md](docs/packages.md).
- **No publisher IP in the repo.** Never commit unit names, stats, points, rules text, artwork or models from Games Workshop or any other publisher. Sample armies, missions and rules in this repo are invented. Describe built-in games by how they play ("Sci-fi battle", "Rank and flank"), not by trademarked names, on screen.
- **Player data stays with players.** Army lists, uploaded figures and published rules are imported by players at runtime and never committed, not even as test fixtures. Write test rosters by hand with made-up names.

## More docs

- [docs/packages.md](docs/packages.md): write a rules package that players load at runtime.
- [docs/authoring.md](docs/authoring.md): typed package builds, explicit entity defaults, diagnostics and local scenarios.
- [docs/engine.md](docs/engine.md): engine/package responsibilities and the neutral geometry API.
- [docs/self-host.md](docs/self-host.md): run your own copy of the app, signalling relay and TURN server.
- [docs/compatibility.md](docs/compatibility.md): how forks, builds and rules packages coexist.
- [GOVERNANCE.md](GOVERNANCE.md): who decides, and which changes need a proposal first.

## Working with Claude Code

[CLAUDE.md](CLAUDE.md) gives Claude Code the project's rules, and `.claude/skills/` has guided workflows it picks up on its own: `rules-package` (write a package), `ip-check`, `verify-change` and `propose-change`.

## Pull requests

Keep pull requests focused, say what you changed and how you tested it, and include a screenshot for UI changes. By contributing you agree that your work is released under the [MIT License](LICENSE) (or CC BY 4.0 for our games' rules and art); there is no CLA or sign-off to add. See [GOVERNANCE.md](GOVERNANCE.md#contributions). Changes to the protocol, the module API, ranked results, rulesets or the board protocol start with a **Proposal** issue.
