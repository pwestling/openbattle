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
  entries: [
    { n: 1, by: "ann", action: { kind: "join", name: "Ann", colour: "#c33" } },
    { n: 2, by: "bob", action: { kind: "join", name: "Bob", colour: "#33c" } },
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
  await page.evaluate(() => window.archive.save("game-b", { log: { size: { width: 6, depth: 4 }, entries: [] }, me: "ann" }));
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
    window.archive.save("game-c", { log: { size: { width: 6, depth: 4 }, entries: [] }, me: "ann" }).then(
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
  const grew = await page.evaluate(`(async () => {
    const pattern = ${pattern};
    const used = async () => (await navigator.storage.estimate()).usage ?? 0;
    const start = await used();
    const a = await window.archive.keepFile("game-e", new Blob([pattern(20000000, 3)]));
    const once = await used();
    const b = await window.archive.keepFile("game-f", new Blob([pattern(20000000, 3)]));
    const twice = await used();
    return { same: a === b, first: once - start, second: twice - once };
  })()`);
  expect(grew).toMatchObject({ same: true });
  const { first, second } = grew as { first: number; second: number };
  expect(first).toBeGreaterThan(20000000);
  expect(second).toBeLessThan(1000000);
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

declare global {
  interface Window {
    archive: typeof import("../src/archive/index.ts");
  }
}
