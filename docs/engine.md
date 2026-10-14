# How the engine works

Open Battle's engine is a host-authoritative event log with a pure fold. One peer, the host, turns what players ask for (**intents**) into numbered **events**. Every peer applies the same events in the same order with the same reducer and arrives at the same table. A game's rules live in a sandbox-loaded **package**; the host runs its code to expand a game action into ordinary events, so a peer that never loaded the package still folds to the host's state.

The engine has three parts, and a boundary to the game:

| Part            | Where                                                                                 | Does                                                                                            |
| --------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Fold            | [`reducer.ts`](../src/core/reducer.ts), [`log.ts`](../src/core/log.ts)                | Applies events to state; rebuilds any past table; resolves undo. Never runs or reads a package. |
| Host runtime    | [`actions.ts`](../src/core/actions.ts), [`macro.ts`](../src/core/macro.ts)            | Validates intents, rolls dice, runs package macros, and produces the events to log.             |
| Measurements    | [`los.ts`](../src/core/los.ts), [`geometry.ts`](../src/core/geometry.ts)              | Read-only geometric queries a package calls. Their results are never logged.                    |
| Package (rules) | [`src/sdk`](../src/sdk/index.ts), loaded by [`src/sandbox`](../src/sandbox/engine.ts) | Says what quantities mean, what an action does, when to roll, what to warn about.               |

Current contracts: **module API 12, `open-battle/record@9`, peer protocol 11, manifest schema v3**. Versioning rules are in the [protocol registry](protocols/README.md); the wire format is in [peer-protocol.md](protocols/peer-protocol.md); how to write a package is in the [package guide](packages.md) and [authoring workflow](authoring.md); [the architecture page](architecture.html) draws the runtime components. The TypeScript in [`types.ts`](../src/core/types.ts), [`actions.ts`](../src/core/actions.ts) and [`src/sdk/index.ts`](../src/sdk/index.ts) is the authoritative shape of everything named here.

## Invariants

1. **The log is the game.** State is `initial` plus the fold of every event that has not been undone. Sync, late joining, replays, undo, branches and desync checks all derive from the log.
2. **The fold is pure and knows no game.** `applyEvent(state, event)` depends on nothing else: no package, no registry, no clock, no randomness, no network. It never mutates its input.
3. **The log holds outcomes, not requests to recompute.** Dice results, shuffle orders, player answers and every effect a macro produced are recorded as resolved data. Replaying a finished game needs no package code and rolls nothing.
4. **Only the host resolves.** Randomness and package macros run on the host alone. Everything peers must agree on reaches them as an event.
5. **Structure is enforced; rules are advisory.** A malformed event is rejected. A move that breaks a game's rules is applied, and the package warns instead. A warning is always something the player can override.
6. **Packages read frozen data and change the table only through events.**

## Who owns what

| Area         | Engine                                                                                          | Package                                                                                        |
| ------------ | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Table        | Positions, elevations, facing, bases, body volumes, terrain boxes and meshes, tokens            | What a model or terrain category represents; deployment and movement rules                     |
| Measurements | Distances, bearings, intersections, footprint containment and overlap, sampled obstruction      | Which objects block, vision arcs, visibility, cover, elevation exceptions and unit aggregation |
| Entities     | Identity, containment, the open `q` and `tags` bags, modifier records                           | Quantity names, meanings, starting values and effects                                          |
| Participants | Identities and an optional recorded seat number                                                 | Alliances, player counts, deployment edges and what a seat means for turn order                |
| Progress     | Stores the pointer and logs its changes                                                         | Phases, turn order and the meaning of "next"                                                   |
| Cards        | Identity, ordered collection membership, movement, logged shuffles, presentation visibility     | Deck, hand and discard roles, draw counts and card effects                                     |
| Randomness   | Host RNG and resolved dice and shuffle events                                                   | When to roll, which dice, and what the result means                                            |
| Secrets      | Device-held choices, commitments and verified reveals                                           | The questions, the options and their game effects                                              |
| Actions      | Runs generator macros on the host; logs their primitive effects and the answers they were given | Buttons, targets, advisory warnings and macro logic                                            |
| Recovery     | The fold, undo dependencies, branches, state hashes, recorded obligations                       | The exact code needed to resume a macro that is waiting                                        |

## State

`GameState` is plain JSON. Positions, heights and offsets are in **inches**, with `(0, 0)` at the table centre. Base sizes are in **millimetres**. Facing is in **radians**, zero towards `+y`.

| Field                      | Holds                                                                                                                           |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `seq`                      | Sequence number of the last event folded in.                                                                                    |
| `table`                    | `{ width, depth }` in inches. Default 60 × 44.                                                                                  |
| `players`                  | By id: `name`, `color`, optional `seat`, optional `ready`, `q`, `tags`.                                                         |
| `units`                    | By id: `owner`, `name`, `modelIds`, `q`, `tags`.                                                                                |
| `models`                   | By id: `owner`, `label`, `position`, `facing`, `base`, optional `unitId`, `off`, `z`, `height`, `bands`, `q`, `tags`.           |
| `tokens`                   | By id: `kind`, `position`, optional `owner`, `facing`, `z`, `base`, `height`, `bands`, `label`, `q`, `tags`.                    |
| `terrain`                  | List of pieces: `id`, `name`, `category`, `position`, `width`, `depth`, `facing`, `solids`, optional `hull`, `q`, `tags`.       |
| `zones`                    | List of `{ seat, points }` convex polygons. Their purpose belongs to the game.                                                  |
| `pointer`                  | `{ round, seat, phase, ... }`: where the game is up to. The engine stores it and attaches no meaning. A package may add fields. |
| `mods`                     | Active modifier records, in the order they were added.                                                                          |
| `modules`                  | Package-owned state: namespace → key → JSON value.                                                                              |
| `cards`, `cardCollections` | Card identities and ordered collections.                                                                                        |
| `secrets`                  | Per player and key: a commitment, and the value once revealed.                                                                  |
| `system`, `packages`       | The game being played and the exact ordered package references (id, version, SHA-256 hash, size) the table agreed to run.       |
| `macro`                    | The macro currently waiting on a player, or absent.                                                                             |
| `branch`                   | Where this game branched from another one's history, if it did.                                                                 |

Players, units, models and tokens are **entities**: each carries `q` (named JSON values a game defines) and `tags` (a set of strings). Terrain also has `q` and `tags`, changed through `terrain/update`. `off: true` keeps a model in state but off the table.

## The log

```ts
interface GameRecord {
  format: "open-battle/record@9";
  initial: GameState;
  events: LoggedEvent[];
}
interface LoggedEvent {
  seq: number;
  by: PlayerId;
  at: number;
  event: GameEvent;
  host?: PlayerId;
  reactions?: Reaction[];
}
```

`seq` increases by one per event. `by` is the peer who asked. `at` is the host's clock in milliseconds; it is for replays and spectator delay and is never read by the fold or by a package. `host` is the peer that resolved the event. `reactions` are hook obligations the event created ([execution continuity](#execution-continuity)).

`stateAt(record, uptoSeq)` rebuilds the table as it stood after any event: start from `initial`, apply each event up to `uptoSeq` that has not been undone, and set `state.seq` to each event's seq whether or not it was applied. Replays scrub with this; a record with an unknown `format` is refused, never guessed at.

### From intent to event

A player sends an intent. The host's `resolveLogged` either returns the next `LoggedEvent` or rejects the intent, and a rejection logs nothing. Most intents become an event of the same shape; the host adds what only it can decide:

| The host adds                  | To                                                                                                                          |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| Dice results                   | `dice/roll` (the intent asks for `count` and `sides`; the event carries `results`)                                          |
| The shuffled order             | `collection/shuffle` (a Fisher–Yates permutation from the host RNG)                                                         |
| A modifier id                  | `mod/add` sent directly (`m<seq>`, so every peer names it alike)                                                            |
| The claimant                   | `player/claim` (`by`)                                                                                                       |
| Normalised text                | On `player/set`, names trimmed to 32 characters and colours lower-cased; notes trimmed to 200 characters, dice labels to 60 |
| The dependents that go with it | `undo` (`also`)                                                                                                             |
| A whole `macro/step`           | `macro/start` and `macro/answer`                                                                                            |

### Events

"Player" means the event can be sent as a direct intent. "Macro" means a package may `ctx.emit` it. An event neither column allows is produced only by the command named.

| Event                                                | Player | Macro | Effect of the fold                                                                                                                                        |
| ---------------------------------------------------- | :----: | :---: | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `player/join`                                        |   ✓    |       | Adds or replaces the sender's own player. A rejoin without a seat keeps the recorded seat. Blank names become `Player N`; duplicates get a ` (2)` suffix. |
| `player/claim`                                       |   ✓    |       | Hands an existing identity and everything it owns to the claiming peer id ([participants](#participants-and-explicit-seats)).                             |
| `player/set`                                         |   ✓    |       | Changes the sender's own `name`, `color`, `ready` or `seat`. `seat: null` clears it.                                                                      |
| `player/resync`                                      |   ✓    |       | No change. The host answers by sending the whole record.                                                                                                  |
| `game/system`, `game/packages`                       |   ✓    |       | Records the game id, and the exact ordered package references.                                                                                            |
| `layout/set`                                         |   ✓    |   ✓   | Replaces terrain, zones and tokens together; replaces the table size if given; replaces all cards and collections if both are given.                      |
| `terrain/add`, `terrain/update`, `terrain/remove`    |   ✓    |   ✓   | Add and update both insert or replace a piece by id.                                                                                                      |
| `unit/add`                                           |   ✓    |   ✓   | Adds or replaces a unit with the models supplied. Former members left out of a replacement are detached, not deleted.                                     |
| `unit/remove`                                        |   ✓    |   ✓   | Deletes the unit and its member models.                                                                                                                   |
| `unit/members`                                       |   ✓    |   ✓   | Moves existing models into or out of a unit. Joining takes a model from the unit it was in.                                                               |
| `model/add`, `model/remove`                          |   ✓    |   ✓   | Adds or replaces one model, keeping unit membership reciprocal; removes one.                                                                              |
| `token/add`, `token/remove`                          |   ✓    |   ✓   | Adds or replaces a token; removes one.                                                                                                                    |
| `entity/set`                                         |   ✓    |   ✓   | Sets static fields on one entity; `null` deletes a field.                                                                                                 |
| `models/move`                                        |   ✓    |   ✓   | Sets each listed model's `position`, and `facing` and `z` when given. `via` (corners passed) and `setup` are kept in the event for rules to read.         |
| `unit/move`                                          |   ✓    |   ✓   | Rotates every member by `turn` about `pivot`, then translates by `delta`; adds `turn` to each facing.                                                     |
| `q/set`, `q/adjust`, `tag/set`                       |   ✓    |   ✓   | Sets a `q` value (`null` deletes the key); adds `delta` to it, counting a missing or non-numeric value as zero; adds or removes a tag.                    |
| `mod/add`, `mod/remove`                              |   ✓    |   ✓   | Adds a modifier record, replacing one with the same id; removes by `id` or every one with a given `source`.                                               |
| `pointer/set`                                        |   ✓    |   ✓   | Replaces the pointer, then drops every modifier whose `until` no longer holds.                                                                            |
| `module/set`                                         |        |   ✓   | Sets `modules[module][key]`. `ctx.set` produces it for the package's own namespace.                                                                       |
| `collection/add`, `collection/remove`                |   ✓    |   ✓   | Adds an empty collection; removes an empty one.                                                                                                           |
| `card/add`, `cards/remove`, `cards/move`, `card/set` |   ✓    |   ✓   | See [cards](#cards).                                                                                                                                      |
| `collection/shuffle`                                 |   ✓    |       | Sets the collection's order to the logged permutation. From a macro: `ctx.shuffle`.                                                                       |
| `dice/roll`                                          |   ✓    |       | No change to the table; the log keeps the roll. From a macro: `ctx.roll`.                                                                                 |
| `secret/commit`, `secret/reveal`                     |   ✓    |       | See [secrets](#secrets). From a macro: `ctx.secret` and `ctx.reveal`.                                                                                     |
| `log/note`                                           |   ✓    |   ✓   | No change; a line in the log.                                                                                                                             |
| `macro/step`                                         |        |       | Applies the step's inner events in order, then sets `state.macro`. Produced by `macro/start` and `macro/answer`.                                          |
| `undo`                                               |   ✓    |       | No change by itself; the log leaves the named events out of the fold.                                                                                     |
| `game/branch`                                        |        |       | Records where a branch came from. Written once, when a [branch](#branches) is created.                                                                    |

Direct intents are checked for impersonation, not for permission. A peer may only join, set or commit secrets as itself, may not claim its own identity, and must be a known player to start a macro, touch cards or write a note. Only the player a macro is waiting on may answer it. Beyond that the table is trusted: any player may move any model. The host can dispatch an intent as a named player, which is how one device plays several seats.

### Checksums

`stateHash` is a 53-bit hash of the state in canonical form: keys sorted, `undefined` dropped, `-0` as `0`, and fractional numbers rounded to four decimals. The rounding exists because `Math.sin` and `Math.cos` may differ in the last bit between JavaScript engines, and `unit/move` folds a rotation; it applies to the hash only. Every peer hashes the same checkpoints: every tenth event, and every event that sets the pointer. The host's hash for a checkpoint rides on the next event, and a peer whose hash differs flags a desync. The hash detects accidents; it does not resist tampering.

## Structural primitive validation

Direct intents and macro emissions pass through the same `eventProblem` in [`validate.ts`](../src/core/validate.ts). It checks representation and table mechanics:

- **Data is plain JSON.** Finite numbers only; no cycles, sparse arrays, accessors, symbols or foreign prototypes; no key named `__proto__`, `constructor` or `prototype`.
- **Ids, keys and tags are safe:** 1 to 64 characters from `A-Z a-z 0-9 _ . : -`, and unique where a list must not repeat.
- **References exist.** An event names real units, models, tokens, players, cards and collections; an owner is a known player.
- **Physical fields are well formed.** Positions and facings are finite; base, terrain and solid dimensions are nonnegative; a band has `z1 ≥ z0`; a mesh's length is a multiple of nine; a zone has at least three points; a move leaves every position finite.
- **Protected fields stay protected.** `entity/set` cannot write `id`, `kind`, `seat`, `q`, `tags`, `modelIds` or `unitId`. Those have their own events, so identity, containment and seating never change by a side door.
- **Mechanics hold together.** A `q/adjust` result stays finite. A modifier has a known `op` and a finite `value`. A pointer has an integer `round`, a nonnegative integer `seat` and a `phase` that is a string or `null`. Dice results lie between 1 and `sides`. A reveal matches its commitment. Card events keep every card in exactly one collection.

It does not check game rules. Negative quantities, a move of any length, an unknown phase name and an out-of-turn action are all valid events.

A macro may emit a narrower set than a player may send (the Macro column above). It cannot emit player, package, undo, dice, shuffle or secret events: those are session bookkeeping or have their own commands that the host resolves.

A malformed direct intent is rejected and nothing is logged. A malformed emission stops the macro with a logged error before that event touches the state; valid effects from earlier in the same step stay logged. There is no implicit rollback.

## Quantities and modifiers

A quantity is a key in an entity's `q` bag. A **modifier** is a record that changes how a numeric quantity reads without overwriting it:

```ts
interface Mod {
  id: string;
  target: EntityRef;
  q: string;
  op: "add" | "set" | "min" | "max";
  value: number;
  source?: string;
  until?: { field: string; is: Json };
}
```

`view.q(ref, key, fallback = 0)` works the value out each time it is read:

1. Start from the stored value, or `fallback` when it is missing or not a number.
2. If any `set` modifier holds, the most recently added one replaces the value.
3. Add every `add`.
4. Cap it with every `min` (the value becomes at most each one), then lift it with every `max` (at least each one).

A modifier with `until` holds while `pointer[field]` still equals `is`. When a `pointer/set` makes that false the modifier is removed for good; it does not come back if the pointer returns to the old value. `view.until("phase")` builds an `until` for "while this field stays as it is now". Nothing else expires a modifier: a game removes the rest with `mod/remove`, by id or by `source`.

The log therefore holds what happened ("−1 until the phase ends"), not a derived total that would depend on which rules were loaded.

## Macros

A game's own moves are **macros**: generator functions that yield commands and receive each command's result. The host runs a macro inside intent resolution. Everything the generator produces before it finishes or asks a player something is logged as one `macro/step` event.

```js
function* strike(ctx, args) {
  const { total } = yield ctx.roll("2D6", "strike");
  if (total >= 7)
    yield ctx.emit({ type: "q/adjust", ref: { kind: "unit", id: args.target }, key: "hp", delta: -1 });
}
```

| Command                                      | Result                             | Logged as                                                          |
| -------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------ |
| `ctx.roll(dice, label?)`                     | `{ rolls, total }`                 | `dice/roll`                                                        |
| `ctx.shuffle(collection)`                    | The new card order                 | `collection/shuffle`                                               |
| `ctx.emit(event)`                            | Nothing                            | That event                                                         |
| `ctx.set(key, value)`                        | Nothing                            | `module/set` in the package's own namespace                        |
| `ctx.note(text)`                             | Nothing                            | `log/note`                                                         |
| `ctx.input(player, question, spec)`          | The player's answer                | The answer, in `macro/step.answered`                               |
| `ctx.ask(player, question, options)`         | The chosen option id               | Shorthand for a `choice` input                                     |
| `ctx.secret(player, key, question, options)` | The commitment                     | `secret/commit`                                                    |
| `ctx.reveal(player, key)`                    | The revealed value                 | `secret/reveal`                                                    |
| `yield* ctx.warn(player, reason)`            | `true` to proceed, `false` to stop | A choice input, then a `Player override: <reason>` note on proceed |

`ctx.roll` takes `"2D6"`, `"D3+1"` or a flat `"4"`: at most 100 dice, a positive whole number of sides, and `total` includes the bonus. `ctx.view` is the table as the macro currently sees it, including its own emitted events. `args.by` is always the player who started the macro; the host sets it whatever the intent said.

### Steps, questions and resuming

A step ends when the generator finishes, fails, or yields a question nobody has answered yet (`input`, `secret` or `reveal`). In the last case the step's `script` is the macro's saved state and the fold stores it in `state.macro`. The saved state is data: the macro id and its owning namespace, the arguments, who started it, the seq it started at, every command it has yielded so far with its recorded result, and the question it is waiting on.

To carry on after an answer, the host **replays the generator from the start**, feeding back the recorded results, until it reaches the command with no result. Two rules keep that honest:

- **The replay must yield the same commands.** Each yielded command is compared, as JSON, with the one recorded. A difference stops the macro as nondeterministic. A macro must therefore read the game only through `ctx.view` and take randomness only from `ctx.roll` and `ctx.shuffle`. A replay restores recorded rolls and shuffles; it draws nothing from the RNG.
- **Each answer records `head`**, the seq of the table it was given on. After an answer the macro sees the table as it was at that moment, including whatever happened while it waited. Before the first answer it sees the table it started on plus its own events.

Only one macro runs at a time: `macro/start` is rejected while `state.macro` is set. Other intents are still accepted while a macro waits, so players can move models or adjust quantities during a question. A macro spans one action, not a phase; between actions a game's state lives in the pointer, in quantities and in module state.

A waiting macro is released by its player answering, by another peer claiming that player's identity and answering, or by undoing the run.

### How a step can fail

A step with `error` ends the run (`script: null`). Causes: the package threw; it emitted a malformed or disallowed event; it asked a malformed question or addressed one to an unknown player; it yielded more than 5,000 commands; its replay diverged; or the code that owns the macro is not the code that started it. The error text is logged. Events emitted before the failure in that step remain part of the step, and earlier steps stand. Undoing the run takes all of it back.

### Recorded input

An input is a description of data, not a UI component and not a table edit. `spec.kind` is one of `choice`, `multiChoice`, `number`, `text`, `reference`, `point`, `pose` or `path`; the fields and answer shapes are in the [package guide](packages.md#recorded-player-input). The host accepts an answer only from the named player and only if it fits the declared shape and domain. It never checks game legality. A wrong answer is rejected and the question stays open.

The candidates of a `choice` or `reference` are part of the recorded command, not a live query, so an answer can name something that has since left the table; the package rechecks against `ctx.view`. Spatial answers are proposals in inches and radians. No input moves anything: the package interprets the answer and emits events. Answers are public data in the log; use a secret for anything hidden.

Every accepted input answer is kept in `macro/step.answered` as `{ player, command, value, head }`, including on a step that ends or fails.

### Advisory warnings

A warning is a reason shown to the player with **Proceed anyway** and **Cancel**. There are two places one can arise.

- **Before a macro starts.** A code action's `available(view, actor)` returns `true` or a reason; the engine also warns `Not in this phase`, `Not your unit` or `Not for this unit` from the action's `phases`, `by` and `applies`. A `macro/start` for a warned action is rejected unless it carries `force: true`. A forced start may name the `warning` it acknowledges; the host recomputes the reason and rejects the start if it has changed. An accepted forced start logs `Player override (<macro>): <reason>` as the first event of the step.
- **Inside a macro.** `yield* ctx.warn(player, reason)` asks a recorded choice and returns a boolean. On proceed it logs `Player override: <reason>`. On cancel the package must return before emitting the proposed effects or rolling.

`force` and `ctx.warn` override rules, never structure: a malformed effect is still rejected, and a callback that throws is an error, not a warning.

## Execution continuity

A package may register **hooks**: macros that run after a logged event of a given type, including events a macro emitted. A hook receives `{ event, seq, by }`, and `from` (the pointer before) for `pointer/set`.

Hooks are owed work, and owed work is in the log. When the host logs an event, it records one **reaction** per hook it sets off in that event's `reactions`: an id (`<seq>:<ordinal>`), the system, the macro, its arguments, the player, the causing seq and a depth. Two inner events of the same type create two distinct obligations. `pendingReactions(record)` rebuilds the outstanding list from the log alone, in log order, without consulting whatever hooks are registered now.

- **Draining.** Whenever no macro is running, the host starts the oldest pending reaction as a `macro/start` carrying its `reaction` id. The host checks that the id, macro, arguments, player and cause match the record.
- **Consumption.** The step that starts the run carries the reaction id and consumes the obligation, even if that step logged a failure.
- **Cancellation.** Undoing the triggering event cancels its unconsumed reactions and takes any runs it caused with it. Undoing a reaction's own run cancels its effects and does not run it again.
- **Depth.** A reaction set off by a reaction run is one deeper. The host records no reactions for events at depth four, so a chain ends there without an error.
- **Recovery.** A new or reconstructed host drains what is still owed once it has the matching code. A reaction whose code is not loaded stays owed.

While a macro is waiting or a reaction is owed, the **executable composition is pinned**: a `game/system` or `game/packages` that differs from the recorded one is rejected, and the sandbox refuses to load a different set of hashes. Reloading the exact recorded hashes is allowed, which is how a game resumes after a restart. A macro's saved state names its owning namespace, and code registered under a different owner cannot continue it.

## Structural undo and membership

`undo { seq }` takes one event out of the fold. It is selective: the event may be anywhere in history, and every later event is refolded on a table where it never happened.

The host expands each undo to the events that could not have happened without it, and records them in `also`. The closure follows engine-owned prerequisites: the event that created or replaced an entity, the owner and visibility references an event relied on, unit and collection membership, card order and insertion positions, modifiers, secret commitments, identity claims, the package composition, and macro causality (each step needs the run's previous step and the event that caused it). A macro's inner events share their step's dependencies. Independent events survive; entities in the record's `initial` state have no creating event to undo.

The engine does not infer dependencies hidden in a game's own data. It does not know that one `q/adjust` was the consequence of an earlier move unless a macro run or a hook connects them. A package that needs such a link makes it part of one macro run or hangs it on a hook.

An event can be undone once. Undo events cannot themselves be undone, so there is no redo, and a `game/branch` cannot be undone.

Model containment is reciprocal: a model's `unitId` and its unit's `modelIds` always agree. Adding a model with a `unitId` adds it to that unit. Replacing or transferring a model removes its old membership. Replacing a unit detaches former members left out of the replacement. Removing a unit deletes only its actual members.

## Branches

A branch is a new record that starts from any point of another one's history, for "what if" play. Its `initial` state is the parent's table at that seq, without secrets (they live on their owners' devices and are committed again). Its first event is `game/branch`, naming the SHA-256 of the parent record and the seq it left from. A branch is refused at a point where a macro was waiting or a reaction was owed, because half-run work cannot resume without the parent's log.

## Dice, secrets and cards

### Dice

Every random number comes from the RNG the host passes in. A direct `dice/roll` asks for 1 to 100 dice with at least two sides, optionally with named `faces`; the event carries `{ by, sides, results, label?, faces? }`. A package's macros run in the sandbox with a seed the host draws from the same RNG. Replays read results from the log. This gives deterministic replay; it does not protect against a dishonest host.

### Secrets

A secret is a value that stays on its owner's device until they reveal it. The log holds only a **commitment**: the hex SHA-256 of `salt + ":" + stableJson(value)`, where `stableJson` sorts object keys. `secret/commit` records commitments, and the first commitment for a key stands. `secret/reveal` carries the value and salt; every peer's reducer checks them against the commitment, and a reveal that does not match changes nothing. Nobody, the host included, learns a secret early, and its owner cannot change it afterwards. A commitment proves the revealed value is the one committed; it says nothing about how the value was chosen.

### Cards

A card is `{ id, name, face?, back?, owner?, visibility, faceUp, position?, facing? }`. A collection is `{ id, name, cards }`, an ordered list with index zero on top. Every card belongs to exactly one collection, and every card event is checked against that. The engine assigns no deck, hand or discard role.

- `card/add` inserts a new card at `index`, or at the end. `cards/remove` deletes cards and their memberships.
- `cards/move { cards, to, index? }` moves cards in the order given. `index` counts positions after the moved cards have been taken out, including within one collection. Moving never changes owner, visibility or orientation; `card/set` does.
- `collection/shuffle` logs the complete resulting order, so peers and replays never draw randomness.

`visibility` is `"all"` or a list of player ids. `view.cards(collection, player)` returns the collection in order with `name` and `face` left out for a viewer who is not allowed to see them; the back, owner, orientation and position are always present. This is **trusted-tabletop presentation, not confidentiality**: every card's identity and order is in the replicated record. Use a secret when a value must be hidden from the other devices. Usage is in the [package guide](packages.md#cards-mechanics-in-the-engine-rules-in-the-package).

## Participants and explicit seats

A player is an identity keyed by peer id. A **seat** is an optional nonnegative integer recorded on the player, and nothing more: not an alliance, a board edge or a turn. There is no capacity, no automatic allocation and no assumption of two sides; players may share a seat or have none. The package decides how many players it needs, how they relate, and how `pointer.seat` and `zone.seat` are read.

- `player/join` records the seat supplied, or leaves the player unseated. Rejoining without a seat keeps the recorded one.
- `player/set` with `{ seat: n }` assigns, `{ seat: null }` clears, and no `seat` leaves it alone. A player edits their own identity; the host may dispatch as a named player.
- `seat` cannot be written through `entity/set`. Relationships a game invents belong in `q` or module state.

`player/claim` moves an existing identity to the claiming peer id, which is how a player returns on a new connection or device. The fold rewrites the engine-owned references: the player record and its seat, the owner of units, models, tokens and cards, card visibility lists, modifiers targeting the player, the player's secret commitments, the `by` of pending reactions, and the running macro's starter and waiting player.

A running macro also records the mapping from old ids to new. Its original arguments and recorded commands stay as they were, so replay is still exact, while questions, secrets, reveals and the player references in emitted events (entity refs, owners, card visibility) follow the mapping. Each recorded result keeps the mapping in force when it was made, so a later claim does not rewrite earlier replay.

A claim does not rewrite a game's own JSON: `q` values, tags, module state, pointer fields and input answers keep the old id. `args.by` inside a running macro is the original id. A package that stores player ids in its own data should key by seat instead.

## Geometry

Queries are deterministic, read-only computations over the recorded shapes. They are not events. A package measures, decides, and logs the effects it derives. A geometry query rejects a malformed request with an error; it never invents a measurement, and a package should not catch such an error and treat it as "not visible".

### Recorded shapes

A **footprint** is a 2D shape on the table plane; a **body** is a 3D volume. They are separate: a body query can pass over a footprint, and a footprint query ignores all height.

- **Models.** The footprint is the `base`, rotated by `facing`: round, oval or rectangular. The body is `bands` when present: cylinders of radius `r` from `z0` to `z1` above the base. Without bands the base is extruded to the body height: a rotated prism for a rectangular base, a circular or elliptic cylinder otherwise. Body height is `height`, otherwise the top of the highest band, otherwise the larger base dimension in inches. `z` raises the whole model above the table. A model with `off: true` has no table geometry and any query naming it is an error.
- **Tokens.** As models, with everything optional. No `base` means a point footprint. No `base` and no `bands` means a point body of height zero. Bands can give a body without a base.
- **Terrain.** The footprint is a `width × depth` rectangle rotated by `facing`. `solids` are boxes in the piece's local space: `x`, `y` the centre, `z` the bottom, `w`, `d`, `h` the size. `hull` is an optional triangle surface in local inches, nine numbers per triangle. A solid's `kind` (`wall`, `floor`, `block`, `foliage`) and the piece's `category`, `q` and `tags` are descriptive; geometry does not read them.

### Queries

`ctx.view.geometry` takes typed references `{ kind: "model" | "terrain" | "token", id }`.

| Method                                  | Result                                                                                          |
| --------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `segment(a, b, blockers)`               | 3D first contact per blocker: `{ object, t, point }[]`                                          |
| `segment2D(a, b, blockers)`             | 2D footprint first contact per blocker: `{ object, t, point }[]`                                |
| `sample(observerId, targetId, options)` | One model-to-model measurement: `{ clear, total, fraction, anyClear, allClear, blockers }`      |
| `contains(object, point)`               | Whether the footprint contains the point, boundary included                                     |
| `overlaps(a, b)`                        | Whether two footprints overlap or touch                                                         |
| `height(object)`                        | Body height of a model or token (not counting `z`); highest solid top or mesh vertex of terrain |

Two convenience helpers take plain ids of units, models or tokens and ignore off-table models:

- `view.distance(a, b)` is the smallest base-to-base distance in inches between any member of `a` and any member of `b`, rounded to four decimals. It ignores elevation, and is `Infinity` when either side has nothing on the table.
- `view.angle(of, other)` is the bearing in degrees from the centroid of `of` to the centroid of `other`, relative to the facing of `of`'s first member: zero dead ahead, positive to the right, within −180 to 180, rounded to two decimals. It is 0 when either side has nothing on the table.

Neither applies a sight rule.

### Blockers

Every intersection and sampling query takes an explicit list of blockers as plain data. **An empty list means nothing obstructs.** The engine adds nothing: not friendly or enemy models, not the observer or target, not tagged terrain.

| Blocker                                                       | Query | Shape                                                            |
| ------------------------------------------------------------- | ----- | ---------------------------------------------------------------- |
| `{ kind: "model" \| "token", id, shape: "body" }`             | 3D    | The recorded body                                                |
| `{ kind: "model" \| "token", id, shape: "footprint" }`        | 2D    | The recorded base, or a point                                    |
| `{ kind: "terrain", id, shape: "solids", solids?: [i, ...] }` | 3D    | The boxes at those indexes; all of them when `solids` is omitted |
| `{ kind: "terrain", id, shape: "hull" }`                      | 3D    | The triangle surface; the piece must have one                    |
| `{ kind: "terrain", id, shape: "prism", bottom, top }`        | 3D    | The whole footprint extruded between two world heights           |
| `{ kind: "terrain", id, shape: "footprint" }`                 | 2D    | The whole footprint, ignoring height                             |

Solids and hull are separate selections; list both to test both. Each object yields at most one hit, its nearest. Hits sort by `t`, then kind, then id in code-unit order. `t` runs from 0 at `a` to 1 at `b`, and `point` is in world coordinates. Touching counts, endpoints are included, and a segment that starts inside a volume hits at `t = 0`.

```js
const blockers = view.state.terrain
  .filter((piece) => piece.tags?.includes("sight-blocker")) // the package's rule
  .map((piece) => ({ kind: "terrain", id: piece.id, shape: "solids" }));
const hits = view.geometry.segment({ x: 0, y: 0, z: 2 }, { x: 10, y: 0, z: 1 }, blockers);
```

Errors: a reference that is malformed, unknown or off the table; a non-finite coordinate; a 2D shape in a 3D query or the reverse; a missing mesh; a solid index out of range; prism bounds that are non-finite or inverted.

### Sampling

`sample` casts a fixed pattern of rays from one model to another and counts how many reach it unobstructed.

```js
const measured = view.geometry.sample(observerId, targetId, {
  mode: "body", // or "height", or the strictly 2D "footprint"
  blockers,
  // eyes: [{ x, y, z }, ...], // optional world points replacing the observer pattern
});
const visibleInThisGame = measured.anyClear; // the package's policy
```

`fraction` is clear rays over total rays. It is not visible surface area, cover or permission to attack. `anyClear` is `clear > 0`; `allClear` is `clear === total`. `blockers` lists each object that stopped at least one ray, including one behind another obstruction, sorted by kind and id. `sample` takes model ids only, one pair at a time; aggregating over a unit is the package's work.

| Mode        | Observer points                                                                                   | Target points                                                                                                                                                                                                                                                             |
| ----------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `body`      | Centre plus four world-cardinal offsets at 70% of the larger base semiaxis, at 90% of body height | Without bands, 19: the centre at 15%, 50% and 90% of height, plus eight-point elliptic rings at 25% and 75% of height and 85% of the base semiaxes, rotated by facing. With bands, 17 per band: the centre plus two eight-point circular rings at 85% of the band radius. |
| `height`    | The centre at the top of the body                                                                 | Three: the centre at the top, the midpoint, and `min(0.05, height)` above the base                                                                                                                                                                                        |
| `footprint` | The base centre                                                                                   | Nine: the centre plus eight rim points at 95% of the base semiaxes, rotated by facing (corners and edge midpoints for a rectangle). No elevation.                                                                                                                         |

Every observer point pairs with every target point, so `body` without bands is 95 rays, `height` is 3 and `footprint` is 9. A nonempty `eyes` array replaces the observer points in `body` and `height` modes, at absolute world heights; `footprint` rejects it. The pattern is deterministic and part of the module API.

### Numerical contract

- Segment, slab and length comparisons use a tolerance of `1e-9`; the triangle determinant uses `1e-12`.
- Segment intersections with round and elliptic shapes are analytic. Distance and overlap between two round bases are exact. Any distance or overlap involving an oval or rectangular base treats curves as 48-sided polygons.
- A mesh query finds surface contacts. A ray lying in a triangle's plane is ignored, and a ray wholly inside a closed mesh hits nothing. Use solids, a prism or a body where being inside should count.
- Sampling approximates with a fixed pattern; it is not pixel visibility.
- Geometry runs on whichever peer asks. Only the host's results turn into events, so a last-bit difference between JavaScript engines cannot split the table.

## Runtime package boundary

A package is one JavaScript file with a literal `manifest` and a default-exported module. Its identity is the SHA-256 of its exact bytes. The manifest is parsed as data, without running the file.

**Isolation.** Package code runs in a worker inside a sandboxed iframe with an opaque origin and a content security policy that allows no network. It cannot reach the page, storage or cookies. The app talks to it by messages and each call has a watchdog: 250 ms for resolving an intent or computing presentation, 5 s for start-up and loading. A sandbox that misses a deadline is restarted once, then stopped.

**Read-only data.** Everything a callback receives is deeply frozen: the state and everything nested in it, the pointer, module state, query results, arguments, the macro context, each yielded command and each result passed back. A write throws in strict-mode code. A package cannot keep an emitted object or a result array and alter it later. Folded state is frozen in place and shared, not copied, so the boundary costs nothing per callback. Persistent change goes through `ctx.emit` and `ctx.set`.

**What a module registers**, and where it runs:

| Registration             | Shape                                                                       | Runs on                           |
| ------------------------ | --------------------------------------------------------------------------- | --------------------------------- |
| `actions`                | `{ id, name, by, phases?, applies?, label?, available, targets?, run }`     | Callbacks: any peer. `run`: host  |
| `macros`, `hooks.on`     | Generators by id, or by the event type that starts them                     | Host                              |
| `panel(view)`            | A side panel described as data: title, lines, buttons that start macros     | Any peer                          |
| `setup(view, player)`    | Forms that collect a player's data and start a macro with it                | Any peer                          |
| `quantities`, `pointer`  | Descriptions of the game's quantities and phases, for display and authoring | Not executed                      |
| `table`, `layout(table)` | The starting table size and layout                                          | At load; the host logs the result |

Presentation callbacks are pure functions of a frozen view. They return data; a package cannot ship UI components. The reducer never reads any registration: a quantity's `initial` value, for example, reaches the table only as data in an entity-creating event.

**Setup forms** use the same input descriptors as macros, plus a `json` field for pasted or uploaded data. Drafts are local. Submitting starts the form's macro with `{ ...args, form, data }`, and that macro owns validating and interpreting the data. The engine has no roster or army schema. Submitted data is public in the log. Details are in the [package guide](packages.md#setup-forms-and-player-owned-data).

**Composition.** A game is one system package plus any extensions. Dependencies load before the packages that require them, and a dependency may be pinned to an exact hash. Within a game, action, macro, quantity, phase, panel and setup-form ids are shared symbols: two packages supplying the same symbol is an error unless the later one declares an override naming the package it replaces. Each package's `ctx.set` and `view.own` live in its own namespace: the system id for a game, the manifest id for an extension. A load prepares the whole composition before committing any of it, so a failure leaves the previous composition in place. Rules are in the [package guide](packages.md#composing-a-game-and-extensions).

**Failures.** A callback that throws is reported with the package, hash, callback and source position. A failing panel or form is replaced by a visible diagnostic, a failing action is shown with its error, and a failing macro logs its error. A failure is never an overridable warning, and it never causes a substitute state or a rollback.

## The session around the engine

The engine assumes a session that delivers events in order and has exactly one host. The [peer protocol](protocols/peer-protocol.md) specifies the messages; these are the guarantees the engine relies on.

- **Roles.** A peer is host, client or spectator. Clients send intents to the host; the host logs and broadcasts events; a peer applies an event only when its seq is the next one, and asks to catch up on a gap.
- **Joining.** A peer that says how far its log goes receives the events after that point, or the whole record. A package's bytes travel separately, are checked against their hash, and run only on a device whose user has agreed to that hash.
- **Resolution is serial.** While the sandbox is resolving one macro intent, later intents queue and are applied in arrival order afterwards.
- **Authority is scoped.** If a peer leaves, stops being host or has its sandbox replaced while a resolution is in flight, the late result is discarded: it appends nothing and discharges no reaction.
- **Changing host.** When the host goes, peers wait a grace period and then the ready client with the longest log takes over, breaking ties in favour of a resumed host and then the lower peer id. The new host applies its queued intents and drains owed reactions.
- **Desyncs are reported, not repaired.** A checksum mismatch is flagged to the user. `player/resync` makes the host send the full record, which replaces the peer's log.

## Limits

| Limit                                     | Value                                                         |
| ----------------------------------------- | ------------------------------------------------------------- |
| Dice in one roll                          | 100                                                           |
| Dice label, log note, changed player name | 60, 200 and 32 characters when sent directly                  |
| Models in one `models/move`               | 500                                                           |
| Id, key or tag                            | 1 to 64 characters                                            |
| Commands yielded by one macro run         | 5,000                                                         |
| Macros running at once                    | 1                                                             |
| Hook chain depth                          | 4                                                             |
| Wait for a departed host                  | 4 s by default                                                |
| Sandbox watchdog                          | 250 ms per call; 5 s for start-up and loading                 |
| Package size over the peer link           | 4 MiB                                                         |
| Card picture                              | HTTP(S) URL up to 2,000 characters; sheet up to 10 × 10 cells |
| Checksum checkpoints                      | Every 10 events and every pointer change                      |
| Checksum rounding                         | 4 decimal places                                              |
| Diagnostics kept per list                 | 100                                                           |

## What the engine does not promise

- **Fair dice.** The host rolls. The log makes every result visible and replayable, not verifiable.
- **Hidden information beyond secrets.** Card faces, submitted setup data and input answers are in every peer's record.
- **Permissions.** Any player can send any structurally valid primitive. Ownership is recorded for games and the UI to use, not enforced.
- **Game legality.** Nothing in the engine knows what a legal move is.
- **Semantic undo.** Undo follows the engine's own structure and macro causality, not a game's reasoning.
