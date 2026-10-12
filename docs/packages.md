# Writing a rules package

A game is a rules package: one JavaScript file whose default export is a module. The core knows only physical things (units of models, tokens and terrain on a table, decks, hidden values, dice, a pointer saying where the game is up to). A module says what a game adds. It never touches the table directly: it expands its actions into the core's primitive events, and the host logs those. Everything below is checked in `examples/packages/ember-skirmish.js`, a small invented game that uses each part once; copy it to start.

## The file

```js
export const manifest = {
  id: "me.my-game", // the package's name for good: keep it across versions
  name: "My game",
  version: "0.1.0",
  api: 2,
  kind: "system", // a whole game; "extension" adds to the games named in `systems`
  systems: ["my-game"],
  requires: [],
  adds: "One line for the consent screen",
};

export default {
  api: 2,
  id: "my-game",
  name: "My game",
  version: "0.1.0",
  table: { width: 36, depth: 24 },
  layout: (table) => ({ terrain: [], tokens: [], zones: [] }),
  quantities: [{ id: "hp", name: "Hit points", on: "unit", initial: 3 }],
  pointer: [
    { id: "order", name: "Order" },
    { id: "strike", name: "Strike" },
  ],
  actions: [/* CodeAction */],
  macros: {/* Macro by id */},
  hooks: {
    on: {
      "models/move": function* (ctx, args) {
        /* ... */
      },
    },
  },
  panel: (view) => ({ title: "My game", lines: [] }),
};
```

The manifest is read as data without running the file, so it must be a plain literal. `src/sdk/index.ts` has the types (`defineModule`, `ModuleDef`, `CodeAction`, `Ctx`, `GameView`); a package file has no imports, so it exports a plain object.

## What the core gives you

Entities: players, units (each with models), models, tokens, terrain, zones, decks. Players, units, models and tokens carry two open bags: `q` (named quantities and attributes: wounds, command points, a profile) and `tags`. Modifiers are kept as records (`mod/add` with an op, a value and an optional `until`) and a quantity's value is worked out from its stored base and the modifiers that hold (`view.q(ref, key)`). `until: view.until("n")` means "while the pointer's `n` field stays as it is now".

Primitive events a module may emit: `entity/set`, `q/set`, `q/adjust`, `tag/set`, `mod/add`, `mod/remove`, `models/move`, `unit/move`, `unit/add`, `unit/remove`, `unit/members`, `model/add`, `model/remove`, `token/add`, `token/remove`, `terrain/*`, `pointer/set`, `deck/shuffle`, `log/note`, `module/set`. Dice, secrets and questions have their own commands (below).

The pointer is `{ round, seat, phase, ... }` and is yours: the core only stores it. "Next phase" is an action of yours that emits `pointer/set`.

## Actions and macros

An action is a button the page offers: `{ id, name, by: "unit" | "player", phases?, applies?, available, targets?, run }`. `run` is a macro, a generator that yields commands and gets their results back:

| Command                                      | Does                                                                           |
| -------------------------------------------- | ------------------------------------------------------------------------------ |
| `ctx.roll("2D6", label?)`                    | dice from the host's rng; the result is `{ rolls, total }`                     |
| `ctx.ask(player, question, options)`         | pauses until that player answers; the result is the option id                  |
| `ctx.emit(event)`                            | one of the primitive events above                                              |
| `ctx.set(key, value)`                        | this module's own state (`view.own`)                                           |
| `ctx.secret(player, key, question, options)` | the player's device keeps the choice; only a commitment goes on the table      |
| `ctx.reveal(player, key)`                    | the player reveals it; everyone checks the commitment; the result is the value |
| `ctx.note(text)`                             | a line in the log                                                              |

`args.by` is the player who started the macro; `args.unit` and `args.target` are whatever the action's buttons sent. A macro spans one action (an activation, an attack), never a phase: between actions the game's state lives in the pointer, quantities and `ctx.set`.

### Be deterministic

The host runs a macro once per step and, to carry on after an answer, replays it from the start feeding back the recorded results. The replay must yield the same commands or the macro is stopped. So: read the game only through `ctx.view`, roll only with `ctx.roll`, no `Math.random` or `Date`. After an answer, `ctx.view` is the table as it stands when the answer was given, including anything that moved while the question was open; before it, the table as the macro saw it, plus its own emitted events.

### Hooks

`hooks.on["models/move"]` starts a macro after every logged event of that type (including ones a macro emitted), one at a time, once no other macro is waiting. It gets `{ event, seq, by }`, and `from` (the previous pointer) for `pointer/set`. A hook run is tied to the event that set it off: undoing that event undoes the run. Hooks set off by hooks stop four runs deep.

## Where code runs

Module code runs only on the host, inside the sandbox (a worker with no network and an opaque origin), when it resolves a new `macro/start` or `macro/answer` intent. What a macro emits reaches every peer as ordinary events inside one `macro/step` envelope, so replays, undo, late joining and desync checks never need the module: a spectator without the package folds to the host's state hash. Undo takes a macro run with it (every later step of the run, and any run its event set off).

## Trying it

`pnpm dev`, then on the debug page choose a mode, **Load a package…** with the file, **Start**. The module's actions appear under "The module's actions"; the primitive intents and the event log are below. Open a second tab in "local" mode to join as a client; a tab that never loaded the package can still **watch**.
