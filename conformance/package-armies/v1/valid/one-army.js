// Conformance fixture: an extension package bringing one Army list v1 army
// (docs/protocols/packages.md, "armies"). Invented throughout. A reader reads
// `armies` as data and never runs this file.

export const manifest = {
  id: "fixture.package-armies",
  name: "Fixture Armies",
  version: "1.0.0",
  api: 1,
  kind: "extension",
  systems: ["qd6"],
  requires: [],
  adds: "One invented army.",
};

export const armies = [
  {
    format: "open-battle/army-list@1",
    name: "Two Lanterns",
    system: "qd6-1",
    units: [{ name: "Lantern Bearer", size: 2, characteristics: { Q: "4+", D: "5+" } }],
  },
];
