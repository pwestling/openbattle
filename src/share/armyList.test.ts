import { describe, expect, it } from "vitest";
import schema from "../../schemas/army-list.v1.schema.json";
import minimal from "../../conformance/army-list/v1/valid/minimal.json";
import full from "../../conformance/army-list/v1/valid/full.json";
import noUnits from "../../conformance/army-list/v1/invalid/no-units.json";
import wrongMajor from "../../conformance/army-list/v1/invalid/newer-major.json";
import { ARMY_LIST_FORMAT, armyListRoster, isArmyList } from "./armyList";
import { sharedKind } from "./links";

// Army list v1 (DRAFT, docs/protocols/army-list.md). Every name below is invented.

describe("Army list v1", () => {
  it("the schema and the reader agree on the format line and what is required", () => {
    expect(schema.properties.format.const).toBe(ARMY_LIST_FORMAT);
    expect(schema.required).toEqual(["format", "name", "units"]);
    expect(schema.$defs.unit.required).toEqual(["name"]);
    expect(schema.$defs.weapon.required).toEqual(["name"]);
  });

  it("reads the valid fixtures and turns away the invalid ones", () => {
    expect(isArmyList(minimal)).toBe(true);
    expect(isArmyList(full)).toBe(true);
    expect(isArmyList(noUnits)).toBe(false);
    expect(isArmyList(wrongMajor)).toBe(false);
  });

  it("opens from a link or a dropped file as an army, by its format line", () => {
    expect(sharedKind(minimal)).toBe("army");
    expect(sharedKind(wrongMajor)).toBeNull();
  });

  it("reads units generically: characteristics on every model, weapons spread, rules by name, unknown fields ignored", () => {
    if (!isArmyList(full)) throw new Error("fixture");
    const roster = armyListRoster(full);
    expect(roster).toMatchObject({ name: "Mossback Raiders", points: 395, warnings: [] });
    const [chief, slingers] = roster.units;
    expect(chief!.sheet.abilities.map((a) => a.name)).toEqual(["Hero", "Tough(3)", "Glimmerhide"]);
    expect(chief!.sheet.abilities[2]!.text).toBe("An invented rule.");
    expect(chief!.base).toEqual({ shape: "round", diameterMm: 40 });
    expect(chief!.models[0]!.profile!.chars).toMatchObject({ Q: "3+", D: "4+" });
    expect(chief!.sheet.weapons["root-maul"]).toMatchObject({ kind: "melee", chars: { A: "3", AP: "1" } });
    expect(slingers!.models).toHaveLength(6);
    expect(slingers!.sheet.keywords).toEqual(["Infantry"]);
    expect(slingers!.sheet.weapons["pebble-sling"]).toMatchObject({
      kind: "ranged",
      chars: { Range: "18", A: "1" },
      keywords: ["Blast(2)"],
    });
    // Six slings, one each; a knife each (no count: one a model).
    expect(slingers!.models.every((m) => m.weapons.join() === "pebble-sling,knife")).toBe(true);
  });

  it("a minimal list still makes a unit of one", () => {
    if (!isArmyList(minimal)) throw new Error("fixture");
    const roster = armyListRoster(minimal);
    expect(roster.units).toHaveLength(1);
    expect(roster.units[0]!.models).toHaveLength(1);
    expect(roster.units[0]!.base).toEqual({ shape: "round", diameterMm: 25 });
  });

  it("keeps the packages a list names, https links only, to offer before playing", () => {
    const hash = "a".repeat(64);
    const roster = armyListRoster({
      ...minimal,
      format: ARMY_LIST_FORMAT,
      packages: [
        { url: "https://example.org/packs/wardens.json", sha256: hash.toUpperCase() },
        { url: "https://example.org/packs/wardens.json" },
        { url: "http://example.org/plain.json" },
        { url: "https://example.org/other.json", sha256: "not a hash" },
      ],
    });
    expect(roster.named).toEqual([
      { url: "https://example.org/packs/wardens.json", sha256: hash },
      { url: "https://example.org/other.json" },
    ]);
    expect(armyListRoster({ ...minimal, format: ARMY_LIST_FORMAT }).named).toBeUndefined();
  });
});
