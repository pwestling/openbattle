import { stateAt, undoneSeqs, type GameRecord, type GameState, type PlayerId } from "../core";
import { story } from "../core/content/story";

/**
 * One line for the step bar on what just happened out of your hands (naive players 6): your last
 * attack's result, and what the other side did since, until you do the next thing. The words are
 * story()'s brief (#85), told from your last run of events on.
 */
export function recapLine(record: GameRecord, game: GameState, mine: PlayerId[]): string | null {
  if (!mine.length) return null;
  const undone = undoneSeqs(record);
  const events = record.events.filter((e) => !undone.has(e.seq) && e.event.type !== "undo");
  // The other side's run of events since your last one: none means you've moved on.
  let i = events.length;
  while (i > 0 && !mine.includes(events[i - 1]!.by ?? "")) i--;
  const theirs = events.slice(i).filter((e) => !!e.by && !!game.players[e.by]);
  if (!theirs.length) return null;
  // Tell it from the start of your own run just before theirs, so your last attack opens the line.
  let j = i;
  while (j > 0 && mine.includes(events[j - 1]!.by ?? "")) j--;
  const fromSeq = events[j - 1]?.seq ?? 0;
  return story(record, fromSeq, Infinity, mine[0]!, { start: stateAt(record, fromSeq) }).brief;
}
