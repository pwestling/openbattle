import { describe, expect, it } from "vitest";
import "../systems";
import arena from "../../examples/packages/arena.js?raw";
import riftLanterns from "../../games/rift-lanterns/rift-lanterns.js?raw";
import brinewatch from "../../games/brinewatch/brinewatch.js?raw";
import { aliveModels, applyEvent, sidePlayers, stateAt, undoneSeqs, type GameRecord } from "../core";
import { story, storyBrief } from "../core/content/story";
import { readManifest } from "../packages/manifest";
import { soak } from "./run";
import { storyCheck } from "./storyCheck";

/**
 * The turn story (#85) over real play in every built-in game and package games: the bot plays
 * the first rounds, and the story of a whole round tells both sides, with the counts the
 * table shows, and no secret before its reveal (Conquest's command stacks, Brinewatch's
 * hideouts, package answers kept by the bot).
 */
/** Name, system, package, rounds to play, players a side, and whether the bot keeps secrets in it. */
const games: [string, string, { source: string } | undefined, number, 1 | 2, boolean][] = [
  ["40k", "forty-k-11", undefined, 1, 1, false],
  ["40k 2v2", "forty-k-11", undefined, 1, 2, false],
  ["Rift Lanterns", "", { source: riftLanterns }, 2, 1, false],
  ["Brinewatch", "", { source: brinewatch }, 2, 1, true],
  ["arena package", "", { source: arena }, 2, 1, false],
];

/** The first seq in each round: [round 1 start, round 2 start, ...]. */
function rounds(record: GameRecord): number[] {
  const out: number[] = [];
  let round = 0;
  let state = record.initial;
  for (const e of record.events) {
    state = applyEvent(state, e.event);
    const r = state.turn.round;
    if (r > round) {
      out.push(e.seq);
      round = r;
    }
  }
  return out;
}

describe("the turn story over real play", () => {
  for (const [name, id, pkg, untilRound, teamSize, secrets] of games)
    it(
      name,
      async () => {
        const system = pkg
          ? (readManifest(pkg.source) as { manifest: { systems: string[] } }).manifest.systems[0]!
          : id;
        const r = await soak({
          system,
          seed: 2,
          trouble: false,
          deadEnds: false,
          untilRound,
          teamSize,
          ...(pkg ? { systemPkg: pkg, maxSteps: 3000 } : {}),
        });
        expect(r.failures).toEqual([]);
        const record = r.record!;
        // Every turn told, by every reader, with no secret given away.
        const check = storyCheck(record, r.kept);
        expect(check.failures).toEqual([]);
        expect(check.turns.length).toBeGreaterThan(1);
        // Conquest's command stacks and Brinewatch's hideouts were committed, and kept from the story.
        if (secrets) expect(r.kept.size).toBeGreaterThan(0);

        // Round 1, start to end: both sides did something, and the story says so in their words.
        const [r1, r2] = rounds(record);
        const s = story(record, r1! - 1, (r2 ?? Infinity) - 1, null);
        expect(s.phases[0]).toMatchObject({ round: 1 });
        expect(s.sides).toHaveLength(2);
        // The table at the start as the story reads it: without what was undone by its end.
        const undone = undoneSeqs(record, s.to);
        const before = stateAt(
          { ...record, events: record.events.filter((e) => !undone.has(e.seq)) },
          s.from,
        );
        const after = stateAt(record, s.to);
        for (const side of s.sides) {
          expect(side.lines.length, `${name}: ${side.name} has no line`).toBeGreaterThan(0);
          expect(side.lines.every((l) => l.startsWith(`${side.name}:`))).toBe(true);
          if (side.moved.length) expect(side.lines[0]).toContain(`moved ${side.moved.length} unit`);
          // Its losses are the models it had at the start and not at the end (more where some came back).
          const units = Object.values(before.units).filter(
            (u) => before.players[u.owner]?.seat === side.seat,
          );
          const lost = units.reduce(
            (n, u) =>
              n +
              aliveModels(before, u).filter((m) => !after.models[m.id] || after.models[m.id]!.destroyed)
                .length,
            0,
          );
          expect(side.losses.reduce((n, l) => n + l.slain, 0)).toBeGreaterThanOrEqual(lost);
          if (lost) expect(side.lines.join(" ")).toContain("lost ");
          // VP: what the side's counter shows.
          const holder = sidePlayers(after, side.seat)[0]!.id;
          expect(side.vp).toBe((after.resources[holder]?.VP ?? 0) - (before.resources[holder]?.VP ?? 0));
          // The attacks it made cost the other side no more than it lost.
          const other = s.sides.find((x) => x !== side)!;
          expect(side.attacks.reduce((n, a) => n + a.slain, 0)).toBeLessThanOrEqual(
            other.losses.reduce((n, l) => n + l.slain, 0),
          );
          // Each side's own one line, within the bar's room.
          const brief = storyBrief(s, side.players[0]!);
          if (brief) expect(brief.length).toBeLessThanOrEqual(110 + 60);
        }
        expect(s.sides.some((x) => x.attacks.length)).toBe(true);
      },
      400_000,
    );
});
