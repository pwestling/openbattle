# The turn story: what happened while you waited

Roadmap #85. `story(record, fromSeq, toSeq, viewer)` in
`src/core/content/story.ts` tells a stretch of the game log (the events after
`fromSeq`, up to and including `toSeq`) side by side: what each side's units
did, whom they attacked and what it cost, the VP scored, the CP and
stratagems spent, the reactions played. Facts come first, as data a screen
can word its own way; `lines` and `brief` are ready-made text in the reader's
language (`t`/`tn`, as `core/clock.ts` does).

It reads only the log and the tables it folds to, so it works the same for
every game, built in or from a package, and on every device. Undone events
are left out.

## Calling it

```ts
import { story, storyBrief } from "../core/content/story";

const s = story(record, fromSeq, toSeq, viewer); // viewer: a player id, or null for a watcher
s.brief; // "Lost 2 Line Troopers; Field Marshal destroyed. Rook scored 5 VP. Rook attacked Lance Team."
s.lines; // one or two lines per side, seat order
storyBrief(s, otherPlayer); // the same stretch's line for another reader, without folding again
story(record, fromSeq, toSeq, viewer, { start }); // `start` = stateAt(record, fromSeq): fold only the stretch
```

## The answer

```ts
interface Story {
  from: number;
  to: number;
  viewer: PlayerId | null;
  viewerSeat: number | null;
  start: StoryMoment;
  end: StoryMoment; // { round, seat (whose turn), phase name }
  phases: StoryMoment[]; // phases entered on the way
  over: boolean; // the battle was over by the end
  sides: StorySide[]; // every side, seat order
  lines: string[]; // every side's lines
  brief: string | null; // the viewer's one line, about 110 characters at most
}

interface StorySide {
  seat: number;
  players: PlayerId[];
  name: string; // "Ana & Cy", names as shown
  moved: UnitId[]; // units whose models moved (deployment aside)
  deployed: number; // units set down before the battle
  acts: { action; name; verb; units }[]; // actions taken, by action
  attacks: { attacker; attackerName; target; targetName; slain; wounds; destroyed }[]; // made by this side
  losses: { unit; name; slain; wounds; destroyed }[]; // suffered by this side, from any cause
  destroyed: UnitId[];
  vp: number;
  scores: { vp; why; round }[]; // VP gained, and each scoring rule's name
  spent: Record<string, number>;
  gained: Record<string, number>; // counters by resource id (CP, VP, ...)
  plays: { action; name; cost; reaction; unit?; unitName? }[]; // stratagems and reactions
  rerolls: number;
  secrets: { committed: number; revealed: string[] }; // revealed: the labels the revealer gave
  lines: string[];
}
```

How it is worked out, event by event:

- **Moved**: a model of the unit changed place (any move, a charge, a pile in, a flee), not while setting up.
- **Acts**: `action/take` by a unit, or a code action started for a unit (`script/step` with `started`).
- **Attacks**: the attack in hand as the event lands: the event's own (`action/take` with a
  target, `attack/declare`, a code action with a target), else the table's `attack`, `procedure`
  or `script` (`args.unit`, `args.target`). Models of the attacked side lost meanwhile go to the
  attacking unit; in a code procedure's fight, the attacker's own losses go to the unit it fought.
  An attack on an enemy shows even when it cost nothing.
- **Losses**: a model alive before the event and destroyed (or gone) after; wounds from `woundsLost`.
- **Plays**: `player/action` (stratagems, with their cost), and a unit's action while it reacts
  (FSD's held action); either is a reaction when the window or held action was this side's.
- **VP, CP**: the side's counters before and after each event (a side's counters are one set,
  held by its first player); `score/confirm` gives the scoring rule's name.

## The brief

The viewer's one line, most important first, items dropped from the end until it fits:

1. the viewer's own last attack in the stretch, if any ("Your Lance Team hit Cinder Brutes: 2 slain");
2. what the viewer lost ("Lost 2 Line Troopers; Field Marshal destroyed");
3. VP the other side scored; 4. whom it attacked; 5. how many units it moved;
4. what it played (stratagems, reactions); 7. its other actions, when it moved nothing.

A watcher (`viewer` null) gets each side's attacks with their results instead of 1 and 2.

## A game's own words

`GameSystem.storyVerbs` maps action ids (data or code actions) to past-tense verbs:
`{ advance: "advanced", shoot: "shot", normalMove: "" }`. The line reads "shot with 2 units".
An empty verb leaves the action out of the lines (a plain move, already counted as moved);
an action not named is told by its name ("Volley with 1 unit"). Verbs go through `gameText`,
and `pnpm i18n` extracts them. A whole-game package sets them on its `system`.

## Secrets

The log only ever holds a secret's commitment until it is revealed (core/secrets.ts), and the
story reads no secret value, revealed or not: it counts commitments and reveals, with the
reveal's label. Script answers given in secret (`ctx.secret`) are commitments too. The soak
checks this on every turn of every game (`src/soak/storyCheck.ts`): no value the bot kept
appears in a story told before its reveal.

## Cost

One fold of the log: the same as `stateAt`. Pass `start` when the state at `fromSeq` is at hand,
and only the stretch is folded (a 40k player turn of about 100 events: about 20 to 50 ms on a
loaded machine, against 250 ms to fold a whole 1,300-event game).

## Where screens can use it

- When the other side's turn ends: `story(record, seqWhenTheirTurnStarted, lastSeq, me).brief`
  in the step bar, kept until the player acts.
- Play by mail, "while you were away": `story(record, seqOfMyLastFile, lastSeq, me).lines`.
- Replays and chapters: one story per chapter (round and side), `viewer` null.
- The end card: `story(record, 0, lastSeq, me)` for the whole battle's attacks and losses.
