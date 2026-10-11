import { describe, expect, it } from "vitest";
import exported from "./fixtures/builder-export.json";
import listText from "./fixtures/list.txt?raw";
import full from "../../../conformance/army-list/v1/valid/full.json";
import { sharedKind } from "../../share/links";
import { builderArmyList, importQd6List, isQualityList } from "./roster";
import { qd6Armies } from "./sample";
import { importArmyFile } from "../../ui/shelfActions";

// Lists a player brings (#82). The fixtures are invented: made-up names and numbers.

const bytes = (v: unknown) => new TextEncoder().encode(typeof v === "string" ? v : JSON.stringify(v));

describe("Quality d6 army lists", () => {
  it("reads a unit builder's JSON export through Army list v1", async () => {
    const army = await importQd6List("raiders.json", bytes(exported));
    expect(army.name).toBe("Mossback Raiders");
    expect(army.units.map((u) => u.name)).toEqual(["Old Grumm", "Mossback Slingers", "Mossback Riders"]);
    const [chief, slingers, riders] = army.units;
    // Quality and Defense from "3" and 4, Wounds from Tough(3); an item's rule goes to the unit.
    expect(chief!.models[0]!.profile!.chars).toEqual({ Q: "3+", D: "4+", W: "3" });
    expect(chief!.sheet.abilities.map((a) => a.name)).toEqual([
      "Hero",
      "Tough(3)",
      "Glimmerhide",
      "Regeneration",
    ]);
    expect(chief!.sheet.abilities[2]!.text).toBe("An invented rule nobody plays.");
    expect(chief!.sheet.weapons["root-maul"]).toMatchObject({ kind: "melee", keywords: ["AP(1)"] });
    expect(chief!.base).toEqual({ shape: "round", diameterMm: 40 });
    // A weapon with two profiles is two weapons.
    expect(Object.keys(slingers!.sheet.weapons)).toEqual(["pebble-sling", "bolas-thrown", "bolas-swung"]);
    expect(slingers!.sheet.weapons["bolas-thrown"]!.chars).toEqual({ A: "2", Range: "9" });
    expect(slingers!.models.filter((m) => m.weapons.includes("bolas-thrown"))).toHaveLength(2);
    // An `ap` field becomes AP(X).
    expect(riders!.sheet.weapons["hook-spear"]!.keywords).toEqual(["AP(1)"]);
    expect(army.points).toBe(395);
  });

  it("reads the same list as text", async () => {
    const army = await importQd6List("raiders.txt", bytes(listText));
    expect(army.name).toBe("Mossback Raiders");
    expect(army.units.map((u) => [u.name, u.models.length])).toEqual([
      ["Old Grumm", 1],
      ["Mossback Slingers", 6],
      ["Mossback Riders", 3],
    ]);
    expect(army.units[0]!.models[0]!.profile!.chars.W).toBe("3");
    expect(army.units[1]!.sheet.weapons["pebble-sling"]).toMatchObject({
      chars: { A: "1", Range: "18" },
      keywords: ["Blast(2)"],
    });
    expect(army.points).toBe(395);
  });

  it("reads Army list v1 natively, Tough(X) giving Wounds where the list gives none", async () => {
    const army = await importQd6List("raiders.json", bytes(full));
    expect(army.units[0]!.models[0]!.profile!.chars).toMatchObject({ Q: "3+", D: "4+", W: "3" });
    expect(army.units[0]!.base).toEqual({ shape: "round", diameterMm: 40 });
    expect(army.units[1]!.models[0]!.profile!.chars).toMatchObject({ Quality: "4", Defense: "5", W: "1" });
  });

  it("a builder's export opens from a link or a dropped file as an army, by its shape", () => {
    expect(isQualityList(exported)).toBe(true);
    expect(sharedKind(exported)).toBe("army");
    expect(isQualityList({ units: [{ name: "x" }] })).toBe(false);
    expect(isQualityList(full)).toBe(false);
    expect(builderArmyList(exported, "file")).toMatchObject({
      format: "open-battle/army-list@1",
      system: "qd6-1",
    });
  });

  it("goes on the army shelf for this game when opened from a file or a link", async () => {
    const fromBuilder = await importArmyFile(new File([bytes(exported) as BlobPart], "raiders.json"));
    if (typeof fromBuilder === "string") throw new Error(fromBuilder);
    expect(fromBuilder).toMatchObject({ system: "qd6-1", name: "Mossback Raiders" });
    expect(fromBuilder.roster.units[0]!.models[0]!.profile!.chars.W).toBe("3");
    const fromSpec = await importArmyFile(new File([bytes(full) as BlobPart], "raiders.json"));
    if (typeof fromSpec === "string") throw new Error(fromSpec);
    expect(fromSpec.system).toBe("qd6-1");
    expect(fromSpec.roster.units[0]!.models[0]!.profile!.chars.W).toBe("3");
  });

  it("says so when a file holds no units", async () => {
    await expect(importQd6List("empty.txt", bytes("nothing here"))).rejects.toThrow(/No units found/);
    await expect(importQd6List("bad.json", bytes("{ not json"))).rejects.toThrow(/doesn't parse/);
    const later = {
      format: "open-battle/army-list@2",
      name: "Later",
      units: [{ name: "x", quality: 4, defense: 4 }],
    };
    await expect(importQd6List("later.json", bytes(later))).rejects.toThrow(/doesn't read/);
  });

  it("the sample armies are whole", () => {
    for (const a of qd6Armies()) {
      expect(a.units.length).toBeGreaterThanOrEqual(4);
      for (const u of a.units) expect(Object.keys(u.sheet.weapons).length).toBeGreaterThan(0);
    }
  });
});
