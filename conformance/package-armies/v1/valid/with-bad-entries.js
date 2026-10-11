// Conformance fixture: a package whose `armies` holds one army a v1 reader
// takes and three it turns away with a warning each (a newer major, no units,
// no name). The good one still loads. Invented throughout.

export const manifest = {
  id: "fixture.package-armies-mixed",
  name: "Fixture Armies (mixed)",
  version: "1.0.0",
  api: 1,
  kind: "extension",
  systems: ["qd6"],
  requires: [],
};

export const armies = [
  { format: "open-battle/army-list@2", name: "From the future", units: [{ name: "Someone" }] },
  { format: "open-battle/army-list@1", name: "Nobody", units: [] },
  { format: "open-battle/army-list@1", name: "", units: [{ name: "Nameless" }] },
  {
    format: "open-battle/army-list@1",
    name: "Kept",
    units: [{ name: "Marsh Wader" }],
    "x-fixture-builder-id": 7,
  },
];
