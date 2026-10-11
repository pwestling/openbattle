import { describe, expect, it } from "vitest";
import riftSource from "../../games/rift-lanterns/rift-lanterns.js?raw";
import cinderCourt from "../../examples/faction-packs/cinder-court.js?raw";
import { stateAt } from "../core/log";
import type { GameRecord } from "../core";
import { readCampaign } from "../campaign/book";
import { parseFile, signatureOk, type MailFile } from "../mail/file";
import { readFactionPack } from "../packages/faction";
import { readManifest } from "../packages/manifest";
import { readArmy } from "../packages/shelf";
import { readCardFile } from "../player/card";
import { checkSigned } from "../ranked/verify";
import { isArmyList } from "../share/armyList";
import { sharedKind } from "../share/links";
import { readStandee } from "../standees/file";
import { readTable } from "../tables/library";
import { fixtures, schemaErrors, writeFixture } from "./conformance";
import {
  newIdentity,
  sampleArmy,
  sampleCampaign,
  sampleMail,
  samplePlayer,
  sampleRecord,
  sampleSignedResult,
  sampleStandee,
  sampleTable,
} from "./samples";

// The interop formats (docs/protocols): what the app writes matches the
// published schemas, and the frozen fixtures in conformance/ keep reading in
// every later build. `WRITE_CONFORMANCE=1 pnpm vitest run src/protocols`
// writes fixtures for a new format or major version; never rewrite old ones.

const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};

/** Fresh samples from the app's writers, by format. */
async function samples(): Promise<Record<string, unknown>> {
  const ids = [await newIdentity(), await newIdentity()] as const;
  const manifest = readManifest(riftSource);
  const faction = readFactionPack(cinderCourt);
  if ("error" in manifest || "error" in faction) throw new Error("example packages don't read");
  return {
    army: sampleArmy(),
    table: sampleTable(),
    standee: sampleStandee(),
    record: sampleRecord(),
    campaign: sampleCampaign(),
    player: await samplePlayer(ids[0]),
    mail: await sampleMail(),
    "signed-result": await sampleSignedResult([ids[0], ids[1]]),
    manifest: manifest.manifest,
    faction: faction.pack,
  };
}

/** What the app's own reader says of a document: true if it takes it. */
const READERS: Record<string, (data: unknown) => boolean | Promise<boolean>> = {
  army: (d) => readArmy(d) !== null,
  table: (d) => readTable(d) !== null,
  standee: (d) => readStandee(new TextEncoder().encode(JSON.stringify(d))) !== null,
  record: (d) => {
    if (sharedKind(d) !== "replay") return false;
    stateAt(d as GameRecord); // replays to a state without throwing
    return true;
  },
  campaign: (d) => readCampaign(d) !== null,
  player: async (d) => (await readCardFile(d)) !== null,
  mail: async (d) => {
    const file = parseFile(JSON.stringify(d));
    return typeof file !== "string" && (await signatureOk(file as MailFile));
  },
  "signed-result": async (d) => (await checkSigned(d)) !== null,
  "army-list": (d) => isArmyList(d) && sharedKind(d) === "army",
};

/** Documents every reader must turn away: a newer major version, and the wrong type where a field is required. */
function invalids(name: string, data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (typeof data.format === "string")
    out["newer-major"] = { ...data, format: data.format.replace(/@\d+$/, "@2") };
  if (typeof data.v === "number") out["newer-major"] = { ...data, v: 2 };
  if (name === "signed-result") {
    const r = data as { result: Record<string, unknown> };
    out["newer-major"] = { ...data, result: { ...r.result, v: 2 } };
    out["no-signatures"] = { result: r.result };
  }
  if (name === "manifest") out["no-api"] = { ...data, api: "one" };
  return out;
}

describe("interop formats", () => {
  it("are written by the app exactly as their schemas say", async () => {
    for (const [name, data] of Object.entries(await samples()))
      expect(schemaErrors(name, 1, data), name).toEqual([]);
  }, 60_000);

  it.runIf(env.WRITE_CONFORMANCE)(
    "writes fixtures for formats that have none yet",
    async () => {
      const have = new Set(fixtures().map((f) => `${f.format}@${f.major}`));
      for (const [name, data] of Object.entries(await samples())) {
        if (have.has(`${name}@1`)) continue;
        await writeFixture(`${name}/v1/valid/sample.json`, data);
        for (const [bad, doc] of Object.entries(invalids(name, data as Record<string, unknown>)))
          await writeFixture(`${name}/v1/invalid/${bad}.json`, doc);
      }
    },
    60_000,
  );

  it("keep reading every frozen fixture, and turn away every invalid one", async () => {
    const all = fixtures();
    expect(all.length).toBeGreaterThan(10);
    for (const f of all) {
      const errors = schemaErrors(f.format, f.major, f.data);
      if (f.valid) expect(errors, f.file).toEqual([]);
      else expect(errors.length, `${f.file} should fail its schema`).toBeGreaterThan(0);
      const read = READERS[f.format];
      if (read) expect(await read(f.data), f.file).toBe(f.valid);
    }
  }, 60_000);
});
