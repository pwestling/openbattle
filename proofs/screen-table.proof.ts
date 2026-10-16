import { test, expect, type Page } from "@playwright/test";
import { addArmy, centre, drawn, joinGame, keptLog, labels, newGame, rogueHost } from "./screen-helpers.ts";

const log = (page: Page) => page.getByRole("region", { name: "Log" }).locator("li");
const inchesIn = (text: string) => Number(/([\d.]+)″/.exec(text)![1]);

/** Looks straight down, so that a distance on screen is the same everywhere on the table. */
async function lookDown(page: Page) {
  await page.getByLabel("The table").focus();
  await page.keyboard.press("t");
  await drawn(page);
}

/** The last action in the log as this browser has it. */
const lastAction = async (page: Page) => {
  // Kept once every action the log panel shows has been saved.
  await expect.poll(async () => (await keptLog(page))?.entries.length).toBe(await log(page).count());
  return (await keptLog(page)).entries.at(-1).action;
};

/** Drags from a point by an offset, pressing keys partway, and returns the distance shown while carrying. */
async function drag(page: Page, from: { x: number; y: number }, legs: { dx: number; dy: number }[], between?: string) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  let at = from;
  for (const [i, leg] of legs.entries()) {
    at = { x: at.x + leg.dx, y: at.y + leg.dy };
    await page.mouse.move(at.x, at.y, { steps: 8 });
    if (between && i < legs.length - 1) await page.keyboard.press(between);
  }
  const shown = await page
    .locator(".label.distance")
    .first()
    .textContent({ timeout: 2000 })
    .catch(() => null);
  await page.mouse.up();
  return shown;
}

// Picking up: dragging carries the model, the distance shows live, and letting go is one move.
// Carrying with a waypoint measures the path along its true length.
test("carrying a model measures the move, along a path with corners", async ({ page }) => {
  await newGame(page);
  await addArmy(page, "Captain 40mm");
  await lookDown(page);
  const before = await centre(labels(page, "Captain"));
  const shown = await drag(page, before, [{ dx: 160, dy: 0 }]);
  await expect(log(page).last()).toContainText("Ana moved Captain");
  const straight = inchesIn((await log(page).last().textContent())!);
  expect(straight).toBeGreaterThan(1);
  expect(inchesIn(shown!)).toBe(straight);
  const after = await centre(labels(page, "Captain"));
  expect(after.x - before.x).toBeGreaterThan(140);

  // The same distance again, then the same again at a right angle, with a waypoint at the corner.
  await drag(
    page,
    after,
    [
      { dx: 160, dy: 0 },
      { dx: 0, dy: 160 },
    ],
    "Space",
  );
  await expect(log(page)).toHaveCount(4);
  expect(inchesIn((await log(page).last().textContent())!)).toBeCloseTo(2 * straight, 0);

  // A right-click while carrying pins a waypoint too.
  const corner = await centre(labels(page, "Captain"));
  await page.mouse.move(corner.x, corner.y);
  await page.mouse.down();
  await page.mouse.move(corner.x - 160, corner.y, { steps: 8 });
  await page.mouse.down({ button: "right" });
  await page.mouse.up({ button: "right" });
  await page.mouse.move(corner.x - 160, corner.y - 160, { steps: 8 });
  await page.mouse.up();
  await expect(log(page)).toHaveCount(5);
  expect(inchesIn((await log(page).last().textContent())!)).toBeCloseTo(2 * straight, 0);
  expect((await lastAction(page)).moves[0].path).toHaveLength(3);
});

// Picking up: Q and E turn what is carried; Escape puts it back, and letting go then sends nothing.
test("carried models turn with Q and E, and Escape puts them back", async ({ page }) => {
  await newGame(page);
  await addArmy(page, "Captain 40mm");
  await lookDown(page);
  const start = await centre(labels(page, "Captain"));
  await drag(
    page,
    start,
    [
      { dx: 60, dy: 0 },
      { dx: 60, dy: 0 },
    ],
    "e",
  );
  await expect(log(page)).toHaveCount(3);
  expect((await lastAction(page)).moves[0].facing).toBe(15);
  await drag(
    page,
    await centre(labels(page, "Captain")),
    [
      { dx: 0, dy: 40 },
      { dx: 0, dy: 40 },
    ],
    "q",
  );
  await expect(log(page)).toHaveCount(4);
  expect((await lastAction(page)).moves[0].facing).toBe(0);

  const before = await centre(labels(page, "Captain"));
  await page.mouse.move(before.x, before.y);
  await page.mouse.down();
  await page.mouse.move(before.x + 150, before.y, { steps: 8 });
  await page.keyboard.press("Escape");
  await page.mouse.move(before.x + 200, before.y + 50, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => Math.abs((await centre(labels(page, "Captain"))).x - before.x)).toBeLessThan(3);
  // A move made after it is the next entry, so the cancelled carry sent nothing.
  const was = (await lastAction(page)).moves[0].position.x;
  await drag(page, before, [{ dx: -100, dy: 0 }]);
  await expect.poll(async () => (await lastAction(page)).moves?.[0].position.x).toBeLessThan(was - 1);
  expect(await log(page).count()).toBe(5);

  // Letting go of the left button while the right is still held sets the model down there.
  const from = await centre(labels(page, "Captain"));
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x, from.y + 100, { steps: 8 });
  await page.mouse.down({ button: "right" });
  await page.mouse.up();
  await page.mouse.move(from.x + 150, from.y + 100, { steps: 8 });
  await page.mouse.up({ button: "right" });
  await expect(log(page)).toHaveCount(6);
  await drawn(page);
  const set = await centre(labels(page, "Captain"));
  expect(Math.abs(set.x - from.x)).toBeLessThan(3);
});

// Picking up: Shift-click adds a model to the selection, or takes it out.
test("shift-click adds and removes models from the selection", async ({ page }) => {
  await newGame(page);
  await addArmy(page, "Captain 40mm\nSergeant 32mm");
  await lookDown(page);
  const captain = await centre(labels(page, "Captain"));
  const sergeant = await centre(labels(page, "Sergeant"));
  await page.mouse.click(captain.x, captain.y);
  await page.keyboard.down("Shift");
  await page.mouse.click(sergeant.x, sergeant.y);
  await expect(page.locator(".label.selected")).toHaveCount(2);
  await page.mouse.click(captain.x, captain.y);
  await page.keyboard.up("Shift");
  await expect(page.locator(".label.selected")).toHaveText(["Sergeant"]);
});

// Picking up: click selects, a second click selects the whole unit, and dragging carries it all,
// keeping its shape.
test("a whole unit is selected and carried together", async ({ page }) => {
  await newGame(page);
  await addArmy(page, "5x Scouts 25mm");
  await lookDown(page);
  const scout = labels(page, "Scouts").nth(2);
  const at = await centre(scout);
  await page.mouse.click(at.x, at.y);
  await expect(page.locator(".label.selected")).toHaveCount(1);
  await page.mouse.click(at.x, at.y);
  await expect(page.locator(".label.selected")).toHaveCount(5);
  const before = await Promise.all([0, 1, 2, 3, 4].map((i) => centre(labels(page, "Scouts").nth(i))));
  await drag(page, before[2]!, [{ dx: 0, dy: -120 }]);
  await expect(log(page).last()).toContainText("Ana moved Scouts");
  const after = await Promise.all([0, 1, 2, 3, 4].map((i) => centre(labels(page, "Scouts").nth(i))));
  for (const [i, a] of after.entries()) {
    expect(a.y - before[i]!.y).toBeLessThan(-100);
    expect(Math.abs(a.x - before[i]!.x)).toBeLessThan(3);
  }
  // Clicking the empty table clears the selection; a box drawn around models selects them.
  await page.mouse.click(after[0]!.x, after[0]!.y + 150);
  await expect(page.locator(".label.selected")).toHaveCount(0);
  const xs = after.map((a) => a.x);
  await page.mouse.move(Math.min(...xs) - 30, after[0]!.y - 40);
  await page.mouse.down();
  await page.mouse.move(Math.max(...xs) + 30, after[0]!.y + 40, { steps: 5 });
  await page.mouse.up();
  await expect(page.locator(".label.selected")).toHaveCount(5);
});

// Picking up, fails: a refused move settles back where it was, with a short note saying why.
test("a refused move settles back with a note", async ({ browser }) => {
  // The host refuses Ben's move, as it would a move the record finds a problem with.
  const { rogue, link } = await rogueHost(browser);
  const page = await joinGame(browser, link, "Ben");
  await addArmy(page, "Captain 40mm");
  await expect(log(page)).toHaveCount(3);
  await lookDown(page);
  const before = await centre(labels(page, "Captain"));
  await rogue.evaluate(() => (window as any).rogue.refuseNext("That model has been set aside."));
  await drag(page, before, [{ dx: 150, dy: 0 }]);
  await expect(page.getByRole("alert")).toHaveText("That model has been set aside.");
  await expect.poll(async () => Math.abs((await centre(labels(page, "Captain"))).x - before.x)).toBeLessThan(3);
  await expect(log(page)).toHaveCount(3);
});

// Ruler and camera: measuring shows inches across and sends nothing; the camera and selection
// never become actions.
test("the ruler measures privately, and looking around sends nothing", async ({ page }) => {
  await newGame(page);
  await addArmy(page, "Captain 40mm");
  await lookDown(page);
  const start = await centre(labels(page, "Captain"));
  const shown = await drag(page, start, [{ dx: 160, dy: 0 }]);
  await expect(log(page)).toHaveCount(3);
  const moved = inchesIn(shown!);

  // The same length on the empty table, with the ruler.
  const from = { x: start.x, y: start.y - 120 };
  await page.keyboard.down("Tab");
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 160, from.y, { steps: 8 });
  await expect(page.locator(".label.distance")).toHaveText(`${moved}″`);
  await page.mouse.up();
  await page.keyboard.up("Tab");
  await expect(page.locator(".label.distance")).toHaveCount(0);

  // Each camera control changes the view; H brings it back to your edge.
  await page.keyboard.press("h");
  await drawn(page);
  const home = await centre(labels(page, "Captain"));
  const seen = [home];
  const changed = async () => {
    await drawn(page);
    const now = await centre(labels(page, "Captain"));
    const last = seen.at(-1)!;
    expect(Math.hypot(now.x - last.x, now.y - last.y)).toBeGreaterThan(5);
    seen.push(now);
  };
  const table = page.getByLabel("The table");
  const box = (await table.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down({ button: "right" });
  await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2 + 40, { steps: 5 });
  await page.mouse.up({ button: "right" });
  await changed();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down({ button: "middle" });
  await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2, { steps: 5 });
  await page.mouse.up({ button: "middle" });
  await changed();
  await page.mouse.wheel(0, 300);
  await changed();
  // Tabletop Simulator's keys: WASD slide, the arrows turn.
  for (const key of ["d", "w", "ArrowLeft", "ArrowDown"]) {
    await page.keyboard.down(key);
    await drawn(page);
    await drawn(page);
    await page.keyboard.up(key);
    await changed();
  }
  await page.keyboard.press("t");
  await changed();
  // Looking straight down, the arrows turn about the middle of the view, which sliding would not:
  // the Captain keeps its distance from the middle.
  const middle = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const fromMiddle = (p: { x: number; y: number }) => Math.hypot(p.x - middle.x, p.y - middle.y);
  const before = seen.at(-1)!;
  await page.keyboard.down("ArrowLeft");
  await drawn(page);
  await drawn(page);
  await page.keyboard.up("ArrowLeft");
  await changed();
  expect(Math.abs(fromMiddle(seen.at(-1)!) - fromMiddle(before))).toBeLessThan(3);
  // Space goes back to your edge, as H does.
  await page.keyboard.press(" ");
  await drawn(page);
  const spaced = await centre(labels(page, "Captain"));
  expect(Math.hypot(spaced.x - home.x, spaced.y - home.y)).toBeLessThan(2);
  seen.push(spaced);
  // P looks straight down and back again; Z zooms to the pointer and back, as does a middle-click.
  const there = async () => {
    await drawn(page);
    const now = await centre(labels(page, "Captain"));
    expect(Math.hypot(now.x - home.x, now.y - home.y)).toBeLessThan(2);
    seen.push(now);
  };
  await page.keyboard.press("p");
  await changed();
  await page.keyboard.press("p");
  await there();
  // Z closes in on the spot under the pointer: pointing at the Captain brings it to the middle.
  await page.mouse.move(home.x, home.y);
  await page.keyboard.press("z");
  await changed();
  expect(fromMiddle(seen.at(-1)!)).toBeLessThan(fromMiddle(home) / 3);
  await page.keyboard.press("z");
  await there();
  await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2 + 60);
  await page.mouse.down({ button: "middle" });
  await page.mouse.up({ button: "middle" });
  await changed();
  await page.mouse.down({ button: "middle" });
  await page.mouse.up({ button: "middle" });
  await there();
  await page.keyboard.press("t");
  await changed();
  await page.keyboard.press("h");
  await drawn(page);
  const back = await centre(labels(page, "Captain"));
  expect(Math.hypot(back.x - home.x, back.y - home.y)).toBeLessThan(2);

  // Selecting is private too. The next move is the next entry, so none of the above sent anything.
  await page.mouse.click(back.x, back.y);
  await expect(page.locator(".label.selected")).toHaveCount(1);
  const was = (await lastAction(page)).moves[0].position.y;
  await drag(page, back, [{ dx: 0, dy: 60 }]);
  await expect.poll(async () => (await lastAction(page)).moves?.[0].position.y).not.toBe(was);
  // Actions land in order, so anything sent before the move would already be in the log.
  expect(await log(page).count()).toBe(4);
});

// Proof 1, played as people would: two browsers, one model moved, both see it.
test("proof 1: two people at one table, one moves a model, both see it", async ({ page, browser }) => {
  await newGame(page);
  await addArmy(page, "Captain 40mm");
  const ben = await joinGame(browser, await page.getByLabel("Invite link").inputValue(), "Ben");
  await expect(labels(ben, "Captain")).toHaveCount(1);
  await lookDown(ben);
  const benSawBefore = await centre(labels(ben, "Captain"));
  await lookDown(page);
  await drag(page, await centre(labels(page, "Captain")), [{ dx: 150, dy: 0 }]);
  await expect(log(page).last()).toContainText("Ana moved Captain");
  await expect(log(ben).last()).toContainText("Ana moved Captain");
  const moved = (await lastAction(page)).moves[0].position;
  await expect.poll(async () => (await lastAction(ben)).moves?.[0].position).toEqual(moved);
  // On Ben's screen the model has moved too, though he sees the table from his own seat.
  await drawn(ben);
  await expect.poll(async () => {
    const now = await centre(labels(ben, "Captain"));
    return Math.hypot(now.x - benSawBefore.x, now.y - benSawBefore.y);
  }).toBeGreaterThan(100);
});
