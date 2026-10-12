import { afterEach, describe, expect, it } from "vitest";
import { createInitialState, createRecord, stateAt } from "../core";
import { armyListRoster, isArmyList } from "../share/armyList";
import { addPackageMissions, clearPackageMissions, gameModule, missionFrom } from "../systems";
import { SandboxEngine } from "../sandbox/engine";
import valid from "../../conformance/package-armies/v1/valid/one-army.js?raw";
import mixed from "../../conformance/package-armies/v1/valid/with-bad-entries.js?raw";
import borderMuster from "../../examples/packages/border-muster.js?raw";
import { packageArmiesFor, readPackageArmies } from "./armies";
import type { StoredPackage } from "./library";
import { readManifest } from "./manifest";

// Packages that bring armies and missions (#82b). Every name below is invented.

const importSource = (source: string) =>
  import(/* @vite-ignore */ `data:text/javascript,${encodeURIComponent(source)}`) as Promise<{
    default?: unknown;
  }>;

function stored(source: string, hash: string): StoredPackage {
  const read = readManifest(source);
  if ("error" in read) throw new Error(read.error);
  return {
    hash,
    manifest: read.manifest,
    source,
    bytes: source.length,
    addedAt: 0,
    trusted: false,
    own: true,
  };
}

afterEach(() => clearPackageMissions());

describe("package armies (export const armies)", () => {
  it("reads the conformance fixture's army as data, without running the package", () => {
    const { armies, warnings } = readPackageArmies(valid);
    expect(warnings).toEqual([]);
    expect(armies).toHaveLength(1);
    expect(isArmyList(armies[0])).toBe(true);
    expect(armies[0]).toMatchObject({ name: "Two Lanterns", system: "qd6-1" });
  });

  it("turns away entries a v1 reader can't take with a warning each, and keeps the rest", () => {
    const { armies, warnings } = readPackageArmies(mixed);
    expect(armies.map((a) => a.name)).toEqual(["Kept"]);
    expect(warnings).toHaveLength(3);
    expect(warnings[0]).toMatch(/army-list@2/);
    expect(warnings[1]).toMatch(/no units/);
    expect(warnings[2]).toMatch(/no name/);
  });

  it("a package with no armies, or armies that aren't a plain literal, brings none", () => {
    expect(readPackageArmies("export const manifest = {};")).toEqual({ armies: [], warnings: [] });
    const bad = readPackageArmies("export const armies = makeArmies();");
    expect(bad.armies).toEqual([]);
    expect(bad.warnings[0]).toMatch(/plain literal/);
    expect(readPackageArmies("export const armies = { name: 'x' };").warnings[0]).toMatch(/must be a list/);
  });

  it("offers a package's armies for the games they name, labelled with the package", () => {
    const pkgs = [stored(borderMuster, "a".repeat(64)), stored(mixed, "b".repeat(64))];
    const here = packageArmiesFor(pkgs, "forty-k-11");
    expect(here.map((a) => `${a.list.name} · ${a.from.name}`)).toEqual([
      "Reedmarsh Wardens · Border Muster",
      "Ashford Levy · Border Muster",
    ]);
    // No `system`: it goes to the games the package's manifest names.
    expect(packageArmiesFor(pkgs, "qd6-1").map((a) => `${a.list.name} · ${a.from.name}`)).toEqual([
      "Kept · Fixture Armies (mixed)",
    ]);
    expect(packageArmiesFor(pkgs, "other-game")).toEqual([]);
  });

  it("reads a package army with the Army list reader", () => {
    const [army] = packageArmiesFor([stored(borderMuster, "c".repeat(64))], "forty-k-11");
    const roster = armyListRoster(army!.list);
    expect(roster.units.map((u) => u.name)).toEqual(["Warden Captain", "Reed Archers"]);
    expect(roster.units[1]!.models).toHaveLength(5);
  });
});

describe("package missions (an extension's missions)", () => {
  it("an extension adds its missions to the game it extends, beside the game's own, and scores them in the sandbox", async () => {
    const own = gameModule("forty-k-11")!.app!.missions!.map((m) => m.id);
    const engine = new SandboxEngine(importSource);
    const loaded = await engine.load([{ hash: "d".repeat(64), source: borderMuster }]);
    expect(loaded.errors).toEqual([]);
    const missions = loaded.packages[0]!.missions?.["forty-k-11"];
    expect(missions?.map((m) => m.id)).toEqual(["border-muster.fording"]);
    expect(missions![0]!.setup.objectives).toEqual([{ id: "ford", position: { x: 0, y: 0 } }]);
    // Data for the app: its code stays in the sandbox.
    expect(JSON.parse(JSON.stringify(missions))).toEqual(missions);

    // The game's own missions are still there, the extension's after them.
    const ids = gameModule("forty-k-11")!.app!.missions!.map((m) => m.id);
    expect(ids).toEqual([...own, "border-muster.fording"]);

    // Chosen at setup, the sandbox works out its setup for the table played on.
    const record = createRecord({
      ...createInitialState(),
      system: "forty-k-11",
      table: { ...createInitialState().table, width: 60, depth: 44 },
      mission: { id: "border-muster.fording", name: "The Fording" },
    });
    engine.init(record);
    const app = engine.appState();
    expect(app.table).toEqual({ width: 60, depth: 44 });
    expect(app.setups["border-muster.fording"]!.zones[0]!.points[0]).toEqual({ x: -30, y: 10 });
    expect(stateAt(record).mission?.id).toBe("border-muster.fording");
  });

  it("an extension's mission scores as written: 2 VP at the end of a round to the side holding the ford", async () => {
    const engine = new SandboxEngine(importSource);
    await engine.load([{ hash: "e".repeat(64), source: borderMuster }]);
    const fording = gameModule("forty-k-11")!.app!.missions!.find((m) => m.id === "border-muster.fording")!;
    const base = createInitialState();
    const model = (id: string, owner: string, x: number) => ({
      id,
      owner,
      unitId: `u-${owner}`,
      position: { x, y: 0 },
      destroyed: false,
    });
    const game = {
      ...base,
      players: { p0: { id: "p0", seat: 0 }, p1: { id: "p1", seat: 1 } },
      objectives: [{ id: "ford", position: { x: 0, y: 0 } }],
      models: {
        a: model("a", "p0", 1),
        b: model("b", "p0", -2),
        c: model("c", "p1", 2.5),
        d: model("d", "p1", 9),
      },
    } as unknown as typeof base;
    const [rule] = fording.scoring;
    expect(rule!.at).toEqual({ roundEnd: true });
    expect(rule!.suggest(game, 0)).toEqual({ vp: 2, why: "holds the ford" });
    expect(rule!.suggest(game, 1)).toBeNull();
    // A tie holds nothing.
    const tied = { ...game, models: { ...game.models, d: model("d", "p1", 0) } } as unknown as typeof game;
    expect(rule!.suggest(tied, 0)).toBeNull();
  });

  it("an added mission with a game mission's id replaces it, and clearing puts the game's back", () => {
    const own = gameModule("forty-k-11")!.app!.missions!;
    const stand = { ...own[0]!, name: "Replaced" };
    addPackageMissions("forty-k-11", [stand], "f".repeat(64));
    expect(gameModule("forty-k-11")!.app!.missions!.map((m) => m.name)).toContain("Replaced");
    // The picker says which package it came from.
    expect(missionFrom("forty-k-11", stand.id)).toBe("f".repeat(64));
    clearPackageMissions();
    expect(gameModule("forty-k-11")!.app!.missions).toBe(own);
    expect(missionFrom("forty-k-11", stand.id)).toBeUndefined();
  });
});
