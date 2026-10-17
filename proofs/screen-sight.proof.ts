import { test, expect, type Page } from "@playwright/test";
import { addArmy, centre, drawn, joinGame, labels, newGame, rogueHost } from "./screen-helpers.ts";

// The Sight gesture (ADR-028): hold V with models selected and point at a model or a spot. Lines
// show who sees it and how much; the pieces in the way are named in red. Private: nothing is sent.

const log = (page: Page) => page.getByRole("region", { name: "Log" }).locator("li");
const shown = (page: Page) => page.locator(".label.distance");

async function lookDown(page: Page) {
  await page.getByLabel("The table").focus();
  await page.keyboard.press("t");
  await drawn(page);
}

test("holding V shows what the selected models can see, and what is in the way", async ({ page }) => {
  await newGame(page);
  await page.getByRole("tab", { name: "Terrain" }).click();
  await page.getByRole("button", { name: "Add terrain" }).click();
  await expect(log(page).last()).toContainText("Ana placed Box");
  await page.getByRole("tab", { name: "Army" }).click();
  await addArmy(page, "Scout 25mm\nGrunt 25mm\nLookout 25mm");
  await lookDown(page);

  // Grunt goes behind the 3″ box, as seen from Scout.
  const scout = await centre(labels(page, "Scout"));
  const box = await centre(labels(page, "Box"));
  const grunt = await centre(labels(page, "Grunt"));
  const behind = { x: box.x + 0.6 * (box.x - scout.x), y: box.y + 0.6 * (box.y - scout.y) };
  await page.mouse.move(grunt.x, grunt.y);
  await page.mouse.down();
  await page.mouse.move(behind.x, behind.y, { steps: 10 });
  await page.mouse.up();
  await expect(log(page).last()).toContainText("Ana moved Grunt");
  await drawn(page);
  const actions = await log(page).count();

  // Scout, selected, looks at a spot of open ground beside it, then at Grunt behind the box.
  await page.mouse.click(scout.x, scout.y);
  await page.mouse.move(scout.x + 60, scout.y);
  await page.keyboard.down("v");
  await expect(shown(page)).toHaveText("Sees 100%");
  const there = await centre(labels(page, "Grunt"));
  await page.mouse.move(there.x, there.y, { steps: 5 });
  await expect(shown(page)).toHaveText("Can't see");
  await expect(labels(page, "Box")).toHaveClass(/hiding/);

  // Clicking the box leaves it out of the way until V is let go.
  await page.mouse.click(box.x, box.y);
  await page.mouse.move(there.x, there.y);
  await expect(shown(page)).toHaveText("Sees 100%");
  await expect(labels(page, "Box")).not.toHaveClass(/hiding/);
  await page.keyboard.up("v");
  await expect(shown(page)).toHaveCount(0);

  // Pressed again, the box counts once more.
  await page.keyboard.down("v");
  await page.mouse.move(there.x + 1, there.y);
  await expect(shown(page)).toHaveText("Can't see");
  await page.keyboard.up("v");
  await expect(labels(page, "Box")).not.toHaveClass(/hiding/);

  // Several models selected: the label counts those that see.
  const lookout = await centre(labels(page, "Lookout"));
  await page.mouse.click(lookout.x, lookout.y);
  await page.keyboard.down("Shift");
  await page.mouse.click(scout.x, scout.y);
  await page.keyboard.up("Shift");
  await page.keyboard.down("v");
  await page.mouse.move(scout.x + 30, scout.y - 60, { steps: 3 });
  await expect(shown(page)).toHaveText("2 of 2 see");
  await page.keyboard.up("v");

  // From Scout's own edge, the near side of the box is a spot Scout can see, not the table behind it.
  await page.mouse.click(scout.x, scout.y);
  await page.keyboard.press("h");
  await drawn(page);
  const side = await centre(labels(page, "Box"));
  await page.keyboard.down("v");
  await page.mouse.move(side.x, side.y + 40, { steps: 3 });
  await expect(shown(page)).toHaveText("Sees 100%");
  await page.keyboard.up("v");

  // Looking sends nothing and changes nothing.
  await expect(log(page)).toHaveCount(actions);
});

test("holding Shift with V leaves models out of the way", async ({ page }) => {
  await newGame(page);
  await addArmy(page, "Scout 25mm\nWall 100mm 3\"\nGrunt 25mm");
  await lookDown(page);
  // A tall, wide model stands between Scout and Grunt.
  const scout = await centre(labels(page, "Scout"));
  const wall = await centre(labels(page, "Wall"));
  const grunt = await centre(labels(page, "Grunt"));
  const ahead = { x: scout.x, y: scout.y - 120 };
  const beyond = { x: scout.x, y: scout.y - 240 };
  for (const [from, to] of [
    [wall, ahead],
    [grunt, beyond],
  ] as const) {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 10 });
    await page.mouse.up();
    await drawn(page);
  }
  await expect(log(page).last()).toContainText("Ana moved Grunt");

  await page.mouse.click(scout.x, scout.y);
  const there = await centre(labels(page, "Grunt"));
  await page.mouse.move(there.x, there.y, { steps: 5 });
  await page.keyboard.down("v");
  await expect(shown(page)).toHaveText("Can't see");
  await expect(labels(page, "Wall")).toHaveClass(/hiding/);
  await page.keyboard.down("Shift");
  await expect(shown(page)).toHaveText("Sees 100%");
  await page.keyboard.up("Shift");
  await expect(shown(page)).toHaveText("Can't see");
  await page.keyboard.up("v");
});

test("until every mesh on the table has reached this browser, sight names the pieces still missing", async ({ browser }) => {
  // The host places a mesh piece and holds its file back, then sends it.
  const { rogue, link } = await rogueHost(browser);
  const page = await joinGame(browser, link, "Ben");
  const obj = "v 0 0 0\nv 1 0 0\nv 1 1 0\nv 0 1 0\nf 1 2 3\nf 1 3 4\n";
  const mesh = await rogue.evaluate(async (obj) => {
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(obj)));
    const mesh = Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("");
    const shape = { kind: "mesh", mesh, width: 3, depth: 0.2, height: 3 };
    (window as any).rogue.act({ kind: "place terrain", terrain: { id: "ruin", name: "Ruin", shape, position: { x: 50, y: 40 }, facing: 0, floors: [] } });
    return mesh;
  }, obj);
  await expect(labels(page, "Ruin")).toHaveClass(/missing/);
  await addArmy(page, "Scout 25mm");
  await lookDown(page);
  const scout = await centre(labels(page, "Scout"));
  await page.mouse.click(scout.x, scout.y);
  await page.mouse.move(scout.x + 60, scout.y);
  await page.keyboard.down("v");
  await expect(shown(page)).toHaveText("Waiting for Ruin");
  await rogue.evaluate(([mesh, obj]) => (window as any).rogue.sendFile(mesh, obj), [mesh, obj]);
  await page.mouse.move(scout.x + 61, scout.y);
  await expect(async () => {
    await page.mouse.move(scout.x + 60 + Math.random(), scout.y);
    await expect(shown(page)).toHaveText("Sees 100%", { timeout: 500 });
  }).toPass({ timeout: 10000 });
  await page.keyboard.up("v");
});
