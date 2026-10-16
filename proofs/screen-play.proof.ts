// A first game as two people would play it, each in their own browser: armies on the table,
// models moved, dice rolled, the page reloaded mid-game. Run as in current Chrome, whose
// scrollIntoView returns a promise (the log panel once crashed on it, turning the screen black).
import { test, expect, type Browser, type Page } from "@playwright/test";
import { centre, drawn, labels, newGame } from "./screen-helpers.ts";

const log = (page: Page) => page.getByRole("region", { name: "Log" }).locator("li");

/** A browser like current Chrome, where scroll methods return a promise. */
async function currentChrome(browser: Browser): Promise<Page> {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    const scroll = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function (this: Element, ...args: Parameters<Element["scrollIntoView"]>) {
      scroll.apply(this, args);
      return Promise.resolve() as unknown as void;
    };
  });
  return context.newPage();
}

async function addList(page: Page, list: string) {
  await page.getByLabel("Army list").fill(list);
  await page.getByRole("button", { name: "Read list" }).click();
  await page.getByRole("button", { name: "Add to army" }).click();
}

/** Drags a model by its label a distance across the screen. */
async function carry(page: Page, name: string, by: { dx: number; dy: number }, nth = 0) {
  await drawn(page);
  const from = await centre(labels(page, name).nth(nth));
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + by.dx, from.y + by.dy, { steps: 10 });
  await page.mouse.up();
}

test("two players add armies, move models and roll dice, through a reload", async ({ browser }) => {
  const ana = await currentChrome(browser);
  await newGame(ana, "Ana");
  const link = await ana.getByLabel("Invite link").inputValue();
  const ben = await currentChrome(browser);
  await ben.goto(link);
  await ben.getByLabel("Your name").fill("Ben");
  await ben.getByRole("button", { name: "Join" }).click();
  await expect(ben.getByLabel("The table")).toBeVisible();

  // A roll before anything is on the table, then armies added twice over.
  await ana.getByRole("button", { name: "Roll" }).click();
  await expect(log(ben).last()).toContainText("Ana rolled 2d6");
  await addList(ana, "5x Scouts 25mm");
  await addList(ana, "Scouts");
  await addList(ben, "3x Bikers 60x35mm oval");
  for (const page of [ana, ben]) {
    await expect(labels(page, "Scouts")).toHaveCount(6);
    await expect(labels(page, "Bikers")).toHaveCount(3);
  }

  // Each moves a model of their own; both tables show both moves.
  await carry(ana, "Scouts", { dx: 0, dy: -150 });
  await expect(log(ben).last()).toContainText("Ana moved Scouts");
  await carry(ben, "Bikers", { dx: 0, dy: -150 });
  await expect(log(ana).last()).toContainText("Ben moved Bikers");

  // Reloading mid-game comes back to the same table, and play goes on.
  await ana.reload();
  await expect(ana.getByLabel("The table")).toBeVisible();
  await expect(labels(ana, "Scouts")).toHaveCount(6);
  await carry(ana, "Scouts", { dx: 80, dy: -80 }, 2);
  await expect(log(ben).last()).toContainText("Ana moved Scouts");

  await ben.getByLabel("Dice", { exact: true }).fill("5");
  await ben.getByRole("button", { name: "Roll" }).click();
  await expect(log(ana).last()).toContainText("Ben rolled 5d6");
  for (const page of [ana, ben]) {
    await expect(page.getByLabel("The table")).toBeVisible();
    await expect(log(page)).toHaveCount(await log(ana).count());
  }
});

// The joiner's colour: two fresh browsers both offer the first colour, and armies must still differ.
test("a joiner whose colour is taken gets a colour of their own", async ({ page, browser }) => {
  await newGame(page, "Ana");
  const link = await page.getByLabel("Invite link").inputValue();
  const ben = await (await browser.newContext()).newPage();
  await ben.goto(link);
  await ben.getByLabel("Your name").fill("Ben");
  // Ana's colour, the first one, is still pressed: Ben doesn't change it.
  await expect(ben.getByRole("button", { name: "Colour #d1453b" })).toHaveAttribute("aria-pressed", "true");
  await ben.getByRole("button", { name: "Join" }).click();
  await expect(ben.getByLabel("The table")).toBeVisible();
  const dot = (p: Page, name: string) => p.getByRole("region", { name: `${name}'s army` }).locator(".dot");
  await expect(dot(page, "Ben")).toHaveCSS("background-color", "rgb(47, 111, 214)");
  await expect(dot(page, "Ana")).toHaveCSS("background-color", "rgb(209, 69, 59)");

  // Cy, opening a saved copy as a new game, joins it; that red is taken, so he gets the first free colour.
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save" }).click();
  const file = await (await download).path();
  const later = await (await browser.newContext()).newPage();
  await later.goto("/");
  await later.getByLabel("Your name").fill("Cy");
  await later.getByLabel("Choose a saved game file").setInputFiles(file);
  await expect(later.getByLabel("The table")).toBeVisible();
  await expect(dot(later, "Cy")).toHaveCSS("background-color", "rgb(46, 158, 85)");
});

// Undo is only offered where it would be taken: never beside a join, a roll or a shuffled draw.
test("Undo is not offered for a join, a roll or a shuffled draw", async ({ page }) => {
  await newGame(page, "Ana");
  await expect(log(page).last()).toContainText("Ana joined");
  await expect(page.getByRole("region", { name: "Log" }).getByRole("button", { name: "Undo" })).toHaveCount(0);
  await page.getByRole("button", { name: "Roll" }).click();
  await expect(log(page).last()).toContainText("Ana rolled 2d6");
  await expect(page.getByRole("region", { name: "Log" }).getByRole("button", { name: "Undo" })).toHaveCount(0);
  await addList(page, "Captain 40mm");
  await expect(log(page).last().getByRole("button", { name: "Undo" })).toBeVisible();

  // A shuffle can be undone; a draw from the shuffled deck can't.
  await page.getByRole("tab", { name: "Decks" }).click();
  if (!(await page.getByLabel("Deck name").isVisible())) await page.getByText("New deck").click();
  await page.getByLabel("Deck name").fill("Events");
  await page.getByLabel("Cards, one per line").fill("Storm\nFog");
  await page.getByLabel("Ordered as listed").check();
  await page.getByRole("button", { name: "Add deck" }).click();
  const row = page.getByRole("article", { name: "Events" });
  await row.getByRole("button", { name: "Shuffle" }).click();
  await expect(row).toContainText("2 cards, shuffled");
  await expect(log(page).last().getByRole("button", { name: "Undo" })).toBeVisible();
  await row.getByRole("button", { name: "Draw", exact: true }).click();
  await expect(row).toContainText("1 card");
  await expect(log(page).last()).toContainText("drew");
  await expect(page.getByRole("region", { name: "Log" }).getByRole("button", { name: "Undo" })).toHaveCount(0);
});

// A fault in the screen says what broke and offers a reload, instead of a black page.
test("a fault in the screen shows a reload, which comes back to the table", async ({ browser }) => {
  const context = await browser.newContext();
  // The first time the log scrolls after the table is up, it breaks.
  await context.addInitScript(() => {
    const scroll = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function (this: Element, ...args: Parameters<Element["scrollIntoView"]>) {
      if (this.closest("[aria-label=Log]") && document.body.dataset.armed && !sessionStorage.getItem("broke")) {
        sessionStorage.setItem("broke", "yes");
        throw new Error("A planted fault");
      }
      scroll.apply(this, args);
    };
  });
  const page = await context.newPage();
  await newGame(page, "Ana");
  await addList(page, "Captain 40mm");
  await expect(labels(page, "Captain")).toHaveCount(1);
  await page.evaluate(() => (document.body.dataset.armed = "yes"));
  await page.getByRole("button", { name: "Roll" }).click();
  await expect(page.getByRole("alert")).toContainText("Something went wrong on this screen");
  await expect(page.getByRole("alert")).toContainText("A planted fault");
  await page.getByRole("button", { name: "Reload" }).click();
  await expect(page.getByLabel("The table")).toBeVisible();
  await expect(labels(page, "Captain")).toHaveCount(1);
  await expect(log(page).last()).toContainText("Ana rolled 2d6");
});

// Army lists as people write or paste them: a count without the x, a stray number, and a list
// exported from Army Forge, whose weapon ranges are not heights.
test("army lists read as written, including an Army Forge export", async ({ page }) => {
  await newGame(page, "Ana");
  await page.getByLabel("Army list").fill("10 Scouts\n5");
  await page.getByRole("button", { name: "Read list" }).click();
  const listed = page.locator("table.listed tbody tr");
  await expect(listed).toHaveCount(1);
  await expect(listed.first()).toContainText("Scouts10");
  await expect(page.getByText("Couldn't read: 5")).toBeVisible();

  await page.getByLabel("Army list").fill(`++ Battle Brothers [GF 1000pts] ++

Battle Brothers [5] Q3+ D3+ | 115pts | Fearless
5x Assault Rifle (24", A1), 5x CCW (A1)

Captain [1] Q3+ D3+ | 90pts | Hero, Tough(3)
Heavy Pistol (12", A1, AP(1))`);
  await page.getByRole("button", { name: "Read list" }).click();
  await expect(listed).toHaveCount(2);
  await expect(listed.nth(0)).toHaveText(/^Battle Brothers525mm round1.2″/);
  await expect(listed.nth(1)).toHaveText(/^Captain125mm round1.2″/);
  await page.getByRole("button", { name: "Add to army" }).click();
  await expect(log(page).last()).toContainText("Ana added Battle Brothers (5 models) and Captain");
  await expect(labels(page, "Battle Brothers")).toHaveCount(5);
});

// Labels: a piece's name shows only while the pointer is over it or it is selected, so a crowded
// table stays readable (Porter, 2026-10-16).
test("a model's label shows on mouse over and while selected", async ({ page }) => {
  await newGame(page, "Ana");
  await addList(page, "5x Scouts 25mm\nCaptain 40mm");
  const shown = page.locator(".table-labels .label:visible");
  await expect(labels(page, "Scouts")).toHaveCount(5);
  await expect(shown).toHaveCount(0);
  await drawn(page);
  const captain = await centre(labels(page, "Captain"));
  await page.mouse.move(captain.x, captain.y + 6);
  await expect(shown).toHaveText(["Captain"]);
  // Off the piece, onto a panel: hidden again.
  await page.mouse.move(5, 300);
  await expect(shown).toHaveCount(0);
  // A click selects the unit's model; its label stays while selected.
  await page.mouse.click(captain.x, captain.y + 6);
  await page.mouse.move(5, 300);
  await expect(shown).toHaveText(["Captain"]);
});

// The log is something you open, and Ctrl-Z undoes your own latest action like its Undo button.
test("the log starts closed, and Ctrl-Z undoes your latest action", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Your name").fill("Ana");
  await page.getByRole("button", { name: "New game" }).click();
  await expect(page.getByLabel("The table")).toBeVisible();
  await expect(page.getByRole("region", { name: "Log" })).toHaveCount(0);
  await addList(page, "Captain 40mm");
  await page.getByLabel("The table").focus();
  await page.keyboard.press("ControlOrMeta+z");
  await page.getByRole("button", { name: "Log", exact: true }).click();
  await expect(log(page).last()).toContainText("Ana undid");
});
