# Rules coverage: Quality d6 (`qd6-1`)

- **Source:** the game as the app writes it (#82): generic mechanics in our own words, a quality-based d6 game with
  one order a unit and alternating activations. No published rules text, names, stats or points; the sample armies
  are invented, and players bring their own lists.
- **Audited:** 2026-10-11 (issue #82).
- **Code:** `system` = `src/systems/qd6/system.ts`; `melee`, `morale`, `initiative`, `roster`, `mission` and `bot` are
  the files of those names in `src/systems/qd6/`. Core engine pieces are named by file under `src/core/`.
- **Tests:** **Q** = `src/systems/qd6/qd6.test.ts` (describes "Quality d6: …"), **R** =
  `src/systems/qd6/roster.test.ts`, **S** = `src/soak/qd6.soak.test.ts` (20 seeded bot games to the end).
- Rule names and our own short paraphrase only.

Status key: **automated** (the app does it), **advisory check** (the app warns, the player decides), **manual
reminder** (the app shows it at the right time, the player resolves it), **missing** (nothing).

## Rolls

| Rule                                                      | Status    | Where (file:symbol)                                  | Test (file > test name)                                                                   | Notes                                         |
| --------------------------------------------------------- | --------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------- |
| Quality and Defense are d6 targets ("4+")                 | automated | system:`characteristics` Q, D                        | Q > hits on Quality, saves on Defense; a natural 6 always passes, a 1 always fails        |                                               |
| Hits on the attacker's Quality                            | automated | system:`hitTarget`                                   | Q > hits on Quality, saves on Defense; a natural 6 always passes, a 1 always fails        |                                               |
| The defender rolls Defense for each hit, less AP          | automated | system:`defense`, `coreEffects.AP`                   | Q > AP(X) takes X off the Defense roll                                                    |                                               |
| A natural 6 always succeeds, a natural 1 always fails     | automated | system:`hit`, `defense` (`alwaysPass`, `alwaysFail`) | Q > hits on Quality, saves on Defense; a natural 6 always passes, a 1 always fails        | Morale too (morale:`moraleTest`)              |
| Wounds go on a wounded model first; odd models go last    | automated | system:`allocate`                                    | Q > the side that caused fewer wounds tests morale; at half strength a failure routs      | Sniper: the shooter picks (see Weapon rules)  |
| Cover: most of the target in cover terrain, +1 to Defense | automated | system:`coreEffects.Cover` (core `coverShare`)       | Q > cover: +1 to Defense when most of the target is in cover terrain, not against Lock-On | True line of sight from the engine's geometry |

## Orders and the round

| Rule                                                       | Status          | Where (file:symbol)                                                         | Test (file > test name)                                                                   | Notes                                                    |
| ---------------------------------------------------------- | --------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Players take turns activating one unit                     | automated       | system:`turn.round[0]` (alternate, pool units)                              | Q > offers the four orders to the side whose go it is, one unit at a time                 |                                                          |
| One order a unit a round                                   | automated       | system:`orders` (`activates`, `notActivated`)                               | Q > offers the four orders to the side whose go it is, one unit at a time                 |                                                          |
| Hold: stay and shoot                                       | automated       | system:`orders.hold`                                                        | Q > Rush and Charge go twice the Move; only Hold and Advance shoot                        |                                                          |
| Advance: move the Move, then shoot                         | automated       | system:`orders.advance`                                                     | Q > offers the four orders to the side whose go it is, one unit at a time                 |                                                          |
| Rush: move twice the Move, no shooting                     | automated       | system:`orders.rush`                                                        | Q > Rush and Charge go twice the Move; only Hold and Advance shoot                        |                                                          |
| Charge: twice the Move into contact, then fight            | automated       | system:`orders.charge`; melee:`fight`                                       | Q > only a unit that charged into contact fights                                          | Moving into contact is by hand                           |
| A charge needs an enemy within reach                       | automated       | system:`orders.charge` (`enemyGap`)                                         | Q > Rush and Charge go twice the Move; only Hold and Advance shoot                        | A greyed option with its reason; the player may override |
| The round ends once every unit has gone                    | automated       | system:`untilAllActivated`; core turn.ts:`endActivation`, `roundEndsItself` | Q > the round ends once every unit has gone; the go passes only to a side with units left |                                                          |
| A side with units left keeps going when the other has none | automated       | core turn.ts:`endActivation`                                                | Q > the round ends once every unit has gone; the go passes only to a side with units left |                                                          |
| Round 1: roll off for who goes first                       | automated       | system:`turn.initiative: "rollOff"`                                         | Q > offers the four orders to the side whose go it is, one unit at a time                 |                                                          |
| Later rounds: the side that finished first goes first      | automated       | initiative:`activationEnd`, `roundStart`                                    | Q > the side that ran out of units first goes first next round                            |                                                          |
| Four rounds                                                | automated       | system:`turn.rounds`                                                        | S > qd6-1 seed 1                                                                          |                                                          |
| Setting up: take turns placing units in your zone          | manual reminder | system:`deploymentHint`                                                     | S > qd6-1 seed 1                                                                          | Free placement, as in the other games                    |
| Coherency: each model within 1" of another of its unit     | advisory check  | system:`checks.coherency`                                                   | Q > warns, without stopping anything, when models stray from their unit or move too far   |                                                          |
| Move no further than the order allows                      | advisory check  | system:`checks.moveDistance`                                                | Q > warns, without stopping anything, when models stray from their unit or move too far   |                                                          |

## Shooting

| Rule                                           | Status    | Where (file:symbol)                             | Test (file > test name)                                                            | Notes |
| ---------------------------------------------- | --------- | ----------------------------------------------- | ---------------------------------------------------------------------------------- | ----- |
| Shoot after Hold or Advance                    | automated | system:`orders.shoot` (`notWhen`)               | Q > Rush and Charge go twice the Move; only Hold and Advance shoot                 |       |
| Each weapon once a round, at a target in range | automated | system:`orders.shoot` (`limit`, target notWhen) | Q > a weapon shoots only in range                                                  |       |
| The target must be in sight                    | automated | system:`orders.shoot` (`visible`)               | Q > Indirect: -1 to hit after moving, and may shoot what it can't see              |       |
| No shooting while in melee                     | automated | system:`orders.shoot` (`engaged`)               | Q > a unit in melee can't shoot                                                    |       |
| Only models in range shoot                     | automated | system:`attack.attacks` (`inReach`)             | Q > hits on Quality, saves on Defense; a natural 6 always passes, a 1 always fails |       |

## Melee

| Rule                                                                        | Status    | Where (file:symbol)                      | Test (file > test name)                                                              | Notes                |
| --------------------------------------------------------------------------- | --------- | ---------------------------------------- | ------------------------------------------------------------------------------------ | -------------------- |
| Every model of the charging unit strikes with its melee weapons             | automated | melee:`strike`                           | Q > Furious: charging, each natural 6 to hit in melee scores one more hit            |                      |
| The defender strikes back                                                   | automated | melee:`fight` (`const.strikeBack`)       | Q > the defender strikes back, both end Fatigued, and a tie tests no one             |                      |
| Strike-back can be turned off                                               | automated | system:`QD6_CONSTANTS.strikeBack`        | Q > strike-back and fatigue are the game's constants: 0 turns either off             | A package may set it |
| After its first melee in a round a unit is Fatigued: only unmodified 6s hit | automated | melee:`fight`; system:`fatiguedOrShaken` | Q > fatigued or Shaken, a unit hits only on unmodified 6s in melee                   |                      |
| Fatigue can be turned off                                                   | automated | system:`QD6_CONSTANTS.fatigue`           | Q > strike-back and fatigue are the game's constants: 0 turns either off             | A package may set it |
| The side that caused fewer wounds tests morale; a tie, neither              | automated | melee:`fight`                            | Q > the side that caused fewer wounds tests morale; at half strength a failure routs |                      |

## Morale

| Rule                                                        | Status    | Where (file:symbol)                        | Test (file > test name)                                                              | Notes                                    |
| ----------------------------------------------------------- | --------- | ------------------------------------------ | ------------------------------------------------------------------------------------ | ---------------------------------------- |
| A morale test is a Quality roll                             | automated | morale:`moraleTest`                        | Q > a pass keeps the unit steady; Fearless passes a failed test on a further 4+      |                                          |
| Shot down to half strength or below: test                   | automated | morale:`afterAttack`; system:`afterShot`   | Q > a unit shot to half strength tests on its Quality, and is Shaken if it fails     | Only when the attack cost it wounds      |
| Failing leaves the unit Shaken                              | automated | morale:`failed`                            | Q > a unit shot to half strength tests on its Quality, and is Shaken if it fails     |                                          |
| Losing a melee at half strength and failing: the unit routs | automated | morale:`failed` (`fight`)                  | Q > the side that caused fewer wounds tests morale; at half strength a failure routs |                                          |
| Shaken: its next go is a Rally, which clears it             | automated | system:`orders` (`shaken`), `orders.rally` | Q > a unit shot to half strength tests on its Quality, and is Shaken if it fails     |                                          |
| Shaken: hits only on 6s in melee                            | automated | system:`fatiguedOrShaken`                  | Q > fatigued or Shaken, a unit hits only on unmodified 6s in melee                   |                                          |
| Shaken: a further test fails at once                        | automated | morale:`moraleTest`                        | Q > the side that caused fewer wounds tests morale; at half strength a failure routs |                                          |
| Shaken: holds no objectives                                 | automated | mission:`holdFast` (`holders` weight 0)    | Q > Shaken units hold no objectives                                                  | The sample mission; scoring is suggested |

## Weapon rules

| Rule                                                       | Status          | Where (file:symbol)                                                 | Test (file > test name)                                                   | Notes                         |
| ---------------------------------------------------------- | --------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------- | ----------------------------- |
| AP(X): Defense rolls X lower                               | automated       | system:`weaponRules.ap`, `coreEffects.AP`                           | Q > AP(X) takes X off the Defense roll                                    |                               |
| Blast(X): each hit becomes X, up to the target's models    | automated       | system:`weaponRules.blast`                                          | Q > Blast(X): each hit becomes X hits, no more than the target has models |                               |
| Deadly(X): X wounds to one model a hit                     | automated       | system:`weaponRules.deadly`, `attack.wounds`                        | Q > Deadly(X): each unsaved hit does X wounds to one model                |                               |
| Indirect: no sight needed; -1 to hit after moving          | automated       | system:`weaponRules.indirect`, `orders.shoot`                       | Q > Indirect: -1 to hit after moving, and may shoot what it can't see     |                               |
| Lock-On: ignores cover and Stealth                         | automated       | system:`coreEffects.Cover`, `unitRules.stealth`                     | Q > Stealth is -1 to be hit by shooting, not by Lock-On                   |                               |
| Reliable: hits on 2+                                       | automated       | system:`weaponRules.reliable`                                       | Q > Reliable and Sniper hit on 2+ whatever the Quality                    |                               |
| Rending: a natural 6 to hit is much harder to save         | automated       | system:`defense` (`const.rending`)                                  | Q > Rending: a natural 6 to hit makes the Defense roll 4 harder           |                               |
| Sniper: hits on 2+                                         | automated       | system:`weaponRules.sniper`                                         | Q > Reliable and Sniper hit on 2+ whatever the Quality                    |                               |
| Sniper: the shooter picks the model hit                    | automated       | system:`allocate` (`attackerPicks`); core runner:`allocationChoice` | Q > Sniper: the shooter picks the model hit, before the damage            | Picked on the attack panel    |
| Poison: natural 6s make the defender re-roll its saving 6s | manual reminder | system:`weaponRules.poison`                                         | S > qd6-1 seed 1                                                          | Shown as the shot is declared |

## Unit rules

| Rule                                                              | Status          | Where (file:symbol)                                         | Test (file > test name)                                                         | Notes                                                         |
| ----------------------------------------------------------------- | --------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Tough(X): X wounds a model                                        | automated       | roster:`toughOf`, `readQd6ArmyList`                         | Q > Tough(X) from a list becomes each model's Wounds                            | From the list on import                                       |
| Fearless: a failed morale test passes on a further 4+             | automated       | morale:`moraleTest`                                         | Q > a pass keeps the unit steady; Fearless passes a failed test on a further 4+ |                                                               |
| Impact(X): X hits on 2+ a model as the charge lands               | automated       | system:`unitRules.impact`; melee:`fight`                    | Q > Impact(X): X hits on 2+ for each model as the charge lands                  |                                                               |
| Furious: charging, natural 6s in melee score an extra hit         | automated       | system:`unitRules.furious`                                  | Q > Furious: charging, each natural 6 to hit in melee scores one more hit       |                                                               |
| Relentless: having held, natural 6s at over 9" score an extra hit | automated       | system:`unitRules.relentless`                               | Q > Relentless: having held, natural 6s to hit at over 9" score an extra hit    |                                                               |
| Regeneration: ignore each wound on a 5+                           | automated       | system:`unitRules.regeneration`                             | Q > Regeneration ignores each wound on a 5+                                     |                                                               |
| Stealth: -1 to be hit by shooting                                 | automated       | system:`unitRules.stealth`                                  | Q > Stealth is -1 to be hit by shooting, not by Lock-On                         |                                                               |
| Fast: +2" Move                                                    | automated       | system:`unitRules.fast`                                     | Q > Fast and Slow move 2" more or less                                          |                                                               |
| Slow: -2" Move                                                    | automated       | system:`unitRules.slow`                                     | Q > Fast and Slow move 2" more or less                                          |                                                               |
| Flying: moves over blocking terrain                               | automated       | system:`terrain.blocking` (`movement`)                      | Q > Flying moves over blocking terrain                                          | Moving over units is by hand                                  |
| Strider: difficult ground doesn't slow it                         | manual reminder | system:`ruleReminders.strider`                              | S > qd6-1 seed 1                                                                | Shown as it moves                                             |
| Scout: set up last, then a free move                              | manual reminder | system:`ruleReminders.scout`                                | S > qd6-1 seed 1                                                                | Shown at deployment                                           |
| Ambush: wait off the table and arrive later                       | manual reminder | system:`ruleReminders.ambush`; ui/Qd6Card:`Qd6BeforeBattle` | S > qd6-1 seed 1                                                                | The unit card offers Wait in ambush, then Arrive from round 2 |
| Hero: may join a friendly unit                                    | manual reminder | system:`ruleReminders.hero`; ui/Qd6Card:`Qd6BeforeBattle`   | S > qd6-1 seed 1                                                                | The unit card offers Join a unit at deployment                |
| Any other rule in a list                                          | manual reminder | core content/runtime.ts:`bindRules` (unbound)               | R > reads a unit builder's JSON export through Army list v1                     | Kept by name with the player's own text; never guessed        |
