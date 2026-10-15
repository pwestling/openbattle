import { test, expect } from "@playwright/test";
import { newGame } from "./screen-helpers.ts";

// Start page: a new game opens the table as host, with the invite link ready to copy.
test("a new game opens the table with its invite link", async ({ page }) => {
  await newGame(page);
  const link = await page.getByLabel("Invite link").inputValue();
  expect(link).toMatch(/^http/);
  expect(page.url()).toBe(link);
  await expect(page.getByRole("button", { name: "Copy link" })).toBeVisible();
});

// Arriving from a link: someone returning on the same browser goes straight back to their seat.
test("coming back to the link returns to the same table", async ({ page }) => {
  await newGame(page);
  const link = await page.getByLabel("Invite link").inputValue();
  await page.goto(link);
  await expect(page.getByLabel("The table")).toBeVisible();
  await expect(page.getByRole("button", { name: "Join" })).toHaveCount(0);
});

// Arriving from a link: a newcomer gives a name and colour and joins, or watches.
test("a newcomer is asked to join or watch", async ({ page, browser }) => {
  await newGame(page);
  const link = await page.getByLabel("Invite link").inputValue();
  const other = await (await browser.newContext()).newPage();
  await other.goto(link);
  await expect(other.getByRole("button", { name: "Watch" })).toBeVisible();
  await other.getByLabel("Your name").fill("Ben");
  await other.getByRole("button", { name: "Join" }).click();
  await expect(other.getByLabel("The table")).toBeVisible();
});

// Arriving from a link: a broken link goes to the start page with a message. Only the session can
// tell a broken link, so the person finds out when they try to join or watch.
test("a broken link goes to the start page with a message", async ({ page }) => {
  await page.goto("/?nonsense");
  await page.getByRole("button", { name: "Watch" }).click();
  await expect(page.getByRole("alert")).toContainText("doesn't lead to a game");
  await expect(page.getByRole("button", { name: "New game" })).toBeVisible();
});

// Connection banner: nothing while all is well; says when the host is away or the tables differ.
test("the banner shows the connection's trouble and offers the host's copy", async ({ page }) => {
  await newGame(page);
  await expect(page.getByRole("status")).toHaveCount(0);
  await page.evaluate(() => (window as any).openbattleFake.setConnection("host away"));
  await expect(page.getByRole("status")).toHaveText("Waiting for the host. The game is paused.");
  await page.evaluate(() => (window as any).openbattleFake.setConnection("connecting"));
  await expect(page.getByRole("status")).toHaveText("Connecting…");
  await page.evaluate(() => (window as any).openbattleFake.setConnection("playing"));
  await page.evaluate(() => (window as any).openbattleFake.setDisagreement(true));
  await expect(page.getByRole("status")).toContainText("Your table differs from the host's");
  await page.getByRole("button", { name: "Reload the host's copy" }).click();
  await expect(page.getByRole("status")).toHaveCount(0);
});
