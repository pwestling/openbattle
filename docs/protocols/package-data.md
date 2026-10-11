# Package data: armies and missions

**Provisional.** It may still change before it is marked stable, but only by adding. It covers what a rules package can bring besides rules: armies, read as data, and missions. The rest
of the package file (its manifest, code and data rules) is described in [packages.md](../packages.md). Reader:
`src/packages/armies.ts`. Fixtures: [`conformance/package-armies/v1`](../../conformance/package-armies/v1): a reader loads every file in `valid/`, taking the good entries and warning about each bad one.

Both are additions to module API 1 (`api: 1`). An Open Battle build from before them loads the same package and
ignores `armies` and `missions`, so a package that adds them still works there, without its armies and missions.
They need Open Battle 0.2.0 or later.

## Armies

A package of kind `extension` (or a whole game, kind `system`) may export a list of armies:

```js
export const armies = [
  {
    format: "open-battle/army-list@1",
    name: "Reedmarsh Wardens",
    system: "qd6-1",
    units: [{ name: "Reed Archers", size: 5, characteristics: { Q: "4+", D: "5+" } }],
  },
];
```

- **Each entry is an Army list v1 document** ([army-list.md](army-list.md)), exactly as a builder would write it to
  a file. Everything that spec says about reading it holds here: unknown fields are ignored, the `format` line
  carries the major version, and rules are bound by name by the game.
- **Data, never run.** `armies` is read from the package's source the way the manifest is: a plain literal of
  objects, arrays, strings, numbers, booleans and null, with comments and trailing commas allowed. Variables,
  calls, spreads and `${}` templates make the whole list unreadable (a warning); the package's rules still load.
- **Bad entries are warnings, not failures.** An entry of a major the reader doesn't know, with no name or with no
  units is left out with a warning naming its index. The other entries are read.
- **Which game.** An army that names a `system` is offered in games of that system (a prefix matches as the
  manifest's `systems` do: `qd6` covers `qd6-1`). One that names none is offered in the games the manifest's
  `systems` lists.
- **Where they appear.** While a game names the package (it is ticked in **Game settings**, or the game is the
  package's own), its armies are offered beside the game's sample armies when adding an army, and can be put on
  the player's army shelf, each labelled with the package's `name`. The package's bytes are pinned by hash as
  for any package; its armies change only when its bytes do.
- **Lesson and faction packages** carry other data (`lessons`, `faction`) and bring no armies.

A builder that writes Army list v1 files can put the same documents in a package, so a package's sample armies and
the lists players bring are one format.

## Missions

An extension's default export may have `missions`: the same `Mission` objects a whole game gives in
`module.app.missions` (`Mission` in `src/sdk/index.ts`; [packages.md](../packages.md#a-whole-game)).

```js
export default {
  missions: [
    {
      id: "border-muster.fording", // prefix your ids with the package's name
      name: "The Fording",
      summary: "One ford in the middle. At the end of each round, 2 VP to the side holding it.",
      setup: (table) => ({ zones: [...], objectives: [{ id: "ford", position: { x: 0, y: 0 } }] }),
      scoring: [{ id: "ford", name: "Hold the ford", at: { roundEnd: true }, suggest: (game, seat) => null }],
    },
  ],
};
```

- They are added to every game the manifest's `systems` covers, after the game's own missions, and players pick
  from all of them at setup. One with the `id` of a mission already there replaces it.
- They are code, so they run in the package sandbox like a whole game's missions: `setup` for the game's default
  table and for the table played on, and `suggest` at each scoring moment, its answers handed to the app. A player
  confirms every score, as for any mission.
- The chosen mission is recorded in the game by `id` and name, with the zones and objectives its setup gave. A
  game whose package isn't running keeps its zones and objectives and is scored by hand.

## Versions and compatibility

- `armies` and `missions` are optional fields of module API 1. Changing what either means would be a new module
  API, as [compatibility.md](../compatibility.md) says for `src/sdk`.
- An army's shape is Army list v1's and versions with it. A reader that meets `open-battle/army-list@2` in a package
  leaves that entry out with a warning until it reads v2.
