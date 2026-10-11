import { edgeZones, held, holders, objective, plural } from "../../missions/common";
import type { Mission } from "../../sdk";

/**
 * An invented sample mission: three objectives across the middle; at the
 * end of each round, 1 VP for each one a side holds (the most models within
 * 3"). Shaken units hold nothing.
 */
export function holdFast(range = 3): Mission {
  return {
    id: "hold-fast",
    name: "Hold Fast (sample)",
    summary: `Three objectives across the middle. At the end of each round, 1 VP for each one you hold: the most models within ${range}". Shaken units don't count.`,
    setup: (t) => ({
      zones: edgeZones(t, 12),
      objectives: [
        objective("centre", 0, 0),
        objective("left", -t.width / 4, 0),
        objective("right", t.width / 4, 0),
      ],
    }),
    scoring: [
      {
        id: "hold",
        name: "Hold Fast",
        at: { roundEnd: true },
        suggest: (game, seat) => {
          const mine = held(
            holders(game, range, (_g, u) => (u?.status?.shaken ? 0 : 1)),
            seat,
          );
          return { vp: mine.length, why: `holds ${plural(mine.length, "objective")}` };
        },
      },
    ],
  };
}
