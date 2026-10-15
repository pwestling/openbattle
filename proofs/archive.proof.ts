import { test, expect, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import type { Log } from "../src/record/index.ts";

// The Archive, driven through its public face only, in real Chromium (ADR-018).
// There is no screen yet, so a proof page loads src/archive/index.ts and the proofs call it.

const PAGE = "/proofs/pages/archive.html";

async function openArchive(page: Page): Promise<void> {
  await page.goto(PAGE);
  await expect(page.locator("body[data-ready=yes]")).toBeAttached();
}

// A small log: two players join and the first round starts.
const log: Log = {
  size: { width: 72, depth: 48 },
  link: "game-a",
  host: "ann",
  copied: 0,
  entries: [
    { n: 1, by: "ann", action: { kind: "join", name: "Ann", colour: "#c33", publicKey: "key-Ann" } },
    { n: 2, by: "bob", action: { kind: "join", name: "Bob", colour: "#33c", publicKey: "key-Bob" } },
    { n: 3, by: "ann", action: { kind: "phase", phase: { round: 1, turn: "ann", name: "Deploy" } } },
  ],
};

test("a saved game is still there after the tab closes, and saving again replaces it", async ({ context }) => {
  const first = await context.newPage();
  await openArchive(first);
  await first.evaluate((log) => window.archive.save("game-a", { log, me: "ann" }), log);
  await first.close();

  const second = await context.newPage();
  await openArchive(second);
  expect(await second.evaluate(() => window.archive.load("game-a"))).toEqual({ log, me: "ann" });

  const longer: Log = { ...log, entries: [...log.entries, { n: 4, by: "bob", action: { kind: "undo" } }] };
  await second.evaluate((longer) => window.archive.save("game-a", { log: longer, me: "watch" }), longer);
  await second.reload();
  await expect(second.locator("body[data-ready=yes]")).toBeAttached();
  expect(await second.evaluate(() => window.archive.load("game-a"))).toEqual({ log: longer, me: "watch" });
});

test("loading a game that was never saved, or whose stored data is unreadable, gives nothing", async ({ page }) => {
  await openArchive(page);
  expect(await page.evaluate(() => window.archive.load("never-saved"))).toBeNull();

  // Spoil what is stored for a link behind the archive's back, as a browser fault or old data might.
  await page.evaluate(() => window.archive.save("game-b", { log: { size: { width: 6, depth: 4 }, link: "game-b", host: "ann", copied: 0, entries: [] }, me: "ann" }));
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open("openbattle-archive");
        open.onsuccess = () => {
          const tx = open.result.transaction("games", "readwrite");
          tx.objectStore("games").put({ log: "garbled", me: 7 }, "game-b");
          tx.oncomplete = () => {
            open.result.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
  );
  expect(await page.evaluate(() => window.archive.load("game-b"))).toBeNull();
});

test("when the browser refuses storage, saving rejects and loading gives nothing", async ({ page }) => {
  await page.addInitScript(() => {
    IDBFactory.prototype.open = () => {
      throw new DOMException("The user denied permission to access the database.", "SecurityError");
    };
  });
  await openArchive(page);
  const saving = await page.evaluate(() =>
    window.archive.save("game-c", { log: { size: { width: 6, depth: 4 }, link: "game-c", host: "ann", copied: 0, entries: [] }, me: "ann" }).then(
      () => "saved",
      (error: Error) => `rejected: ${error.message}`,
    ),
  );
  expect(saving).toContain("rejected");
  expect(await page.evaluate(() => window.archive.load("game-c"))).toBeNull();
});

// The same pattern of bytes, made here and in the page, so the proof can fingerprint it independently.
function pattern(length: number, seed: number): Uint8Array {
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i++) bytes[i] = (i * 31 + seed) % 251;
  return bytes;
}

test("a kept file is found by the SHA-256 of its bytes after the tab closes", async ({ context }) => {
  const first = await context.newPage();
  await openArchive(first);
  const fingerprint = await first.evaluate(
    `window.archive.keepFile("game-d", new Blob([(${pattern})(100000, 7)], { type: "model/stl" }))`,
  );
  expect(fingerprint).toBe(createHash("sha256").update(pattern(100000, 7)).digest("hex"));
  await first.close();

  const second = await context.newPage();
  await openArchive(second);
  const back = await second.evaluate(async (fingerprint) => {
    const blob = await window.archive.getFile(fingerprint);
    return blob && { type: blob.type, bytes: Array.from(new Uint8Array(await blob.arrayBuffer())) };
  }, fingerprint as string);
  expect(back?.type).toBe("model/stl");
  expect(Uint8Array.from(back?.bytes ?? [])).toEqual(pattern(100000, 7));
  expect(await second.evaluate(() => window.archive.getFile("0".repeat(64)))).toBeNull();
});

test("the same bytes kept twice, even for two games, are stored once", async ({ page }) => {
  await openArchive(page);
  // The browser's usage figure can lag a write, so read it only once it has settled.
  const grew = await page.evaluate(`(async () => {
    const pattern = ${pattern};
    const used = async () => (await navigator.storage.estimate()).usage ?? 0;
    const settled = async () => {
      let last = await used();
      for (let i = 0; i < 50; i++) {
        await new Promise((r) => setTimeout(r, 200));
        const now = await used();
        if (now === last) return now;
        last = now;
      }
      return last;
    };
    const start = await settled();
    const a = await window.archive.keepFile("game-e", new Blob([pattern(20000000, 3)]));
    const b = await window.archive.keepFile("game-f", new Blob([pattern(20000000, 3)]));
    return { same: a === b, growth: (await settled()) - start };
  })()`);
  expect(grew).toMatchObject({ same: true });
  // Once is 20 MB and a bit; twice would be over 40 MB.
  const { growth } = grew as { growth: number };
  expect(growth).toBeGreaterThan(20000000);
  expect(growth).toBeLessThan(30000000);
});

test("when the browser refuses storage, keeping a file rejects", async ({ page }) => {
  await page.addInitScript(() => {
    IDBFactory.prototype.open = () => {
      throw new DOMException("The user denied permission to access the database.", "SecurityError");
    };
  });
  await openArchive(page);
  const keeping = await page.evaluate(() =>
    window.archive.keepFile("game-g", new Blob(["solid cube"])).then(
      () => "kept",
      (error: Error) => `rejected: ${error.message}`,
    ),
  );
  expect(keeping).toContain("rejected");
});

// A game that uses a terrain mesh, a model mesh and a card picture, and names one file this browser never kept.
function gameUsing(terrainMesh: string, modelMesh: string, picture: string): Log {
  const base = { shape: "round", width: 32, depth: 32 } as const;
  return {
    size: { width: 72, depth: 48 },
    link: "game-a",
    host: "ann",
    copied: 0,
    entries: [
      { n: 1, by: "ann", action: { kind: "join", name: "Ann", colour: "#c33", publicKey: "key-Ann" } },
      {
        n: 2,
        by: "ann",
        action: {
          kind: "place terrain",
          terrain: {
            id: "ruin",
            name: "Ruin",
            shape: { kind: "mesh", mesh: terrainMesh, width: 8, depth: 6, height: 4 },
            position: { x: 30, y: 20 },
            facing: 0,
            floors: [],
          },
        },
      },
      {
        n: 3,
        by: "ann",
        action: {
          kind: "add to army",
          units: [{ id: "u1", name: "Wardens" }],
          models: [
            { id: "m1", unit: "u1", name: "Warden", base, mesh: modelMesh, height: 1.2, position: { x: 2, y: 2 }, facing: 0, floor: null },
            { id: "m2", unit: "u1", name: "Warden", base, mesh: modelMesh, height: 1.2, position: { x: 3, y: 2 }, facing: 0, floor: null },
            { id: "m3", unit: "u1", name: "Lost", base, mesh: "f".repeat(64), height: 1.2, position: { x: 4, y: 2 }, facing: 0, floor: null },
          ],
          groups: [],
        },
      },
      {
        n: 4,
        by: "ann",
        action: {
          kind: "add deck",
          deck: "d1",
          name: "Orders",
          owner: "ann",
          order: "ordered",
          cards: [{ id: "c1", name: "Charge", picture }],
          position: { x: 70, y: 2 },
        },
      },
    ],
  };
}

/** Saves the game to a file in one browser and hands back its name and bytes, as a download would. */
async function saveToFile(page: Page): Promise<{ name: string; bytes: number[]; log: Log; files: Record<string, number[]> }> {
  return page.evaluate(`(async () => {
    const pattern = ${pattern};
    const gameUsing = ${gameUsing};
    const terrain = await window.archive.keepFile("game-h", new Blob([pattern(3000, 1)], { type: "model/gltf-binary" }));
    const model = await window.archive.keepFile("game-h", new Blob([pattern(2000, 2)], { type: "model/stl" }));
    const picture = await window.archive.keepFile("game-h", new Blob([pattern(500, 3)], { type: "image/png" }));
    const log = gameUsing(terrain, model, picture);
    const file = await window.archive.toFile("https://openbattle.example/#game-h", log);
    const bytes = Array.from(new Uint8Array(await file.arrayBuffer()));
    const files = {
      [terrain]: Array.from(pattern(3000, 1)),
      [model]: Array.from(pattern(2000, 2)),
      [picture]: Array.from(pattern(500, 3)),
    };
    return { name: file.name, bytes, log, files };
  })()`);
}

test("a game saved to a file opens in another browser with its log and every mesh and picture it uses", async ({ page, browser }) => {
  await openArchive(page);
  const saved = await saveToFile(page);
  expect(saved.name).toMatch(/^OpenBattle game-h \d{4}-\d{2}-\d{2}\.openbattle$/);

  // Another browser, with nothing kept, opens the file.
  const elsewhere = await browser.newContext();
  const other = await elsewhere.newPage();
  await openArchive(other);
  const opened = await other.evaluate(async ({ bytes, fingerprints }) => {
    const game = await window.archive.fromFile(new Blob([new Uint8Array(bytes)]));
    const files: Record<string, { type: string; bytes: number[] } | null> = {};
    for (const f of fingerprints) {
      const blob = await window.archive.getFile(f);
      files[f] = blob && { type: blob.type, bytes: Array.from(new Uint8Array(await blob.arrayBuffer())) };
    }
    return { game, files };
  }, { bytes: saved.bytes, fingerprints: [...Object.keys(saved.files), "f".repeat(64)] });

  expect(opened.game).toEqual({ link: "https://openbattle.example/#game-h", log: saved.log });
  const types = ["model/gltf-binary", "model/stl", "image/png"];
  Object.entries(saved.files).forEach(([fingerprint, bytes], i) => {
    expect(opened.files[fingerprint]).toEqual({ type: types[i], bytes });
  });
  expect(opened.files["f".repeat(64)]).toBeNull();
  await elsewhere.close();
});

test("opening a file that is not a saved game, is cut short, or came from a newer version is refused", async ({ page }) => {
  await openArchive(page);
  const saved = await saveToFile(page);
  const attempt = (bytes: number[]) =>
    page.evaluate(
      (bytes) =>
        window.archive.fromFile(new Blob([new Uint8Array(bytes)])).then(
          () => "opened",
          (error: Error) => error.message,
        ),
      bytes,
    );

  expect(await attempt(Array.from(new TextEncoder().encode("solid cube\nendsolid cube\n")))).toMatch(/not a saved OpenBattle game/);
  expect(await attempt(saved.bytes.slice(0, saved.bytes.length - 100))).toMatch(/cut short/);

  const version = Buffer.from(saved.bytes).indexOf('"version":1,');
  expect(version).toBeGreaterThan(0);
  const newer = [...saved.bytes];
  newer[version + '"version":'.length] = "2".charCodeAt(0);
  expect(await attempt(newer)).toMatch(/newer version of OpenBattle/);

  const spoiled = [...saved.bytes];
  spoiled[spoiled.length - 1] = (spoiled[spoiled.length - 1]! + 1) % 256;
  expect(await attempt(spoiled)).toMatch(/damaged/);
});

test("a damaged saved game leaves nothing kept behind", async ({ page, browser }) => {
  await openArchive(page);
  const saved = await saveToFile(page);
  const spoiled = [...saved.bytes];
  spoiled[spoiled.length - 1] = (spoiled[spoiled.length - 1]! + 1) % 256;

  const elsewhere = await browser.newContext();
  const other = await elsewhere.newPage();
  await openArchive(other);
  const result = await other.evaluate(async ({ bytes, fingerprints }) => {
    const opened = await window.archive.fromFile(new Blob([new Uint8Array(bytes)])).then(
      () => "opened",
      (error: Error) => error.message,
    );
    const kept = await Promise.all(fingerprints.map((f) => window.archive.getFile(f)));
    return { opened, kept: kept.filter(Boolean).length };
  }, { bytes: spoiled, fingerprints: Object.keys(saved.files) });
  expect(result.opened).toMatch(/damaged/);
  expect(result.kept).toBe(0);
  await elsewhere.close();
});

test("a saved file whose log holds entries that are not actions is refused", async ({ page }) => {
  await openArchive(page);
  const opened = await page.evaluate(async () => {
    const header = new TextEncoder().encode(
      JSON.stringify({ version: 1, link: "game-i", log: { size: { width: 6, depth: 4 }, entries: [{ n: 1 }] }, files: [] }),
    );
    const length = new Uint8Array(4);
    new DataView(length.buffer).setUint32(0, header.length);
    const file = new Blob([new TextEncoder().encode("OpenBattle game\n"), length, header]);
    return window.archive.fromFile(file).then(
      () => "opened",
      (error: Error) => error.message,
    );
  });
  expect(opened).toMatch(/damaged/);
});

test("in a browser that refuses storage, a saved file still opens", async ({ page, browser }) => {
  await openArchive(page);
  const saved = await saveToFile(page);

  const elsewhere = await browser.newContext();
  const other = await elsewhere.newPage();
  await other.addInitScript(() => {
    IDBFactory.prototype.open = () => {
      throw new DOMException("The user denied permission to access the database.", "SecurityError");
    };
  });
  await openArchive(other);
  const opened = await other.evaluate(
    (bytes) => window.archive.fromFile(new Blob([new Uint8Array(bytes)])),
    saved.bytes,
  );
  expect(opened).toEqual({ link: "https://openbattle.example/#game-h", log: saved.log });
  await elsewhere.close();
});

declare global {
  interface Window {
    archive: typeof import("../src/archive/index.ts");
  }
}
