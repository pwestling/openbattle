# Writing a rules package

A game is a rules package: one JavaScript file whose default export is a module. The core knows physical things (units of models, tokens, terrain, cards in ordered collections), hidden values, dice and a pointer. A module supplies the rules: it expands its actions into primitive events, and the host logs those. `examples/packages/ember-skirmish.js` is a small invented game exercising the contract, including a shared card collection, private hands and public plays.

## The file

```js
export const manifest = {
  id: "me.my-game", // the package's name for good: keep it across versions
  name: "My game",
  version: "0.1.0",
  api: 12,
  kind: "system", // a whole game; "extension" adds to the games named in `systems`
  systems: ["my-game"],
  requires: [],
  adds: "One line for the consent screen",
};

export default {
  api: 12,
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

Typed multi-file authoring is supported by `pnpm package:build`; publish its single-file artifact, never the source graph. The [authoring kit](authoring.md) provides deterministic ID/entity helpers, explicit starting quantities, structured callback diagnostics and a runnable continuation/replay scenario tool.

## Composing a game and extensions

Choose a whole game and compatible extension versions on the start page. Required packages are added to the selection; inspect their names, content hashes, `adds` and intentional replacements before trusting each exact hash. Missing dependencies, hash mismatches, cycles and ambiguous installed versions stop setup instead of silently choosing a version. Explicitly choose a version to resolve ambiguity. The record keeps the exact ordered package references; pending execution pins that composition.

Declare dependencies as `requires: [{ id: "author.game", hash: "<64 lowercase SHA-256 digits>" }]`. Omit `hash` to accept a selected version of that package ID; the loader still requires it to be present and compatible. All dependencies load before their consumers. Malformed dependencies are errors, not ignored declarations.

IDs for actions, macros, quantities, phases and setup forms are shared within a game. Prefix new extension IDs with `${manifest.id}:` (for example `example.ember-supplies:grant`). Unprefixed additions produce naming warnings, not automatic renames. Duplicate definitions in a package are errors. Between packages, collisions fail atomically unless explicitly declared:

```js
requires: [{ id: "author.game" }],
overrides: [
  { system: "my-game", kind: "action", id: "advance", from: "author.game" },
  { system: "my-game", kind: "quantity", id: "hp", on: "model", from: "author.game" },
],
```

`from` names the current supplying dependency, not just any previously loaded package. An action replacement includes its paired execution macro; standalone macro replacement must not leave a stale action callback. Quantities are identified by `(on, id)`; phases and macros by ID. Panel replacement uses `{ kind: "panel", id: "panel", ... }`. Setup replacement uses the form ID and is checked when that conditional form is offered. Other static replacement declarations must actually replace a symbol. Two extensions claiming the same original provider do not silently overwrite each other.

`ctx.set` and `view.own` are **package-local**: whole games use their system ID, extensions use their manifest ID. Actions, panels, setup callbacks and macro continuations all use that same namespace. Equal local keys in different packages do not collide. To deliberately write shared module data, emit an explicit `module/set` for its namespace; ordinary entity quantity/tag keys are not rewritten. The reducer folds these primitive writes without consulting packages.

Load [Ember Skirmish](../examples/packages/ember-skirmish.js) with [Ember Supplies](../examples/packages/ember-supplies.js) to try an extension action that grants a command point and maintains its own grant counter.

## What the core gives you

Entities: players, units (each with models), models, tokens, terrain, zones, cards and ordered card collections. Players, units, models and tokens carry two open bags: `q` (named quantities and attributes) and `tags`. Modifiers are kept as records (`mod/add` with an op, a value and an optional `until`) and a quantity's value is worked out from its stored base and the modifiers that hold (`view.q(ref, key)`). `until: view.until("n")` means "while the pointer's `n` field stays as it is now".

Primitive events a module may emit: `layout/set`, `entity/set`, `q/set`, `q/adjust`, `tag/set`, `mod/add`, `mod/remove`, `models/move`, `unit/move`, `unit/add`, `unit/remove`, `unit/members`, `model/add`, `model/remove`, `token/add`, `token/remove`, `terrain/*`, `pointer/set`, `collection/add`, `collection/remove`, `card/add`, `cards/remove`, `cards/move`, `card/set`, `log/note`, `module/set`. Dice, random shuffles, secrets and questions have their own commands.

The pointer is `{ round, seat, phase, ... }` and is yours: the core only stores it. "Next phase" is an action of yours that emits `pointer/set`.

### Participants are not engine-defined teams

Seats are explicitly chosen optional nonnegative identifiers. Joins without a seat stay unseated; there is no two-side allocation or capacity. `player/set` assigns a seat number or clears with null; identity reclamation preserves the recorded seat. Packages decide player counts, alliances, board edges and the meaning of `pointer.seat`. There are no core team/opposition helpers or generic settings bag.

The example deliberately requires distinct seats 0 and 1 for its two-player setup; that policy is in its package. Use the debug hotseat preset or choose seats in network setup/Seating controls before mustering. Other packages may use different identifiers, shared seats, relationships or turn structures.

### Read-only views and valid effects

All package callbacks receive deeply frozen views: state, nested bags/tags, pointer, module state and returned records. Macro context, arguments, yielded command data and command results are also frozen. Copy into local working objects when you need to sort or edit data; use `ctx.emit`/`ctx.set` for persistent effects. Freezing protects the event-sourced replica even when the package is plain JavaScript.

Direct primitives and emitted primitives use the same structural/mechanical validator. Finite numbers, valid JSON, safe keys/IDs, references and physical/membership shapes are required. Invalid emissions log a macro failure; previously emitted valid effects remain. These checks are not game legality: negative quantities or moves beyond a game's allowance still work. The emit allowlist remains narrower than host intents; rolls, shuffles and secrets use their commands.

### Measurements are not game rules

API 4 replaces `view.visible` and `view.sight` with `view.geometry`: explicit
3D segment intersections, 2D footprint intersections, per-model sampled ray
counts, footprint containment/overlap, and physical heights. Every intersection
or sampling request supplies its own plain-data blocker list; an empty list
means nothing blocks. No table sight settings, terrain visibility labels,
alliance filters, cover rules, vision arcs or unit aggregation are applied.

The package selects blockers, chooses a sampling mode (`body`, `height` or
strictly 2D `footprint`), and interprets the result. `fraction` is clear rays
divided by total rays; `anyClear` and `allClear` are derived from those same
counts. They do not describe cover or attack eligibility. Query one model pair
at a time and aggregate in package code. Missing/off-table references and
malformed geometry requests throw errors, not “hidden” results.

The complete boundary, shape selection, sampling pattern, numerical limits
and API-3 migration are in [Engine boundaries and API](engine.md). The SDK's
`GeometryView`/`GeometryBlocker` types define the request shapes. Record physical
geometry through primitive events; never mutate the state while measuring.
Finished replays fold the emitted effects without rules code or sight queries.
The example package treats blocked strike lines as warnings, not a wall.

## Actions and macros

An action is a button the page offers: `{ id, name, by: "unit" | "player", phases?, applies?, available, targets?, run }`. `run` is a macro, a generator that yields commands and gets their results back:

Each action's `run` already registers that macro ID; do not duplicate it in `macros`. Extension action callbacks and macros share their owning package's `view.own`; shared reads are explicit through `view.state.modules[otherNamespace]`.

| Command                                      | Does                                                                                 |
| -------------------------------------------- | ------------------------------------------------------------------------------------ |
| `ctx.roll("2D6", label?)`                    | dice from the host's rng; the result is `{ rolls, total }`                           |
| `ctx.shuffle(collection)`                    | host RNG shuffles a collection; returns and logs the resolved card order             |
| `ctx.ask(player, question, options)`         | pauses until that player answers; the result is the option id                        |
| `ctx.input(player, question, spec)`          | pauses for a structured JSON answer matching the declared input domain               |
| `yield* ctx.warn(player, reason)`            | recorded Proceed anyway/Cancel flow; returns boolean and logs an override on proceed |
| `ctx.emit(event)`                            | one of the primitive events above                                                    |
| `ctx.set(key, value)`                        | this module's own state (`view.own`)                                                 |
| `ctx.secret(player, key, question, options)` | the player's device keeps the choice; only a commitment goes on the table            |
| `ctx.reveal(player, key)`                    | the player reveals it; everyone checks the commitment; the result is the value       |
| `ctx.note(text)`                             | a line in the log                                                                    |

`args.by` is the player who started the macro; `args.unit` and `args.target` are whatever the action's buttons sent. A macro spans one action (an activation, an attack), never a phase: between actions the game's state lives in the pointer, quantities and `ctx.set`.

During a suspended execution, identity reclamation redirects questions, secrets and engine-owned emitted player references/owners/visibility to the current participant. Original arguments and recorded commands stay historical; arbitrary `q` or module JSON is not rewritten. `args.by` therefore remains historical for direct state-dictionary lookups. Keep commands deterministic: replay compares their original values and uses each recorded result's address mapping.

Packages cannot be changed while a macro or recorded reaction is pending. The exact recorded ordered hashes can be loaded again after a restart; unavailable/mismatched code leaves the work owed. Loading prepares the entire composition before registration, so a failing layout/import/metadata step cannot leave partially active macros or replace a previously successful composition.

### Advisory warnings and explicit overrides

`available(view, actor)` returns `true` or an advisory reason. Warning rows still expose their `targets`; selecting a target retains the exact unit, target, arguments and participant. The app shows **Proceed anyway / Cancel** before sending a warned start. Cancel sends no intent. Proceed acknowledges the reason with `macro/start { force: true, warning }`; the host rechecks the action and logs `Player override (<macro>): <reason>`. A changed action reason refuses the stale acknowledgement. Changing the table, session, system or selected actor invalidates the app's pending confirmation.

Panel buttons use `warning?: string`, not the removed `disabled` reason. They share the same confirmation and retain their supplied arguments/player. Regular clients cannot start as another participant; host/hotseat dispatch may name an existing participant. Pending macros and package callback failures are not overridable rule warnings.

Inside a macro, use the generator helper before the proposed effects or dice:

```js
const proposed = { x: 12, y: 3 };
if (needsWarning(ctx.view, proposed)) {
  if (!(yield * ctx.warn(args.by, "The proposed move exceeds the recommended distance"))) return;
}
// Interpret/recheck the proposal against the resumed view, then emit its effects.
```

`ctx.warn` yields the existing recorded choice input. Cancel returns `false`; Proceed anyway logs `Player override: <reason>` and returns `true`. The package must branch on that result: it is not an automatic transaction rollback or a bypass of early returns. Keep the proposed action in generator locals so replay recreates it; answers and reclaimed recipients use the normal input/replay contract.

Use `applies`/`phases` for discovery and offer plausible target candidates even when a rule warns; the engine does not invent omitted targets. Neither `force` nor `ctx.warn` makes malformed references/effects valid or ignores callback failures. The example's blocked strike asks the attacker before rolling instead of silently claiming an override.

### Recorded player input

`ctx.input(player, question, spec)` describes data, not a UI component or a table edit. `ctx.ask(player, question, options)` is its single-choice shorthand. Both yield an `input` command. The app renders controls; the host accepts answers only from the named participant and validates the declared shape/domain before advancing. Invalid answers leave the question pending. Each accepted ordinary answer is retained in `macro/step.answered`, even if the macro ends or subsequently fails; suspended scripts also retain results and the answer's replay head.

| `spec.kind`   | Descriptor fields                                                                                      | Answer                                                          |
| ------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| `choice`      | `options: [{ id, label }]`                                                                             | One offered string ID                                           |
| `multiChoice` | `options`, optional `min`, `max`, `ordered`                                                            | Distinct offered IDs in player-selected order                   |
| `number`      | Optional `min`, `max`, `integer`                                                                       | Finite number; `integer` requires a safe integer                |
| `text`        | Optional `minLength`, `maxLength`, `multiline`                                                         | String; lengths count JavaScript UTF-16 code units              |
| `reference`   | `options: [{ ref: { kind, id }, label }]`, optional `multiple`; with multiple: `min`, `max`, `ordered` | Offered reference object, or distinct ordered reference objects |
| `point`       | None                                                                                                   | `{ x, y }` in inches                                            |
| `pose`        | None                                                                                                   | `{ position: { x, y }, facing }`; inches and radians            |
| `path`        | Optional `minPoints` (default 2), `maxPoints`                                                          | Ordered array of `{ x, y }` points in inches                    |

Reference kinds are `unit`, `model`, `token`, `card` and `terrain`. Options are captured by the yielded command, not reevaluated by the host after suspension. A referenced object can disappear while the question is pending; the answer still identifies the offered candidate. Recheck the resumed `ctx.view` before applying it. Identity reclamation changes the answering participant, not IDs or arbitrary data inside the answer.

Multi-selection defaults to zero through all offered candidates. `ordered: true` enables order controls; answer arrays retain selection order in either mode. Choice and single-reference requests need at least one candidate; bounds must admit a valid answer. Number/text fields and coordinate/path editors accept editable drafts, but blank numeric fields are not zero. Text and spatial answers are public recorded data; secret commitments/reveals retain their separate discrete-choice contract.

```js
const route = yield ctx.input(args.by, "Propose a move", {
  kind: "path",
  minPoints: 2,
  maxPoints: 12,
});
// The table has not moved. Measure and interpret route in package code,
// then emit existing primitives if the player proceeds.
```

Domain bounds describe representable answers, not advisory rule checks. Do not encode a movement limit, resource rule or ownership policy as an unoverrideable input bound. The engine imposes no table bounds, movement legality or implicit spatial mutation.

### Setup forms and player-owned data

Declare `setup(view, player): SetupSpec[]` on a module or extension. Each callback gets a frozen package-local view and the requested participant ID. Forms from matching committed packages are combined in dependency order; duplicate IDs require explicit provider-matching setup overrides. A callback/descriptor failure is shown as a setup error without hiding actions or panels.

```js
setup: (view, player) => [
  {
    id: "my-game.profile",
    title: "Import my player data",
    macro: "import-profile", // register this in macros
    fields: [
      { id: "profile", label: "Profile JSON", input: { kind: "json" } },
      { id: "spacing", label: "Formation spacing", input: { kind: "number" }, initial: 3 },
      { id: "note", label: "Optional note", input: { kind: "text" }, optional: true },
    ],
  },
];
```

`SetupSpec` is `{ id, title, macro, fields, args?, warning? }`. Each field is `{ id, label, hint?, input, optional?, initial? }`. All ordinary [input descriptors](#recorded-player-input) work as fields; `{ kind: "json" }` additionally accepts pasted JSON or an uploaded `.json` file. JSON is parsed as data, never evaluated. The engine has no universal army/profile/scenario schema: the package defines, versions and interprets its own data format.

Fields are required unless optional. Valid defaults prefill the editors; zero, false and null are values, not omissions. Optional fields have an explicit inclusion control. One Submit uses **all current drafts**, validates their declared domains, and starts the registered macro with `{ ...spec.args, form: spec.id, data: values }`. `data`, `form` and host-owned `by` are reserved static argument names. The macro reads `args.data`; it must validate its own file format before emitting effects or storing configuration with `ctx.set`. Raw macro intents are not implicitly bound to a form: the host validates finite JSON/participant mechanics, not a package's roster format.

Editing/uploading stays local and causes no events. Submitted arguments/effects enter the replicated record and are **public data**, not encrypted private information. A file change does not change executable package bytes or require code consent again. Warnings reuse the standard explicit confirmation; Cancel sends no import. Invalid JSON/domain drafts stay editable, and recorded macro failures are shown as the last import error. Late file reads cannot overwrite newer edits or another form/actor.

Drafts reset when actor, session, system or the descriptor changes, not on unrelated table events. Stale sequence metadata disables submission until refreshed; metadata names its actor so another participant's form is not reused. Packages choose when to offer forms and how data becomes existing entities or module state. The reducer never reads a setup descriptor.

The example's package-owned profile format is `v: 1` with `name` (nonempty text), `models` (safe integer 1–100), and finite `hp`/`edge`. Additional JSON fields survive storage but have no automatic meaning. Formation spacing is a separate finite-number field; the complete formation must also fit the finite coordinate representation (not a game/table-bound check). The import macro validates this representation before any effect, stores it by stable seat, and muster explicitly emits the configured name, quantities, model count and spacing. It keeps invented defaults when no profile was imported; changing configuration does not retroactively change existing units. No generic settings or built-in roster schema is introduced.

### Be deterministic

The host runs a macro once per step and, to carry on after an answer, replays it from the start feeding back recorded results. The replay must yield the same commands or the macro is stopped. Read the game through `ctx.view`; use `ctx.roll` for dice and `ctx.shuffle` for card randomization, never `Math.random` or `Date`. After an answer, `ctx.view` is the table when the answer was given, including intervening moves; before it, the start table plus the macro's own emitted events. A replay restores a recorded shuffle without drawing RNG again.

### Cards: mechanics in the engine, rules in the package

`state.cards` maps card IDs to physical data: name, optional face/back sprite cells, owner, explicit visibility, face-up orientation and optional position/facing. `state.cardCollections` maps IDs to `{ id, name, cards: [...] }`. Every card belongs to exactly one collection. Index zero is the top; the engine assigns no deck, hand or discard role.

Supply `cards` and `cardCollections` together in a layout to replace the card table; omit both to preserve it. An empty pair clears it. Create additional empty collections with `collection/add`, then insert a `card/add` into a collection. `cards/remove` removes identities and their memberships; `collection/remove` requires an empty collection.

`cards/move` takes `{ cards: [id, ...], to: collection, index? }`. The request's order is the insertion order. Omitted index appends; an explicit index is measured **after** removing moved cards from the destination, including same-collection moves. Movement never changes ownership, visibility or orientation. Use `card/set` for those fields. Duplicate identities, missing destinations, invalid indexes and dangling memberships are malformed requests, not advisory rule violations.

The package decides which collection is a shared deck or a player's hand, how many cards to draw, when to discard, and what a played card does. For example:

```js
function* drawTwo(ctx, args) {
  const cards = ctx.view.state.cardCollections["draw"].cards.slice(0, 2);
  const hand = `hand-${ctx.view.state.players[args.by].seat}`;
  yield ctx.emit({ type: "cards/move", cards, to: hand });
  for (const card of cards)
    yield ctx.emit({
      type: "card/set",
      card,
      set: { owner: args.by, visibility: [args.by], faceUp: false },
    });
}
```

This macro assumes its action checked that two cards and the destination exist. Shuffle with `yield ctx.shuffle("draw")`, not an emitted `collection/shuffle`: the host resolves Fisher–Yates using its RNG and logs the complete permutation. Peers and replays fold that order without package code.

Give collections stable IDs rather than deriving them from transient peer IDs. The example assigns hands by seat; claiming a player's seat rebinds card owners and visibility lists without changing collection membership.

**Trusted-tabletop visibility, not confidentiality.** `visibility: "all"` permits everyone to see a name/face; `[]` permits nobody; a player-ID list permits only those viewers. Ownership and `faceUp` do not grant visibility. `ctx.view.cards(collection, player)` (default viewer `null`) returns ordered views with unauthorized names/faces omitted, while preserving backs and physical metadata. The app's normal card views and recipient-only question controls use that perspective.

All identities, assets and orders remain in the replicated record and full `ctx.view.state`; the raw debug inspectors expose them. This is neither encrypted hands nor proof of fair hidden draws. Independent `ctx.secret`/`ctx.reveal` commitments still keep player-chosen values on their devices; cards do not use secret-key conventions or inferred discard piles.

### Hooks

`hooks.on["models/move"]` starts a macro after every logged event of that type (including ones a macro emitted), one at a time, once no other macro is waiting. It gets `{ event, seq, by }`, and `from` (the previous pointer) for `pointer/set`. The trigger records each obligation with a distinct reaction ID; a committed starting step consumes it. Pending hooks survive host reconstruction without rerunning consumed work. Undoing a trigger cancels pending obligations and undoes caused runs; undoing a reaction itself cancels its effects without automatically rerunning it. Hooks set off by hooks stop four runs deep. Branching and changing executable composition are refused while work remains owed.

## Where code runs

Only the host resolves `macro/start` and `macro/answer` into effects. Trusted peers may run pure action, panel and setup callbacks in their own sandboxes for local presentation; callbacks return data against frozen views, not React components or unlogged effects. What a macro emits reaches every peer as ordinary events inside one `macro/step` envelope, so completed replay, undo, late joining and desync checks need no package code: a spectator without the package folds to the host's state hash. Undo takes a macro run with it and any caused runs.

## Trying it

`pnpm dev`, then on the debug page choose a mode, **Load a package…** with the file, **Start**. The module's actions appear under "The module's actions"; the primitive intents and the event log are below. Open a second tab in "local" mode to join as a client; a tab that never loaded the package can still **watch**.
