# Packages

A rules package is one JavaScript module file that adds to a game or is a whole game. How to write one is in [../packages.md](../packages.md); this page is the contract between a package and every Open Battle build that loads it.

## Identity

A package is identified by the **SHA-256 of its exact bytes**. Every player's app checks the bytes against the hash before using them, asks the player before running a package it hasn't seen, and treats any byte change as a new package (a new consent, and its own ranked ladder). Packages travel between peers by hash ([peer-protocol.md](peer-protocol.md#outside-the-log)) and inside replays as attachments.

## The manifest

**Stable.** Schema: [manifest.v1](../../schemas/manifest.v1.schema.json). Fixtures: [`conformance/manifest/v1`](../../conformance/manifest/v1). Code: `Manifest` and `readManifest` in `src/packages/manifest.ts`.

The file starts with `export const manifest = { … }`. The app reads it as data **without running the file**, so it must be a plain literal: strings, numbers, booleans, arrays and objects, with no expressions or references.

| Field       | Meaning                                                                                                   |
| ----------- | --------------------------------------------------------------------------------------------------------- |
| `id`        | The package's name for good. Keep it across versions: saved games, campaign books and ladders refer to it |
| `name`      | Shown to players                                                                                          |
| `version`   | Semver: patch for fixes, minor for new rules, major when an existing game would play differently          |
| `author`    | Optional                                                                                                  |
| `api`       | The module API it was written for: `MODULE_API` in `src/sdk/index.ts`, now `1`                            |
| `kind`      | `system` (a whole game), `extension` (adds to one), `lesson` (data only), `faction` (a faction pack)      |
| `systems`   | The game system ids it is for                                                                             |
| `requires`  | Other packages it needs, by `id` and optionally `hash`                                                    |
| `adds`      | Optional: a line saying what it adds, for the consent screen                                              |
| `changelog` | Optional                                                                                                  |

A reader skips manifest fields it doesn't know. A new `kind` is a new major of the manifest: an older build must not run a package whose kind it can't place.

## The module API

**`MODULE_API = 1`.** Stable. The TypeScript types in `src/sdk/index.ts` are the definition, with the guide in [../packages.md](../packages.md). A package's code runs in a sandboxed worker and reaches the game only through `ctx.view` (reading) and `ctx.roll` (dice), so the same package plays the same on every device.

- Adding to the API (a new optional hook, a new `ctx` helper) keeps `MODULE_API = 1`. A package that uses a new helper should say which app version it needs in its README.
- Anything an existing package would notice (a removed or renamed hook, a changed `ctx` shape, a hook called at a different time) raises `MODULE_API`, through a proposal. The app then refuses packages whose `api` it doesn't support, by name and with the reason, rather than run them wrongly.

The messages between the app and the sandbox (`src/sandbox/protocol.ts`) are internal. Packages see only the module API.

## Faction packs

**Provisional.** Schema: [faction.v1](../../schemas/faction.v1.schema.json). Fixtures: [`conformance/faction/v1`](../../conformance/faction/v1). Code: `FactionPack` in `src/packages/factionFormat.ts`. Guide: [../faction-packs.md](../faction-packs.md).

A package with `kind: "faction"` also has `export const faction = { … }`, read as data like the manifest. It adds rules to armies **by name**: army rules, unit abilities, detachments with their rules, enhancements and stratagems. It never carries rules text from a publisher. The data is provisional because the shape of an automated ability (`AbilityAuto`) is still growing; changes will stay additive where they can.

## Lessons

A `lesson` package has `export const lessons = [ … ]`, read as data and never run (`src/teach/lesson.ts`). Provisional.
