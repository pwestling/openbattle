# Open Battle

> Open Battle is an independent project and is not affiliated with or endorsed by any game publisher. Warhammer 40,000, Warhammer: The Old World and related names are trademarks of Games Workshop Ltd. This repository ships no publisher artwork, models, unit data or rules text. Players bring their own armies, and the sample armies in the app are made up.

A peer-to-peer tabletop engine for miniatures wargames. Players connect over WebRTC; one peer is the host and resolves every intent into an event in a shared log, so undo, late joining and desync checks all come from the log. A game is a rules package that runs in a sandbox. Nothing is built in.

The app is being rebuilt from a minimal base (the core, the network, the sandbox and a debug page). See [docs/architecture.html](docs/architecture.html) for how the pieces fit, and [CLAUDE.md](CLAUDE.md) for the rules of the repo.

## Running it

```sh
pnpm install
pnpm dev          # the debug page, with hot reload
pnpm relay        # optional: a self-hosted signalling relay (docs/self-host.md)
```

| Command          | What it does                                     |
| ---------------- | ------------------------------------------------ |
| `pnpm dev`       | Dev server with hot reload                       |
| `pnpm typecheck` | TypeScript, strict (`tsc -b`)                    |
| `pnpm lint`      | ESLint                                           |
| `pnpm format`    | Prettier                                         |
| `pnpm schemas`   | Regenerate the protocol schemas from their types |
| `pnpm deadcode`  | knip: unused files, exports and dependencies     |
| `pnpm build`     | Production build into `dist/` (static)           |
| `pnpm relay`     | Self-hosted signalling relay                     |

## Licence

Code is MIT ([LICENSE](LICENSE)).
