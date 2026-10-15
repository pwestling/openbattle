import { test, expect, type Page } from "@playwright/test";
import { newGame } from "./screen-helpers.ts";

const rolls = (page: Page) => page.getByRole("list", { name: "Recent rolls" }).locator("li");

// Dice tray: dice land on the decided result, then line up sorted; the roll stays in the tray and the log.
test("rolled dice land on the result and stay in the tray", async ({ page }) => {
  await newGame(page);
  const tray = page.getByRole("region", { name: "Dice tray" });
  await tray.getByLabel("Dice").fill("3");
  await tray.getByLabel("Label").fill("Attack");
  await tray.getByRole("button", { name: "Roll" }).click();
  await expect(rolls(page).first()).toContainText("Ana · 3d6 · Attack");
  const shown = (await rolls(page).first().locator(".result").textContent())!.split(" ").map(Number);
  expect(shown).toHaveLength(3);
  expect(shown).toEqual([...shown].sort((a, b) => a - b));
  for (const v of shown) (expect(v).toBeGreaterThanOrEqual(1), expect(v).toBeLessThanOrEqual(6));
  const logged = (await page.getByRole("region", { name: "Log" }).locator("li").last().textContent())!;
  expect(logged).toContain("Ana rolled 3d6 for Attack: ");
  const fromLog = /: ([\d, ]+)/.exec(logged)![1]!.split(", ").map(Number);
  expect([...fromLog].sort((a, b) => a - b)).toEqual(shown);

  // Other dice than six-sided ones.
  await tray.getByLabel("Dice").fill("1");
  await tray.getByLabel("Sides").fill("20");
  await tray.getByLabel("Label").fill("");
  await tray.getByRole("button", { name: "Roll" }).click();
  await expect(rolls(page).first()).toContainText("Ana · 1d20");
  await expect(rolls(page)).toHaveCount(2);
});

// Dice tray: the largest roll Session allows lands, twice over, without losing the tray's graphics.
test("a roll of 1024 dice lands, and the next one too", async ({ page }) => {
  await newGame(page);
  const tray = page.getByRole("region", { name: "Dice tray" });
  await tray.getByLabel("Dice").fill("1024");
  for (const n of [1, 2]) {
    await tray.getByRole("button", { name: "Roll" }).click();
    await expect(rolls(page)).toHaveCount(n, { timeout: 15000 });
    await expect(rolls(page).first().locator(".result")).toHaveText(/^\d+( \d+){1023}$/);
  }
  const lost = await page.evaluate(() =>
    (document.querySelector("canvas.tray") as HTMLCanvasElement).getContext("webgl2")?.isContextLost(),
  );
  expect(lost).toBe(false);
});

// Dice tray: a tampered roll is shown in red with a warning.
test("a tampered roll is shown with a warning", async ({ page }) => {
  await newGame(page);
  await page.evaluate(() => (window as any).openbattleFake.tamperNext());
  await page.getByRole("region", { name: "Dice tray" }).getByRole("button", { name: "Roll" }).click();
  await expect(rolls(page).first()).toHaveClass(/tampered/);
  await expect(rolls(page).first().getByRole("alert")).toContainText("tampered");
  await expect(page.getByRole("region", { name: "Log" })).toContainText("(tampered!)");
});
