# Files

Every file Open Battle saves is UTF-8 JSON with a `format` line, `"open-battle/<name>@<major>"`. The format line alone says what a file is: the app's _Open a file…_ button, a dropped file and an [Open link](links.md#open-link) all go by it, whatever the file is called. The general rules (extra fields ignored, majors kept forever) are in [README.md](README.md#the-rules-every-protocol-keeps). The field-by-field definition of each format is its schema in [`schemas/`](../../schemas), generated from the TypeScript type named below.

Usual file names are `<name>.army.json`, `<name>.table.json`, `<name>.figures.json`, `<name>.standee`, `<name>.campaign.json` and `open-battle-mail-<game>-<nnn>.json`. Readers must not depend on them.

## Shared pieces

- **Attachments.** Armies, tables and replays may carry `attachments.assets`: processed 3D models (figures, terrain) as base64, keyed by the SHA-256 of the file the player first uploaded. Replays may also carry `attachments.packages`: rules package source text keyed by its SHA-256. A reader that doesn't use attachments ignores them, and the document still opens. The model encoding inside is internal for now (see the registry): pass it on untouched.
- **Hashes** are lowercase hex SHA-256. A package's hash is of its exact bytes. A campaign book's hash is of its [stable JSON](#stable-json).
- **Times** are milliseconds since 1970 (UTC). They are for display and ordering only; no rule depends on them.
- **Ids** are opaque strings. Don't parse them.

### Stable JSON

Where a hash or signature covers a document rather than bytes, it covers its stable JSON: object keys sorted, keys with `undefined` values left out, arrays in order, no spaces (`stableJson` in `src/core/secrets.ts`). Ranked results use their own fixed spelling instead ([ranked-results.md](ranked-results.md)).

## Army

`open-battle/army@1`, type `ArmyFile` in `src/packages/shelf.ts`, read by `readArmy`.

An army on the shelf: `roster` (the imported list: units, their models, profiles, weapons and abilities), `system` (the game system id), `figures` (the figure on each model, by unit index in `roster.units` and then model profile name), and optionally `dice`, `color` and `from` (the TTS table it was brought from). Figures name assets by hash, and the file may carry them as attachments.

The roster's unit and ability text is whatever the player imported. The project ships no publisher data, and a writer must not add any to a file it hands out.

## Table

`open-battle/table@1`, type `TableFile` in `src/tables/library.ts`, read by `readTable`.

A saved table: its size in inches (`table.width`, `table.depth`), the game `system`, and the `layout` (terrain pieces, deployment zones, objectives, and card decks if any). The older loose layout file, `open-battle/layout@1`, is still read as a table for the current game.

## Figure pack

`open-battle/figures@1`, type `FigurePack` in `src/figures/pack.ts`, read by `openPack`.

A named set of figures: `figures` holds each one's `id` (the SHA-256 of the original model file), name, kind, tags, the units it suits, an optional thumbnail and `data`, the processed model. The pack's `hash` is the SHA-256 of the stable JSON of `figures` sorted by id. A reader recomputes it and tells the player when it doesn't match. Fixtures for this format are still to come, because a sample needs an encoded model.

## Standee

`open-battle/standee@1`, type `StandeeFile` in `src/standees/file.ts`, read by `readStandee`.

A photo figure: the cut-out `front` (and optional `back`) as `data:image/png|webp|jpeg;base64,…` URLs, and the scale (`basePx` pixels across the base in the photo, `baseMm` its real width). The SHA-256 of the file's bytes is the figure's identity, as for any uploaded model.

## Game record and replay

`open-battle/record@1`, type `ReplayFile` (a `GameRecord` plus extras) in `src/ui/replayFile.ts`.

A whole game: `initial` (the table before the first event) and `events`, every logged event in order. Each logged event has `seq` (counting up), `by` (the player who asked), `at`, the `event` itself and, depending on the game, `host`, `told`, `intent` and `seed` (see [peer-protocol.md](peer-protocol.md#the-event-log)). Replaying the events over `initial` with the app's reducer gives the table at any point. That is what a replay viewer does, and what the conformance test checks.

The same document is the replay file. It may add `attachments` (the models and rules packages the game used) and `annotations` (notes pinned to moments). A problem report is a replay file with a `report` section; it is internal.

Event payloads are part of the [peer protocol](peer-protocol.md): a record from a build with another `PROTOCOL` may hold events this build can't replay.

## Campaign book

`open-battle/campaign@1`, type `CampaignBook` in `src/campaign/book.ts`, read by `readCampaign`.

A campaign shared by its players: `players`, the `games` recorded in it with their results, the `map`'s territories, the `units` that have fought in it (by `<army id>:<index>`), `notes`, an optional `event` (Swiss rounds and pairings) and the campaign rules packages it plays with (`rules`). Peers exchange books by hash.

## Player identity

`open-battle/player@1`, type `PlayerFile` in `src/player/card.ts`, read by `readCardFile`.

A player's card (`name`, two `colors`) and their `identity`: an ECDSA P-256 key pair as JSON Web Keys. The public key is who they are on the ranked board and in mail games. **The file holds the private key.** Whoever has it can sign as that player, so it moves only between that player's own devices. A reader checks that the two keys belong together before accepting it. The fixture's keys were made for the test and sign nothing real.

## Play-by-mail turn

`open-battle/mail@1`, type `MailFile` in `src/mail/file.ts`, read by `parseFile`, checked by `signatureOk`.

One player's turn in a mail game: the game id, the file's `index` (1 is the invitation, then the players alternate), the sender (`from`, `name`, public `key`), where the stretch starts (`base`), the dice commitments (`reveal`, `theirs`, `commit`), the `intents` played and the `events` they made. The invitation also carries the game so far as a replay file in `record`, and the mailbox in `box`. [correspondence.md](../correspondence.md) explains the flow and the dice.

`sig` is an ECDSA P-256 / SHA-256 signature, base64, over `JSON.stringify` of the file without `sig`, **in the file's own key order**. A tool that rewrites a mail file must keep key order or the signature fails. The next major version should sign the stable JSON instead; until then this is a known wart.

## Formats we read from others

These belong to other projects. We follow them, we don't define them, and the app's readers are the reference for what is understood:

- BattleScribe and New Recruit rosters (`.ros`, `.rosz`, their JSON and XML): `src/systems/wh40k/roster.ts`, plus the Conquest and Old World readers under `src/systems/*/roster.ts`.
- Yellowscribe army data: `src/systems/wh40k/yellowscribe.ts`, both ways. A Yellowscribe file also opens anywhere an army file does.
- Tabletop Simulator saves: `src/figures/tts.ts` and `src/tts/`.
- 3D models: glTF/GLB, STL, OBJ and PLY (`src/assets/parse.ts`).
