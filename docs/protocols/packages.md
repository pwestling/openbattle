# Packages

A rules package is one JavaScript module file that is a whole game or adds to one. How to write one is in [../packages.md](../packages.md); this page is the contract between a package and every Open Battle build that loads it.

## Identity

A package is identified by the **SHA-256 of its exact bytes**. Every player's app checks the bytes against the hash before using them, asks the player before running a package it hasn't seen, and treats any byte change as a new package. Packages travel between peers by hash ([peer-protocol.md](peer-protocol.md#outside-the-log)).

## The manifest

Schema: [manifest.v2](../../schemas/manifest.v2.schema.json). Code: `Manifest` and `readManifest` in `src/packages/manifest.ts`.

The file starts with `export const manifest = { ... }`. The app reads it as data **without running the file**, so it must be a plain literal: strings, numbers, booleans, arrays and objects, with no expressions or references.

| Field       | Meaning                                                                                          |
| ----------- | ------------------------------------------------------------------------------------------------ |
| `id`        | The package's name for good. Keep it across versions                                             |
| `name`      | Shown to players                                                                                 |
| `version`   | Semver: patch for fixes, minor for new rules, major when an existing game would play differently |
| `author`    | Optional                                                                                         |
| `api`       | The module API it was written for: `MODULE_API` in `src/sdk/index.ts`, now `2`                   |
| `kind`      | `system` (a whole game) or `extension` (adds to the games its `systems` name)                    |
| `systems`   | The game ids it is for                                                                           |
| `requires`  | Other packages it needs, by `id` and optionally `hash`                                           |
| `adds`      | Optional: a line saying what it adds, for the consent screen                                     |
| `changelog` | Optional                                                                                         |

## The module API

**`MODULE_API = 2`.** The TypeScript types in `src/sdk/index.ts` are the definition, with the guide in [../packages.md](../packages.md). A package's code runs in a sandboxed worker, only on the host, and reaches the game through `ctx.view` (reading) and the commands it yields.

Anything an existing package would notice (a removed or renamed field, a changed `ctx` shape, a primitive event whose meaning changes) raises `MODULE_API`. The app refuses a package whose `api` it doesn't support, by name and with the reason.

The messages between the app and the sandbox (`src/sandbox/protocol.ts`) are internal.
