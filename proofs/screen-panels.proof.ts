import { test, expect } from "@playwright/test";
import { addArmy, labels, newGame } from "./screen-helpers.ts";

// Army panel: paste a list to add units; the models stand on the table and the log says so.
test("a pasted army list puts its models on the table", async ({ page }) => {
  await newGame(page);
  await addArmy(page, '5x Scouts 25mm\nCaptain 40mm 1.5"');
  await expect(page.getByRole("region", { name: "Log" })).toContainText("Ana added Scouts (5 models) and Captain");
  await expect(labels(page, "Scouts")).toHaveCount(5);
  await expect(labels(page, "Captain")).toHaveCount(1);
  // More models for an existing unit join it, at any point in the game.
  await addArmy(page, "2x Scouts");
  await expect(labels(page, "Scouts")).toHaveCount(7);
  await expect(page.getByRole("article", { name: "Scouts" })).toContainText("7 models");
});

// Army panel: counters with + and −, marks toggled, models set aside and returned, units grouped.
test("counters, marks, setting aside and groups", async ({ page }) => {
  await newGame(page);
  await addArmy(page, "5x Scouts\nCaptain 40mm");
  const scouts = page.getByRole("article", { name: "Scouts" });
  await scouts.getByTitle("Add a counter or mark").click();
  await scouts.getByLabel("Counter or mark name").fill("Wounds");
  await scouts.getByRole("button", { name: "Add counter" }).click();
  await scouts.getByRole("button", { name: "Raise Wounds" }).click();
  await scouts.getByRole("button", { name: "Raise Wounds" }).click();
  await expect(scouts.getByLabel("Wounds counter")).toContainText("2");
  await expect(page.getByRole("region", { name: "Log" })).toContainText("Ana set Scouts’ Wounds to 2");

  await scouts.getByTitle("Add a counter or mark").click();
  await scouts.getByLabel("Counter or mark name").fill("Activated");
  await scouts.getByRole("button", { name: "Add mark" }).click();
  await expect(scouts.getByRole("button", { name: "Activated" })).toHaveAttribute("aria-pressed", "true");
  await scouts.getByRole("button", { name: "Activated" }).click();
  await expect(scouts.getByRole("button", { name: "Activated" })).toHaveCount(0);

  await scouts.getByRole("button", { name: "Set aside" }).click();
  await expect(labels(page, "Scouts")).toHaveCount(0);
  await expect(scouts).toContainText("5 set aside");
  await scouts.getByRole("button", { name: "Return" }).click();
  await expect(labels(page, "Scouts")).toHaveCount(5);

  await page.getByText("Make a group").click();
  await page.getByRole("checkbox", { name: "Scouts" }).check();
  await page.getByRole("checkbox", { name: "Captain" }).check();
  await page.getByLabel("Group name").fill("Vanguard");
  await page.getByRole("button", { name: "Group", exact: true }).click();
  await expect(page.getByRole("article", { name: "Vanguard" })).toContainText("Scouts, Captain");
  await expect(page.getByRole("region", { name: "Log" })).toContainText("Ana grouped Scouts and Captain as Vanguard");
});

// Phase bar: round, whose turn and phase name can each be changed.
test("the phase bar changes round, turn and phase", async ({ page }) => {
  await newGame(page);
  const phase = page.getByRole("group", { name: "Phase" });
  await phase.getByRole("button", { name: "Next round" }).click();
  await expect(phase.getByLabel("Round", { exact: true })).toHaveText("2");
  await phase.getByRole("combobox").selectOption({ label: "Ana" });
  await phase.getByLabel("Phase name").fill("Shooting");
  await phase.getByLabel("Phase name").press("Enter");
  await expect(page.getByRole("region", { name: "Log" })).toContainText("Ana set round 2, Ana’s turn, Shooting");
});

// Log: undo beside your own latest action; the slider shows an earlier moment, read-only, until you return.
test("undo and looking back through the log", async ({ page }) => {
  await newGame(page);
  await addArmy(page, "3x Scouts");
  await expect(labels(page, "Scouts")).toHaveCount(3);
  const log = page.getByRole("region", { name: "Log" });
  await log.getByRole("button", { name: "Undo" }).click();
  await expect(labels(page, "Scouts")).toHaveCount(0);
  await expect(log.locator("li.cancelled")).toContainText("Ana added Scouts");

  await addArmy(page, "2x Riders 50mm");
  await expect(labels(page, "Riders")).toHaveCount(2);
  await log.getByLabel("Look back").fill("1");
  await expect(log).toContainText("Showing the table after action 1");
  await expect(labels(page, "Riders")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Add to army" })).toHaveCount(0);
  await log.getByRole("button", { name: "Back to now" }).click();
  await expect(labels(page, "Riders")).toHaveCount(2);
});

// Save: the game saves to a file, which opens again from the start page as a new game.
test("a saved file opens again from the start page", async ({ page }) => {
  await newGame(page);
  await addArmy(page, "4x Scouts");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save" }).click();
  const file = await (await download).path();
  await page.goto("/");
  await page.getByLabel("Choose a saved game file").setInputFiles(file);
  await expect(page.getByLabel("The table")).toBeVisible();
  await expect(labels(page, "Scouts")).toHaveCount(4);
});
