# Army list v1 (DRAFT)

**Status: DRAFT.** Open source stewardship owns the project's interop specs; this one may still change before it is
marked stable. Schema: [`schemas/army-list.v1.schema.json`](../../schemas/army-list.v1.schema.json). Fixtures:
[`schemas/fixtures/army-list/`](../../schemas/fixtures/army-list/). Reader: `src/share/armyList.ts`.

An army list file says which units a player brings to a game: their names, model counts, characteristics, special
rules by name and weapons. Any army builder can write one, and Open Battle opens it from a dropped file, the lobby's
_Open a file…_, the _Import a list_ button in a game, or a share link. The format names no game and no publisher:
characteristics and rules are keyed by whatever names the game uses, and the Open Battle game system reads them.

Nothing in the file is sent anywhere by Open Battle. A list opened from a file stays on the player's device; one
opened from a link is fetched by the player's browser from wherever the builder put it.

## The file

A UTF-8 JSON object. `.json` is the usual extension.

| Field      | Required | Type                         | Meaning                                                                                           |
| ---------- | -------- | ---------------------------- | ------------------------------------------------------------------------------------------------- |
| `format`   | yes      | `"open-battle/army-list@1"`  | The format and its major version.                                                                 |
| `name`     | yes      | string                       | The list's name, shown on the army shelf.                                                         |
| `units`    | yes      | array of units, at least one | The units, in the order the builder lists them.                                                   |
| `system`   | no       | string                       | The Open Battle game system it is for, by id (`qd6-1`, or a package game's id).                   |
| `points`   | no       | number                       | The list's total; the units' points are added up when missing.                                    |
| `builder`  | no       | `{ name?, version?, url? }`  | The tool that wrote the file (`url` is https).                                                    |
| `packages` | no       | array of `{ url, sha256? }`  | Rules packages the list is written for: each an https link to the package file, with its SHA-256. |

A unit:

| Field             | Required | Type                       | Meaning                                                                                        |
| ----------------- | -------- | -------------------------- | ---------------------------------------------------------------------------------------------- |
| `name`            | yes      | string                     | The unit's name as the player wants it shown.                                                  |
| `size`            | no       | integer 1–200              | Models in the unit; 1 when missing.                                                            |
| `points`          | no       | number                     | What the unit costs, as the builder counted it (upgrades included).                            |
| `characteristics` | no       | object of string or number | Each model's characteristics, keyed by the game's ids or names: `{ "Q": "4+", "Defense": 4 }`. |
| `rules`           | no       | array of rules             | Special rules by name (below).                                                                 |
| `keywords`        | no       | array of strings           | Keywords the game may read (a unit type).                                                      |
| `base`            | no       | base                       | `{ "shape": "round", "diameterMm": 32 }`, or `"oval"`/`"rect"` with `widthMm` and `depthMm`.   |
| `weapons`         | no       | array of weapons           | What the unit carries (below).                                                                 |

A weapon:

| Field             | Required | Type                       | Meaning                                                       |
| ----------------- | -------- | -------------------------- | ------------------------------------------------------------- |
| `name`            | yes      | string                     | The weapon's name.                                            |
| `count`           | no       | integer, at least 1        | How many the unit carries; one a model when missing.          |
| `range`           | no       | number, inches             | 0 or missing is a melee weapon, unless `kind` says otherwise. |
| `kind`            | no       | `"ranged"` or `"melee"`    | Overrides what `range` implies.                               |
| `characteristics` | no       | object of string or number | Keyed by the game's ids or names: `{ "A": 2, "AP": 1 }`.      |
| `rules`           | no       | array of rules             | The weapon's special rules by name.                           |

A rule is either a string as the player would write it (`"Tough(3)"`), or an object `{ "name": "Tough", "rating": 3,
"text": "…" }`. `text` is the rule's wording when the player's own file carries it; Open Battle shows it on the unit
card and never uploads it.

### How Open Battle reads it

- **Units.** Every model of a unit gets the unit's characteristics. Weapons are handed out one a model in turn, so
  `count: 2` in a unit of six puts one on each of the first two models.
- **Rules.** Each game binds the rules it knows by name (`Tough(3)` becomes three wounds a model in Quality d6). A
  rule it doesn't know stays on the unit card as a reminder, with its text if the file gave one. Nothing is guessed.
- **System.** With `system` naming a game this build or a loaded package knows, the list goes on the shelf for that
  game; otherwise for the default game, where the player can move it. A game may read the list its own way (the
  `readArmyList` hook of a system module) to fill in what it derives.
- **Packages.** `packages` tells the player which rules packages the list expects. Loading one still goes through the
  package's own question and consent ([packages.md](../packages.md)); a list never loads code by itself.

## Versions and compatibility

- The major version is in `format`. A reader opens only the majors it knows; a file of a newer major is turned away
  with a message, never half-read.
- A **minor** revision only adds optional fields. It doesn't change the meaning of a field that exists, and it keeps
  the same `format` line, so v1 readers open v1.x files.
- **Readers ignore fields they don't know**, at every level. Writers may add their own fields (the builder's ids,
  upgrade choices); prefix them with the builder's name to avoid a clash with a later minor revision.
- A change that would make a v1 reader misread a file (a field changing meaning or type, a new required field) is a
  new major, `open-battle/army-list@2`, with its own section here. Readers keep reading v1.
- These promises sit beside [compatibility.md](../compatibility.md): the list format is a file on disk and on the
  wire, so it follows the same rule as the event log: once published, a shape is not changed under its name.

## Opening a list from a link

Builders link to a list with the existing share link, **Open link v1** (see [links.md](links.md) and
[sharing-files.md](../sharing-files.md)):

```
https://<site>/?open=<url-encoded https link to the list file>
```

The link points at the list file where the builder serves it, over https with CORS allowing other sites to read it
(`Access-Control-Allow-Origin: *`). The player's browser fetches it, shows what it is, its size and its SHA-256, and
opens it only when the player says yes. A private list can be shared as an encrypted torrent with its key in the
`#key=` fragment, as any shared file. There is no inline-data form: the list travels as a file.

The link format is versioned with Open link v1, not with this format: an Open link to an `army-list@2` file is the
same link.

## Other shapes

Lists from builders that don't write this format are read through adapters that map their shape into it, each in
the game system's code. For example, Quality d6 (`src/systems/qd6/roster.ts`) reads a unit builder's JSON export
(units with a quality, a defense and their equipment) and a plain-text list, both mapped into Army list v1 before
anything else reads them. A builder that can write Army list v1 needs no adapter.

## Example

Invented throughout:

```json
{
  "format": "open-battle/army-list@1",
  "name": "Mossback Raiders",
  "system": "qd6-1",
  "points": 395,
  "builder": { "name": "Sample Builder", "version": "0.0.1", "url": "https://builder.example/" },
  "packages": [{ "url": "https://rules.example/mossback.js" }],
  "units": [
    {
      "name": "Old Grumm",
      "size": 1,
      "points": 80,
      "characteristics": { "Q": "3+", "D": "4+" },
      "rules": [
        "Hero",
        { "name": "Tough", "rating": 3 },
        { "name": "Glimmerhide", "text": "An invented rule." }
      ],
      "base": { "shape": "round", "diameterMm": 40 },
      "weapons": [{ "name": "Root Maul", "characteristics": { "A": 3, "AP": 1 }, "rules": ["AP(1)"] }]
    },
    {
      "name": "Mossback Slingers",
      "size": 6,
      "points": 90,
      "characteristics": { "Quality": 4, "Defense": 5 },
      "rules": ["Scout"],
      "weapons": [
        {
          "name": "Pebble Sling",
          "count": 6,
          "range": 18,
          "characteristics": { "A": 1 },
          "rules": ["Blast(2)"]
        },
        { "name": "Knife", "kind": "melee", "characteristics": { "A": 1 } }
      ]
    }
  ]
}
```
