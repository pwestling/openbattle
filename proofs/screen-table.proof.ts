import { test, expect, type Page } from "@playwright/test";
import { addArmy, centre, labels, newGame } from "./screen-helpers.ts";

const log = (page: Page) => page.getByRole("region", { name: "Log" }).locator("li");
const inchesIn = (text: string) => Number(/([\d.]+)″/.exec(text)![1]);

/** Looks straight down, so that a distance on screen is the same everywhere on the table. */
async function lookDown(page: Page) {
  await page.getByLabel("The table").focus();
  await page.keyboard.press("t");
  await page.waitForTimeout(300);
}

/** Drags from a point by an offset, pressing keys partway, and returns the distance shown while carrying. */
async function drag(page: Page, from: { x: number; y: number }, legs: { dx: number; dy: number }[], between?: string) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  let at = from;
  for (const [i, leg] of legs.entries()) {
    at = { x: at.x + leg.dx, y: at.y + leg.dy };
    await page.mouse.move(at.x, at.y, { steps: 8 });
    if (between && i < legs.length - 1) await page.keyboard.press(between);
  }
  const shown = await page
    .locator(".label.distance")
    .first()
    .textContent({ timeout: 2000 })
    .catch(() => null);
  await page.mouse.up();
  return shown;
}

// Picking up: dragging carries the model, the distance shows live, and letting go is one move.
// Carrying with a waypoint measures the path along its true length.
test("carrying a model measures the move, along a path with corners", async ({ page }) => {
  await newGame(page);
  await addArmy(page, "Captain 40mm");
  await lookDown(page);
  const before = await centre(labels(page, "Captain"));
  const shown = await drag(page, before, [{ dx: 160, dy: 0 }]);
  await expect(log(page).last()).toContainText("Ana moved Captain");
  const straight = inchesIn((await log(page).last().textContent())!);
  expect(straight).toBeGreaterThan(1);
  expect(inchesIn(shown!)).toBe(straight);
  const after = await centre(labels(page, "Captain"));
  expect(after.x - before.x).toBeGreaterThan(140);

  // The same distance again, then the same again at a right angle, with a waypoint at the corner.
  await drag(
    page,
    after,
    [
      { dx: 160, dy: 0 },
      { dx: 0, dy: 160 },
    ],
    "Space",
  );
  await expect(log(page)).toHaveCount(4);
  expect(inchesIn((await log(page).last().textContent())!)).toBeCloseTo(2 * straight, 0);
});

// Picking up: click selects, a second click selects the whole unit, and dragging carries it all,
// keeping its shape.
test("a whole unit is selected and carried together", async ({ page }) => {
  await newGame(page);
  await addArmy(page, "5x Scouts 25mm");
  await lookDown(page);
  const scout = labels(page, "Scouts").nth(2);
  const at = await centre(scout);
  await page.mouse.click(at.x, at.y);
  await expect(page.locator(".label.selected")).toHaveCount(1);
  await page.mouse.click(at.x, at.y);
  await expect(page.locator(".label.selected")).toHaveCount(5);
  const before = await Promise.all([0, 1, 2, 3, 4].map((i) => centre(labels(page, "Scouts").nth(i))));
  await drag(page, before[2]!, [{ dx: 0, dy: -120 }]);
  await expect(log(page).last()).toContainText("Ana moved Scouts");
  const after = await Promise.all([0, 1, 2, 3, 4].map((i) => centre(labels(page, "Scouts").nth(i))));
  for (const [i, a] of after.entries()) {
    expect(a.y - before[i]!.y).toBeLessThan(-100);
    expect(Math.abs(a.x - before[i]!.x)).toBeLessThan(3);
  }
  // Clicking the empty table clears the selection; a box drawn around models selects them.
  await page.mouse.click(after[0]!.x, after[0]!.y + 150);
  await expect(page.locator(".label.selected")).toHaveCount(0);
  const xs = after.map((a) => a.x);
  await page.mouse.move(Math.min(...xs) - 30, after[0]!.y - 40);
  await page.mouse.down();
  await page.mouse.move(Math.max(...xs) + 30, after[0]!.y + 40, { steps: 5 });
  await page.mouse.up();
  await expect(page.locator(".label.selected")).toHaveCount(5);
});

// Picking up, fails: a refused move settles back where it was, with a short note saying why.
test("a refused move settles back with a note", async ({ page }) => {
  await newGame(page);
  await addArmy(page, "Captain 40mm");
  await lookDown(page);
  const before = await centre(labels(page, "Captain"));
  await page.evaluate(() => (window as any).openbattleFake.refuseNext("The host is away."));
  await drag(page, before, [{ dx: 150, dy: 0 }]);
  await expect(page.getByRole("alert")).toHaveText("The host is away.");
  await expect.poll(async () => Math.abs((await centre(labels(page, "Captain"))).x - before.x)).toBeLessThan(3);
  await expect(log(page)).toHaveCount(2);
});

// Ruler and camera: measuring shows inches across and sends nothing; the camera and selection
// never become actions.
test("the ruler measures privately, and looking around sends nothing", async ({ page }) => {
  await newGame(page);
  await addArmy(page, "Captain 40mm");
  await lookDown(page);
  const start = await centre(labels(page, "Captain"));
  const shown = await drag(page, start, [{ dx: 160, dy: 0 }]);
  await expect(log(page)).toHaveCount(3);
  const moved = inchesIn(shown!);

  // The same length on the empty table, with the ruler.
  const from = { x: start.x, y: start.y - 120 };
  await page.keyboard.down("Tab");
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 160, from.y, { steps: 8 });
  await expect(page.locator(".label.distance")).toHaveText(`${moved}″`);
  await page.mouse.up();
  await page.keyboard.up("Tab");
  await expect(page.locator(".label.distance")).toHaveCount(0);

  const table = page.getByLabel("The table");
  const box = (await table.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down({ button: "right" });
  await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2 + 40, { steps: 5 });
  await page.mouse.up({ button: "right" });
  await page.mouse.wheel(0, 300);
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("h");
  const captain = await centre(labels(page, "Captain"));
  await page.mouse.click(captain.x, captain.y);
  await expect(page.locator(".label.selected")).toHaveCount(1);
  await expect(log(page)).toHaveCount(3);
});
