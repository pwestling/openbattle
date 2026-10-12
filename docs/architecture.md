# Architecture

A map of the code, for finding your way in. The README's "How it works" has the ideas; this says where they live.

## The one flow

```
player input ─► Intent ─► host: resolveLogged (rolls dice) ─► LoggedEvent ─► record
                                                                    │
                     every peer: applyEvent in order ◄──────────────┘
                                    │
                         GameState ─► React UI + three.js table
```

- A **GameState** (`src/core/types.ts`) is plain, serialisable data: players, units, models, terrain, the turn, and whatever a game module keeps.
- A **GameRecord** is the starting state plus the numbered events. `stateAt(record, seq)` rebuilds any moment; undo, replays, branching, late joiners and play by mail all read the record.
- Only the host turns intents into events (`src/net/session.ts`), so only the host rolls dice. Clients send intents and apply what comes back. If the host leaves, another player takes over from the same record.
- The UI never changes the state directly. It calls `dispatch(intent)` on the store (`src/store.ts`), which sends it to the session.

## Folders under `src/`

| Folder                           | What it holds                                                                                                                                                                                                                                                                                                                     |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `core/`                          | The engine, with no React or three.js: types, reducer, event log, dice, geometry, line of sight, terrain, regiments, attacks, secrets, teams, clocks. `core/units.ts` has the small unit helpers (`aliveModels`, `isAlive`, `centreAbove`). Import from `../core`.                                                                |
| `core/content/`                  | Rules as data: the schema, the expression language (`expr.ts`), the procedure runner that plays attack sequences step by step (`runner.ts`), turn structure (`turn.ts`), and checks for module data (`validate.ts`).                                                                                                              |
| `systems/`                       | The built-in game: `wh40k`, the sci-fi battle. It exports a `SystemModule` (`systems/app.ts`): its rules data and code, starting table, sample armies and panels. 40k army import and ability recognition live in `systems/wh40k`.                                                                                                |
| `sdk/`                           | The public API that game modules and packages write against. Everything a community module may use comes from here.                                                                                                                                                                                                               |
| `sandbox/`                       | Runs package games (rules loaded at runtime) in a worker, so their code can't touch the page. The engine side asks the worker for each event.                                                                                                                                                                                     |
| `packages/`                      | Loading, hashing and sharing rules packages; peers compare the package's SHA-256 and warn on a mismatch. Faction packs (#76): read, applied to armies by name (`faction.ts`), loaded from a link and pinned by hash (`packPins.ts`).                                                                                              |
| `net/`                           | Sessions and transports: Trystero (WebRTC over Nostr or our relay), a loopback for hotseat and tests, the host's log, checksums, host hand-over.                                                                                                                                                                                  |
| `store.ts`                       | The zustand store: the record, the current state, selection, scrub position, view settings, and `dispatch`.                                                                                                                                                                                                                       |
| `render/`                        | The 3D table (React Three Fiber). `Board.tsx` is the scene; `TablePieces.tsx` (grid, zones, terrain, objectives), `ModelOverlay.tsx` (rings, ghosts, hover labels) and `boardLabels.tsx` (rulers, range outlines, sight lines) are its pieces. Regiments, templates, casualties, cameras and table talk each have their own file. |
| `ui/`                            | The React screens and panels around the table: lobby, top bar, unit cards, attack and procedure panels (`SystemPanels.tsx`, `ProcedurePanels.tsx`), dice tray, game log text (`gameLog.ts`), warnings, odds, stats. Shared UI helpers: `distance.ts` (lengths in the game's units), `files.ts` (saving files), `systemLabels.ts`. |
| `missions/`                      | Missions and scoring suggestions.                                                                                                                                                                                                                                                                                                 |
| `bot/`                           | The computer opponent: `player.ts` picks a level, `thinker.ts` is the Thinker (Steady, Sharp and the review's analyst), `moves.ts` the moves it can make; the evaluator, the worker it thinks in, and `SoloBot.tsx` which plays its moves.                                                                                        |
| `soak/`                          | The soak bot: random legal play to find crashes and desyncs (the Workshop's package checker runs it).                                                                                                                                                                                                                             |
| `teach/`                         | Lessons and the coach.                                                                                                                                                                                                                                                                                                            |
| `replay/`, `share/`              | Replay files and the viewer; clips, picture cards and round cards for sharing.                                                                                                                                                                                                                                                    |
| `opentables/`                    | Open tables: the public board of games looking for players, and Live now (#64: games to watch, behind the play). Posts are signed Nostr events on the same relays as signalling, or sit on a self-hosted relay's board (`server/board.mjs`). Only a player's Post click publishes.                                                |
| `mail/`                          | Play by mail: signed turn files, commit-reveal dice, and the mailbox client.                                                                                                                                                                                                                                                      |
| `campaign/`                      | The campaign book: leagues, maps, unit stories, campaign rules.                                                                                                                                                                                                                                                                   |
| `review/`                        | Game review (#61, #63): the Sharp-eyed scoring of each decision, run in workers (`worker.ts`, sandboxed for package games), the trust benchmark (`trust.ts`, `bench/`) and the review panel.                                                                                                                                      |
| `player/`, `ranked/`             | The player card: a signing key, a name and a badge (`card.ts`). Ranked games (#65): signed results, ratings worked out on each device from the results it has seen, and the sign/decline flow at the table (`RankedGame.tsx`).                                                                                                    |
| `events/`                        | Online events (#67): signed event and entry docs on the Open tables board, Swiss pairing and standings done in the organiser's browser (`event.ts`, `store.ts`), the event page (`EventsUI.tsx`) and the seat bar at an event table (`EventSeat.tsx`).                                                                            |
| `standees/`                      | Photo standees (#68): the in-browser cutout (`cutout.ts`), the outline-cut card mesh (`mesh.ts`), the `.standee` file and its build in the import worker, and the maker. They go through the figure pipeline like any upload.                                                                                                     |
| `secrets/`                       | This device's side of hidden state: what it committed to and can reveal (see `core/secrets.ts`).                                                                                                                                                                                                                                  |
| `tables/`, `figures/`, `assets/` | Saved tables, the figure library, and the model import pipeline (glTF/STL to compressed meshes).                                                                                                                                                                                                                                  |
| `talk/`, `voice/`, `broadcast/`  | Table talk (pings, drawings, chat), voice over WebRTC, and caster/broadcast views.                                                                                                                                                                                                                                                |
| `workshop/`                      | The module workshop: editor, test table, export.                                                                                                                                                                                                                                                                                  |
| `i18n/`                          | `t`, `tc`, `tn` and the PO catalogs. See [translating.md](translating.md).                                                                                                                                                                                                                                                        |
| `sw/`, `viewer/`, `dev/`         | The service worker, the stand-alone replay viewer build, and dev-only tools.                                                                                                                                                                                                                                                      |

Outside `src/`: `server/` holds the signalling relay (with the self-hosted Open tables board), the play-by-mail mailbox and the seed node. `scripts/` holds the browser checks (`pnpm smoke`, `pnpm soak:browser`, perf, screenshots). `examples/` holds sample packages, lessons and workshop templates.

## Addresses

The address bar says where the player is ([src/ui/route.ts](../src/ui/route.ts)). Screens are hash routes, so any static host serves them with no fallback, offline included:

| Address                                           | Screen                                                                                     |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `/`                                               | Front door                                                                                 |
| `#/play/<game>`                                   | That game's "How hard?" (the old `?play=<game>`)                                           |
| `#/tables`                                        | Open tables (the old `?tables=1`)                                                          |
| `#/rules/<game>`                                  | A game's rules page (the old `?rules=<game>`)                                              |
| `#/workshop`                                      | Module workshop (`?workshop=<url>` still opens a module in it)                             |
| `#/figures`, `#/figures/storage`, `#/figures/tts` | Figure library                                                                             |
| `#/player`, `#/ladder[/<game>]`                   | Player card, ladder                                                                        |
| `#/event/<id>`, `#/event/new`                     | An event's page, running one                                                               |
| `#/game`                                          | A game on this screen (hotseat, the computer, a lesson); a reload resumes it from its save |
| `#/replay`                                        | A replay file                                                                              |
| `?room=<id>`                                      | An online room: its invite link, as before                                                 |

Opening a screen adds a history entry and closing it goes back to the one before. Back out of a game leaves it the way "Leave game" does, asking first in an online game; Forward goes back in (a hotseat game from its save, a room by rejoining). An address with a game nothing can come back into, such as someone else's `#/game`, opens the front door. Hashes that aren't routes (`#mail=`, `#key=`) are left to the screens that read them.

## Rules that keep it working

- **Everything that changes the game goes through the log.** If peers must agree on it, it's an event. Table talk, camera moves and highlights are not.
- **Core is deterministic.** No DOM in `src/core`, and dice come from the rng passed in (the host's, in `resolveLogged`), never from `Math.random` directly. Applying an event must give every peer the same state; that is what makes replays and desync checks work.
- **Game IP stays out.** Built-in systems ship rules mechanics only. Unit data, names and stats come from what players import.
- **Lengths are inches internally.** Show them with `lengthText` / `distanceText` from `ui/distance.ts`, which use the game's own units.

## Checks

There is no CI, no unit-test suite and no browser smoke test: they were deleted on purpose while the play experience is rebuilt. `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm schemas:check` and `pnpm i18n:check` are run by hand, and `pnpm deadcode` (knip) keeps unused files and exports out. The only workflow is the continuous deploy to craftworld.

The first page is 285 kB gzipped (JS and CSS the HTML loads), up from 218 kB at #48: mostly the store and core chunks growing with #59–#68. Everything else loads on demand (10.6 MB of JS over 88 chunks, the workshop's 4 MB types worker included).
