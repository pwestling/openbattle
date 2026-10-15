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

/** The labels drawn over the table whose text is exactly this. */
export const labels = (page: Page, text: string) => page.locator(".table-labels .label", { hasText: new RegExp(`^${text}$`) });

/** Adds units to your army from a typed list. */
export async function addArmy(page: Page, list: string) {
  await page.getByLabel("Army list").fill(list);
  await page.getByRole("button", { name: "Read list" }).click();
  await page.getByRole("button", { name: "Add to army" }).click();
}

/** The centre of something on screen. */
export async function centre(locator: ReturnType<Page["locator"]>) {
  const box = (await locator.boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Waits until the table has drawn the latest camera move, so labels are where the pieces are. */
export async function drawn(page: Page) {
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
}
