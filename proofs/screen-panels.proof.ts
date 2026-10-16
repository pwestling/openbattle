import { test, expect } from "@playwright/test";
import { addArmy, joinGame, labels, newGame, rogueHost } from "./screen-helpers.ts";

// Army panel: paste a list to add units; the models stand on the table and the log says so.
test("a pasted army list puts its models on the table", async ({ page }) => {
  await newGame(page);
  await addArmy(page, '5x Scouts 25mm\nCaptain 40mm 1.5"');
  await expect(page.getByRole("region", { name: "Log" })).toContainText("Ana added Scouts (5 models) and Captain");
  await expect(labels(page, "Scouts")).toHaveCount(5);
  await expect(labels(page, "Captain")).toHaveCount(1);
  // The list is read in a dialog the top bar opens, which closes once the army is added.
  await expect(page.getByRole("dialog", { name: "Add to your army" })).toHaveCount(0);
  // More models for an existing unit join it, at any point in the game.
  await addArmy(page, "2x Scouts");
  await expect(labels(page, "Scouts")).toHaveCount(7);
  await expect(page.getByRole("article", { name: "Scouts" })).toContainText("7 models");
});

// Army panel: counters with + and −, marks toggled, models set aside and returned, units grouped.
test("counters, marks, setting aside and groups", async ({ browser }) => {
  // Ben plays from his own browser, so every click goes to the host and back.
  const { rogue, link } = await rogueHost(browser);
  const page = await joinGame(browser, link, "Ben");
  await addArmy(page, "5x Scouts\nCaptain 40mm");
  const scouts = page.getByRole("article", { name: "Scouts" });
  await scouts.getByTitle("Add a counter or mark").click();
  await scouts.getByLabel("Counter or mark name").fill("Wounds");
  await scouts.getByRole("button", { name: "Add counter" }).click();
  // Quick clicks build on each other, even over a slow connection while someone else's change
  // arrives between them.
  await rogue.evaluate(() => ((window as any).rogue.delay = 400));
  const raise = scouts.getByRole("button", { name: "Raise Wounds" });
  await raise.click();
  await raise.click();
  await joinGame(browser, link, "Bo", "#2e9e55");
  await raise.click();
  await raise.click();
  await raise.click();
  await scouts.getByRole("button", { name: "Lower Wounds" }).click();
  await expect(scouts.getByLabel("Wounds counter")).toContainText("4");
  await rogue.evaluate(() => ((window as any).rogue.delay = 0));
  await expect(page.getByRole("region", { name: "Log" }).locator("li").last()).toContainText("Ben set Scouts’ Wounds to 4");

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
  await expect(page.getByRole("region", { name: "Log" })).toContainText("Ben grouped Scouts and Captain as Vanguard");
});

// Phase bar: round, whose turn and phase name can each be changed.
test("the phase bar changes round, turn and phase", async ({ browser }) => {
  // Ben changes it from his own browser, over a slow connection.
  const { rogue, link } = await rogueHost(browser);
  const page = await joinGame(browser, link, "Ben");
  const phase = page.getByRole("group", { name: "Phase" });
  await rogue.evaluate(() => ((window as any).rogue.delay = 400));
  await phase.getByRole("button", { name: "Next round" }).click();
  await phase.getByRole("button", { name: "Next round" }).click();
  await phase.getByRole("button", { name: "Next round" }).click();
  await phase.getByRole("button", { name: "Previous round" }).click();
  // A game starts at round 0, before its first round.
  await expect(phase.getByLabel("Round", { exact: true })).toHaveText("2");
  await phase.getByRole("combobox").selectOption({ label: "Ben" });
  await phase.getByLabel("Phase name").fill("Shooting");
  await phase.getByLabel("Phase name").press("Enter");
  await expect(page.getByRole("region", { name: "Log" })).toContainText("Ben set round 2, Ben’s turn, Shooting");
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
test("a saved file opens again from the start page", async ({ page, browser }) => {
  await newGame(page);
  await addArmy(page, "4x Scouts");
  const original = await page.getByLabel("Invite link").inputValue();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save" }).click();
  const file = await (await download).path();

  // In another browser, which has kept nothing, the file alone brings the game back.
  const other = await browser.newPage();
  await other.goto("/");
  await other.getByLabel("Your name").fill("Ana");
  await other.getByLabel("Choose a saved game file").setInputFiles(file);
  await expect(other.getByLabel("The table")).toBeVisible();
  await expect(labels(other, "Scouts")).toHaveCount(4);
  await other.close();

  // Here, after playing on, opening the file starts a new game and leaves the one played on alone.
  await addArmy(page, "Captain 40mm");
  await expect(labels(page, "Captain")).toHaveCount(1);
  await page.goto("/");
  await page.getByLabel("Choose a saved game file").setInputFiles(file);
  await expect(labels(page, "Scouts")).toHaveCount(4);
  await expect(labels(page, "Captain")).toHaveCount(0);
  await expect(page.getByLabel("Invite link")).not.toHaveValue(original);
  await page.goto(original);
  await expect(labels(page, "Captain")).toHaveCount(1);
});
