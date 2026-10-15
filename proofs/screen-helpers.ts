// Steps the screen proofs share: what a person does to get to a table.
import { expect, type Page } from "@playwright/test";

/** Opens a new game from the start page as the given player, and waits for the table. */
export async function newGame(page: Page, name = "Ana", size?: { width: number; depth: number }) {
  await page.goto("/");
  await page.getByLabel("Your name").fill(name);
  if (size) {
    await page.getByLabel("Table width (inches)").fill(String(size.width));
    await page.getByLabel("Table depth (inches)").fill(String(size.depth));
  }
  await page.getByRole("button", { name: "New game" }).click();
  await expect(page.getByLabel("The table")).toBeVisible();
}
