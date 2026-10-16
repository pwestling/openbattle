// Steps the screen proofs share: what a person does to get to a table.
import { expect, type Browser, type Page } from "@playwright/test";

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
  await openLog(page);
}

/** Opens the log, which starts closed; does nothing if it is already open. */
export async function openLog(page: Page) {
  const button = page.getByRole("button", { name: "Log", exact: true });
  if ((await button.getAttribute("aria-pressed")) !== "true") await button.click();
  await expect(page.getByRole("region", { name: "Log" })).toBeVisible();
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

/** Someone else, in their own browser, joining a game from its link; resolves to their page at the table. */
export async function joinGame(browser: Browser, link: string, name: string, colour = "#2f6fd6"): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto(link);
  await page.getByLabel("Your name").fill(name);
  await page.getByRole("button", { name: `Colour ${colour}` }).click();
  await page.getByRole("button", { name: "Join" }).click();
  await expect(page.getByLabel("The table")).toBeVisible();
  await openLog(page);
  return page;
}

/**
 * A host's browser that breaks the rules when told to, as a modified copy of the app could
 * (proofs/pages/rogue-host.html), and the link to its game.
 */
export async function rogueHost(browser: Browser): Promise<{ rogue: Page; link: string }> {
  const rogue = await (await browser.newContext()).newPage();
  await rogue.goto("/proofs/pages/rogue-host.html");
  await rogue.waitForFunction(() => document.body.dataset.ready === "yes");
  return { rogue, link: await rogue.evaluate(() => (window as any).rogue.start()) };
}

/** The log this browser has kept of its game, as it would load it again. */
export async function keptLog(page: Page): Promise<any> {
  return page.evaluate(async () => {
    const path = "/src/archive/index.ts";
    const archive = await import(/* @vite-ignore */ path);
    const id = new URL(location.href).searchParams.get("game")!;
    return (await archive.load(id))?.log;
  });
}

/** The last action in the log this browser has kept, once it is one of the given kind. */
export async function lastKept(page: Page, kind: string): Promise<any> {
  let action: any;
  await expect
    .poll(async () => {
      action = (await keptLog(page))?.entries.at(-1)?.action;
      return action?.kind;
    })
    .toBe(kind);
  return action;
}
