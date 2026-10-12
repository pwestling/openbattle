// Border Muster: an example extension package that brings armies and a
// mission to the sci-fi battle (#82b, docs/packages.md "Armies and missions").
// Everything in it is invented.
//
// `armies` is data: a list of Army list v1 documents
// (docs/protocols/army-list.md), read without running the package. They
// appear wherever the game's sample armies are offered, labelled with the
// package's name. `missions` is code, like a whole game's missions: picked at
// setup beside the game's own, and run in the sandbox.

export const manifest = {
  id: "example.border-muster",
  name: "Border Muster",
  version: "1.0.0",
  author: "Open Battle examples",
  api: 1,
  kind: "extension",
  systems: ["forty-k"],
  requires: [],
  adds: "Two invented warbands and a mission, the Fording, for the sci-fi battle.",
};

export const armies = [
  {
    format: "open-battle/army-list@1",
    name: "Reedmarsh Wardens",
    system: "forty-k-11",
    units: [
      {
        name: "Warden Captain",
        size: 1,
        points: 60,
        characteristics: { M: '6"', T: "4", Sv: "3+", W: "3", Ld: "6+", OC: "1" },
        base: { shape: "round", diameterMm: 32 },
        weapons: [{ name: "Reed Glaive", characteristics: { A: 3, AP: 1 } }],
      },
      {
        name: "Reed Archers",
        size: 5,
        points: 75,
        characteristics: { M: '6"', T: "3", Sv: "5+", W: "1", Ld: "7+", OC: "1" },
        weapons: [
          { name: "Longbow", range: 24, characteristics: { A: 1 } },
          { name: "Knife", kind: "melee", characteristics: { A: 1 } },
        ],
      },
    ],
  },
  {
    format: "open-battle/army-list@1",
    name: "Ashford Levy",
    system: "forty-k-11",
    units: [
      {
        name: "Levy Spears",
        size: 10,
        points: 90,
        characteristics: { M: '6"', T: "3", Sv: "5+", W: "1", Ld: "7+", OC: "2" },
        weapons: [{ name: "Spear", characteristics: { A: 1 } }],
      },
      {
        name: "Ford Riders",
        size: 3,
        points: 80,
        characteristics: { M: '10"', T: "4", Sv: "4+", W: "2", Ld: "7+", OC: "1" },
        base: { shape: "oval", widthMm: 60, depthMm: 35 },
        weapons: [{ name: "Lance", characteristics: { A: 2, AP: 1 } }],
      },
    ],
  },
];

/** The seat holding the ford: the most models within 3" of it, nobody on a tie. */
function holder(game) {
  const ford = game.objectives.find((o) => o.id === "ford");
  if (!ford) return null;
  const count = {};
  for (const m of Object.values(game.models)) {
    if (m.destroyed || !m.unitId) continue;
    if (Math.hypot(m.position.x - ford.position.x, m.position.y - ford.position.y) > 3) continue;
    const seat = game.players[m.owner]?.seat;
    if (seat !== undefined) count[seat] = (count[seat] ?? 0) + 1;
  }
  const ranked = Object.entries(count).sort((a, b) => b[1] - a[1]);
  return ranked[0] && ranked[0][1] !== ranked[1]?.[1] ? Number(ranked[0][0]) : null;
}

export default {
  missions: [
    {
      id: "border-muster.fording",
      name: "The Fording",
      summary: "One ford in the middle of the table. At the end of each round, 2 VP to the side holding it.",
      setup: (t) => {
        const hx = t.width / 2;
        const hy = t.depth / 2;
        const strip = (seat, y0, y1) => ({
          seat,
          points: [
            { x: -hx, y: y0 },
            { x: hx, y: y0 },
            { x: hx, y: y1 },
            { x: -hx, y: y1 },
          ],
        });
        return {
          zones: [strip(0, hy - 12, hy), strip(1, -hy, -(hy - 12))],
          objectives: [{ id: "ford", position: { x: 0, y: 0 } }],
        };
      },
      scoring: [
        {
          id: "ford",
          name: "Hold the ford",
          at: { roundEnd: true },
          suggest: (game, seat) => (holder(game) === seat ? { vp: 2, why: "holds the ford" } : null),
        },
      ],
    },
  ],
};
