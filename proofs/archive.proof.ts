import { test, expect, type Page } from "@playwright/test";
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

declare global {
  interface Window {
    archive: typeof import("../src/archive/index.ts");
  }
}
