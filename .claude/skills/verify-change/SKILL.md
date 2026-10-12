---
name: verify-change
description: Run the right Open Battle checks for a change before pushing (format, lint, typecheck, schemas, i18n, smoke) and check compatibility impact. Use before every push or pull request.
---

# Verify a change

## Always

```sh
pnpm format
pnpm lint
pnpm typecheck      # tsc -b; `tsc --noEmit -p .` checks nothing
```

## Depending on what changed

| Touched                             | Also run                                          |
| ----------------------------------- | ------------------------------------------------- |
| On-screen text                      | `pnpm i18n:check`                                 |
| Exports or files added or removed   | `pnpm deadcode`                                   |
| A path a player clicks through      | `pnpm smoke <name>` (list in `scripts/smoke.mjs`) |
| Sample armies, rules text, `games/` | the `ip-check` skill                              |

## Compatibility

Ask of the diff, and say the answer in the commit or pull request:

- Does an event, intent or network message change shape? Bump `PROTOCOL` in `src/protocol.ts`.
- Does a saved game or replay now play differently on a built-in system? Note it in `CHANGELOG.md`: it changes that game's ranked ruleset.
- Does `src/sdk` change in a way an existing package would notice? That is a `MODULE_API` question; read [docs/compatibility.md](../../../docs/compatibility.md).
- Does what a ranked result signs change? Old signatures must still verify.

## Before calling it done

Re-read the diff as a reviewer would, and push only when everything above is clean.
