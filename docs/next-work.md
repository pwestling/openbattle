# Next work: what the game waits on

Roadmap #84. `nextWork(state, player, { scores })` in
`src/core/content/nextWork.ts` answers, from the engine, the question every
"next step" screen asks: is there something for this player to do now, what
kind of thing, which units still have work, and what ends the phase. ui-next's
step bar (`stepFor`, `src/next/step.ts`) can read it instead of guessing from
phase names, and the soak checks every state against it (no dead ends, below).

Rules stay advisory: the answer is what the game would have a player do next,
never a wall. `ends` is offered even while units have work left.

## The answer

```ts
interface NextWork {
  kind: WorkKind; // see below
  whose: PlayerId[]; // players the game waits on now (for "wait": whose go it is)
  mine: boolean; // the asking player is one of them
  blocking: boolean; // a question, a roll or a held action: nothing goes on until it's done
  intents: Intent[]; // the obvious sends for the work (roll, pass, Done, score), as this player
  left: UnitId[]; // this player's units with work left in this phase (or the one acting)
  done: UnitId[]; // their units that did this phase's work
  ends: Intent | null; // what ends the phase, turn or go for this player; null when not theirs
  order?: WorkOrder; // the system's own order of picks (40k's fight order)
}
```

The kinds, in the order the engine asks for them:

| kind            | when                                                                                      | whose                       | ends                                                               |
| --------------- | ----------------------------------------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------ |
| `over`, `setup` | after the last round; round 0                                                             | nobody; every seated player | null                                                               |
| `question`      | a rule's question (`state.script.waiting`)                                                | its player                  | null                                                               |
| `roll`          | an attack or procedure: its next dice (a save is the defender's), or closing it once done | the roller                  | null                                                               |
| `answer`        | a procedure's own window step (`run.pending`)                                             | the side it names           | null                                                               |
| `reaction`      | an engine window (`state.reaction`, never blocks) or FSD's held action (`state.pending`)  | the reacting side           | null                                                               |
| `score`         | a mission score to confirm (only when the caller passes `scores`)                         | that side                   | null                                                               |
| `ready`         | a simultaneous phase this player hasn't said Done to                                      | players not yet ready       | `turn/ready`                                                       |
| `pick`          | the system's order says this player picks next (40k fight order)                          | the picker                  | `turn/next` for the active side                                    |
| `activation`    | alternating games, this side's go: a unit acting (`left` is it), or units still to go     | the active side             | `turn/endActivation` while acting, else `turn/pass`                |
| `units`         | a phase with this side's units still to act                                               | the active side             | `turn/next`                                                        |
| `end`           | nothing left for this side in the phase                                                   | the active side             | `turn/next` (`turn/pass` in alternating games)                     |
| `wait`          | someone else's go                                                                         | them                        | `turn/next` for the active side while an opponent picks, else null |

`scores` comes from the app (`pendingScores(record, state, mission)` in
`src/missions/scoring.ts`), as core can't read missions; without it scores are
not counted as work.

### Units with work left

Generic, from the phase's own actions: a unit has work left when one of the
phase's unit actions is allowed for it (`unitActions(...).ok`, reactions
aside) and it hasn't done the phase's work. It has done it when it carries a
flag one of the phase's actions `sets`, used a once-only action of the phase
(`used.<action>`), fired a weapon this phase (`fired.*`), or, in a phase with
move actions, any of its models stands somewhere else than at the start of the
phase, or, in a phase with a charge move, it has rolled its charge (made or
failed: `status.charge`). A game that wants its units to count as done after an
action that sets nothing (40k's Shoot) gives that action `sets: [...]`. A unit
with nothing it could do has no work: 40k's Shoot is not allowed when no enemy
is within reach of any of the unit's ranged weapons ("No enemy in range").

In alternating games a unit has work when it hasn't activated this round
(plain activations: any; data activations: one with an action that
`activates` and is allowed now).

### A system's own order

`registerWorkOrder(systemId, (state) => ({ picker, eligible }) | null)` lets a
system say whose pick it is in a phase. 40k registers its fight order
(`wh40k/fight.ts`) from `wh40k/module.ts`. The engine asks the system, so
nothing outside the system imports `fightOrder` to know whose pick it is.

## No dead ends (the soak)

`src/soak/deadEnds.ts` runs at every step of every soak game (`SOAK_DEADENDS=0`
turns it off). On the host's table it computes `stepFor` for each seated
player's screen and one hotseat screen, and `nextWork` for each player:

- **noStep**: no screen has a job with something the engine accepts: a lit
  button whose intent the host would log (checked on a copy, like the bot's
  `legal`), a lit unit, or a roll, answer or reaction `nextWork` says is that
  screen's.
- **cantEnd** / **endHidden**: with no roll, question, window or score open,
  the active side has no legal intent that ends the phase, or its screen
  offers none (lit or behind a confirm both count).
- **unseenWork**: `nextWork` says a player has work while their screen says
  wait. **noWork**: `nextWork` gives nobody any work.

A finding names the system, seed, step, round, phase, screen and its text, so
`SOAK_FROM=<seed> SOAK_SEEDS=1` replays it. Known step.ts dead ends are allowed
by name in `ALLOWED` (counted in the report's `seen` as `dead end allowed: …`);
the UI thread removes an entry when step.ts takes its fix.

## Moving step.ts onto it

- Replace the per-unit regexes (`phaseUnits`, `inReach`, `/move|shoot|charge|fight/`)
  with `left` and `done`.
- Replace `fightOrder` (a 40k import used for every system) with `order` and
  `kind === "pick"`.
- Take the tone from `mine` (`job` when true), so a roll, reaction, held action
  or question reaches the screen whose it is; `intents[0]` is the lit button
  where there is one (a Pass, a Done, a score).
- The Done button's intent is `ends`; a confirm when `left.length > 0`.
- Keep the step bar's own wording (say/sub), which stays the UI's.
