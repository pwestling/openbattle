import { test, expect, type Page } from "@playwright/test";
import { joinGame, newGame, rogueHost } from "./screen-helpers.ts";

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

// Dice tray: a roll the host makes with nobody else connected is marked "rolled alone" (ADR-023),
// in the tray and the log, and is not shown as tampered; with another player connected it isn't marked.
test("a roll made alone is marked as such", async ({ page, browser }) => {
  await newGame(page);
  const tray = page.getByRole("region", { name: "Dice tray" });
  await tray.getByRole("button", { name: "Roll" }).click();
  await expect(rolls(page).first()).toContainText("Rolled alone");
  await expect(rolls(page).first()).toHaveClass(/alone/);
  await expect(rolls(page).first()).not.toHaveClass(/tampered/);
  const log = page.getByRole("region", { name: "Log" }).locator("li");
  await expect(log.last()).toContainText("(rolled alone)");
  await expect(log.last()).toHaveClass(/alone/);

  // A saved game opened again still shows the roll as taken alone.
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save" }).click();
  const file = await (await download).path();
  await page.goto("/");
  await page.getByLabel("Your name").fill("Ana");
  await page.getByLabel("Choose a saved game file").setInputFiles(file);
  await expect(page.getByLabel("The table")).toBeVisible();
  await expect(rolls(page).first()).toContainText("Rolled alone");
  await expect(log.first()).toBeVisible();
  await expect(log.filter({ hasText: "(rolled alone)" })).toHaveCount(1);

  // Bo joins from his own browser; with him connected, Ana's roll is shared, not alone.
  await joinGame(browser, await page.getByLabel("Invite link").inputValue(), "Bo");
  await tray.getByRole("button", { name: "Roll" }).click();
  await expect(rolls(page)).toHaveCount(2);
  await expect(rolls(page).first()).not.toContainText("Rolled alone");
  await expect(log.last()).not.toContainText("alone");
});

// Dice tray: a tampered roll is shown in red with a warning, in the tray and the log. Taken alone too,
// it shows both marks, in tampered red.
test("a tampered roll is shown with a warning", async ({ browser }) => {
  // Only a host that breaks the rules can make one: here it rolls alone with a seal its value doesn't open.
  const { rogue, link } = await rogueHost(browser);
  const page = await joinGame(browser, link, "Ben");
  await rogue.evaluate(() => (window as any).rogue.rollAlone(true));
  await expect(rolls(page).first()).toHaveClass(/tampered/);
  await expect(rolls(page).first().getByRole("alert")).toContainText("tampered");
  await expect(rolls(page).first()).toContainText("Rolled alone");
  await expect(rolls(page).first()).toHaveCSS("color", "rgb(229, 83, 75)");
  const logged = page.getByRole("region", { name: "Log" }).locator("li").last();
  await expect(logged).toContainText("(tampered!)");
  await expect(logged).toContainText("(rolled alone)");
  await expect(logged.getByRole("alert")).toContainText("This roll was tampered with");
  await expect(logged).toHaveCSS("color", "rgb(229, 83, 75)");
});
