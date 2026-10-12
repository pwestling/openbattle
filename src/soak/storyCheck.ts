import {
  applyEvent,
  sidePlayers,
  sides,
  undoneSeqs,
  type GameEvent,
  type GameRecord,
  type GameState,
} from "../core";
import { story, storyBrief, type Story } from "../core/content/story";
import type { Kept } from "./bot";

/**
 * The turn story (#85) over a soaked game: told for every player turn (or
 * round) by each side and by a watcher, it must never throw and never tell a
 * secret value before its reveal. Returns what went wrong, and each turn's
 * story for tests to read.
 */
export function storyCheck(
  record: GameRecord,
  kept: Kept,
): { failures: string[]; turns: { from: number; to: number; story: Story }[] } {
  const failures: string[] = [];
  const turns: { from: number; to: number; story: Story }[] = [];
  const undone = undoneSeqs(record);
  // Where each turn starts: the round or the side whose turn it is changes.
  const cuts: { seq: number; state: GameState }[] = [];
  let state = record.initial;
  let mark = "";
  for (const e of record.events) {
    if (!undone.has(e.seq)) state = applyEvent(state, e.event);
    state = { ...state, seq: e.seq };
    const now = `${state.turn.round}:${state.turn.activeSeat}`;
    if (now !== mark) cuts.push({ seq: e.seq, state });
    mark = now;
  }
  // Values revealed by a seq, and every value kept (secrets, secret answers) as text.
  const revealedAt = new Map<string, number>();
  const inner = (ev: GameEvent): GameEvent[] =>
    ev.type === "script/step" ? [ev, ...ev.events.flatMap(inner)] : [ev];
  for (const e of record.events)
    for (const ev of inner(e.event))
      if (ev.type === "secret/reveal") {
        const v = JSON.stringify(ev.value);
        if (!revealedAt.has(v)) revealedAt.set(v, e.seq);
      }
  const values = [...kept.values()].map((k) => JSON.stringify(k.value));
  const ids = new Set(
    [...Object.keys(state.units), ...Object.keys(state.players)].map((id) => JSON.stringify(id)),
  );
  for (let i = 0; i + 1 < cuts.length; i++) {
    const { seq: from, state: start } = cuts[i]!;
    const to = cuts[i + 1]!.seq;
    const viewers: (string | null)[] = [
      null,
      ...sides(start).map((seat) => sidePlayers(start, seat)[0]?.id ?? null),
    ];
    let s: Story;
    try {
      s = story(record, from, to, null, { start });
    } catch (e) {
      failures.push(`story threw for ${from}..${to}: ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }
    const briefs = viewers.map((v) => storyBrief(s, v) ?? "");
    const text = [...s.lines, ...briefs].join("\n");
    const json = JSON.stringify(s);
    for (const v of values) {
      const at = revealedAt.get(v);
      if (at !== undefined && at <= to) continue;
      const bare = v.startsWith('"') ? v.slice(1, -1) : v;
      if (bare.length <= 3) continue;
      // A secret that is a unit's id (a command card) may name a unit the story tells of anyway.
      if (text.includes(bare) || (!ids.has(v) && json.includes(v)))
        failures.push(`story for ${from}..${to} tells a secret value before its reveal: ${bare}`);
    }
    turns.push({ from, to, story: s });
  }
  return { failures, turns };
}
