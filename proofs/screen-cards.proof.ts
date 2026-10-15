import { test, expect, type Page } from "@playwright/test";
import { centre, drawn, labels, newGame } from "./screen-helpers.ts";

const log = (page: Page) => page.getByRole("region", { name: "Log" }).locator("li");
const hand = (page: Page) => page.getByRole("region", { name: "Your hand" });

async function newDeck(page: Page, name: string, cards: string, order: "Shuffled" | "Ordered as listed") {
  await page.getByRole("tab", { name: "Decks" }).click();
  if (!(await page.getByLabel("Deck name").isVisible())) await page.getByText("New deck").click();
  await page.getByLabel("Deck name").fill(name);
  await page.getByLabel("Cards, one per line").fill(cards);
  await page.getByLabel(order).check();
  await page.getByRole("button", { name: "Add deck" }).click();
}

/** Looks straight down, then zooms out so the decks beside the table are in view. */
async function lookDown(page: Page) {
  await page.getByLabel("The table").focus();
  await page.keyboard.press("t");
  const box = (await page.getByLabel("The table").boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, 200);
  await drawn(page);
}

async function dragTo(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, shift = false) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 10 });
  if (shift) await page.keyboard.down("Shift");
  await page.mouse.up();
  if (shift) await page.keyboard.up("Shift");
}

// Decks and hands: an ordered deck draws its top card into your hand, or face up with Shift;
// cards are played from the hand onto the table, discarded, and put back into the deck.
test("drawing, playing, discarding and returning cards", async ({ page }) => {
  await newGame(page);
  await newDeck(page, "Missions", "Ambush: Deploy one unit anywhere.\nHold the line\nScout ahead", "Ordered as listed");
  await expect(log(page).last()).toContainText("Ana added the deck Missions (3 cards, ordered)");
  await lookDown(page);
  const deck = labels(page, "Missions · 3");
  await expect(deck).toHaveCount(1);

  const at = await centre(deck);
  await page.mouse.click(at.x, at.y);
  await expect(hand(page).getByRole("listitem", { name: "Ambush" })).toContainText("Deploy one unit anywhere.");
  await page.keyboard.down("Shift");
  await page.mouse.click(at.x, at.y);
  await page.keyboard.up("Shift");
  await expect(labels(page, "Hold the line")).toHaveCount(1);
  await expect(labels(page, "Missions · 1")).toHaveCount(1);
  // Record puts a card drawn face up on its deck; slide it off to see the deck again.
  await dragTo(page, await centre(labels(page, "Hold the line")), { x: at.x, y: at.y - 120 });
  await expect(log(page).last()).toContainText("Ana played Hold the line onto the table");

  // Play Ambush from the hand onto the table.
  const table = (await page.getByLabel("The table").boundingBox())!;
  const spot = { x: table.x + table.width / 2, y: table.y + table.height / 2 };
  await dragTo(page, await centre(hand(page).getByRole("listitem", { name: "Ambush" })), spot);
  await expect(labels(page, "Ambush")).toHaveCount(1);
  await expect(log(page).last()).toContainText("Ana played Ambush onto the table");
  await expect(hand(page)).toContainText("Your hand is empty");

  // Discard it onto the deck's discard pile.
  await dragTo(page, await centre(labels(page, "Ambush")), await centre(labels(page, "Discard · 0")));
  await expect(log(page).last()).toContainText("Ana discarded Ambush");
  await expect(labels(page, "Discard · 1")).toHaveCount(1);

  // Put Hold the line back on the bottom of the deck, then draw: the top card comes first.
  await dragTo(page, await centre(labels(page, "Hold the line")), await centre(labels(page, "Missions · 1")), true);
  await expect(log(page).last()).toContainText("at the bottom of Missions");
  await page.mouse.click(at.x, at.y);
  await expect(hand(page).getByRole("listitem", { name: "Scout ahead" })).toHaveCount(1);

  // A card in the hand goes back to the table by dragging; F turns it face down and up.
  await dragTo(page, await centre(hand(page).getByRole("listitem", { name: "Scout ahead" })), spot);
  await expect(labels(page, "Scout ahead")).toHaveCount(1);
  await page.mouse.move(spot.x, spot.y);
  await page.keyboard.press("f");
  await expect(labels(page, "Scout ahead")).toHaveCount(0);
  await expect(labels(page, "Card")).toHaveCount(1);
  await expect(log(page).last()).toContainText("Ana played a card face down onto the table");
});

// Decks: shuffle makes an ordered deck shuffled; an empty deck says so and draws nothing.
test("shuffling, and an empty deck", async ({ page }) => {
  await newGame(page);
  await newDeck(page, "Events", "Storm\nFog", "Ordered as listed");
  const row = page.getByRole("article", { name: "Events" });
  await row.getByRole("button", { name: "Shuffle" }).click();
  await expect(row).toContainText("2 cards, shuffled");
  await expect(labels(page, "Events · 2 · shuffled")).toHaveCount(1);
  await row.getByRole("button", { name: "Draw", exact: true }).click();
  await row.getByRole("button", { name: "Draw", exact: true }).click();
  await expect(hand(page).getByRole("listitem")).toHaveCount(2);
  await row.getByRole("button", { name: "Draw", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("Events is empty.");
  await expect(log(page)).toHaveCount(5);
});

// Hands: everyone else's hand shows as card backs with a count. A draw whose seal doesn't match
// is flagged in the log.
test("another player's hand shows as backs with a count", async ({ page }) => {
  await newGame(page);
  await newDeck(page, "Missions", "A\nB\nC", "Shuffled");
  await expect(labels(page, "Missions · 3 · shuffled")).toHaveCount(1);
  await page.evaluate(() => {
    const fake = (window as any).openbattleFake;
    fake.actAs("ben", { kind: "join", name: "Ben", colour: "#2f6fd6" });
  });
  const deckId = await page.evaluate(
    () => (window as any).openbattleFake.log().entries.find((e: any) => e.action.kind === "add deck").action.deck,
  );
  await page.evaluate((deck) => {
    const fake = (window as any).openbattleFake;
    fake.actAs("ben", { kind: "draw", deck, cards: 2, to: "hand", seal: "", hostValue: "a", guestValue: "b" });
  }, deckId);
  await expect(page.getByLabel("Ben's hand")).toContainText("2");
  await expect(page.getByLabel("Ben's hand").locator(".back")).toHaveCount(2);
  await expect(log(page).last()).toContainText("Ben drew 2 cards from Missions into their hand");

  // That draw's seal doesn't match its host value, so it is flagged as tampered, as a roll is.
  await expect(log(page).last()).toHaveClass(/tampered/);
  await expect(log(page).last().getByRole("alert")).toContainText("This draw was tampered with");
  // An honest draw is not flagged.
  await page.getByRole("tab", { name: "Decks" }).click();
  await page.getByRole("article", { name: "Missions" }).getByRole("button", { name: "Draw", exact: true }).click();
  await expect(log(page).last()).toContainText("Ana drew 1 card from Missions into your hand");
  await expect(log(page).last()).not.toHaveClass(/tampered/);
});
