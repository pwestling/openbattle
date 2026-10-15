import { test, expect, type Page } from "@playwright/test";
import { addArmy, centre, drawn, labels, newGame } from "./screen-helpers.ts";

const log = (page: Page) => page.getByRole("region", { name: "Log" }).locator("li");

/** A cuboid as an ASCII STL file, in millimetres. */
function cuboidStl(w: number, d: number, h: number): Buffer {
  const c = (x: number, y: number, z: number) => [x * w, y * h, z * d];
  const quads = [
    [c(0, 1, 0), c(0, 1, 1), c(1, 1, 1), c(1, 1, 0)], // top
    [c(0, 0, 0), c(1, 0, 0), c(1, 0, 1), c(0, 0, 1)], // bottom
    [c(0, 0, 0), c(0, 1, 0), c(1, 1, 0), c(1, 0, 0)],
    [c(0, 0, 1), c(1, 0, 1), c(1, 1, 1), c(0, 1, 1)],
    [c(0, 0, 0), c(0, 0, 1), c(0, 1, 1), c(0, 1, 0)],
    [c(1, 0, 0), c(1, 1, 0), c(1, 1, 1), c(1, 0, 1)],
  ];
  const facet = (a: number[], b: number[], e: number[]) =>
    `facet normal 0 0 0\nouter loop\n${[a, b, e].map((v) => `vertex ${v.join(" ")}`).join("\n")}\nendloop\nendfacet`;
  const body = quads.flatMap(([a, b, e, f]) => [facet(a!, b!, e!), facet(a!, e!, f!)]).join("\n");
  return Buffer.from(`solid cuboid\n${body}\nendsolid cuboid\n`);
}

async function lookDown(page: Page) {
  await page.getByLabel("The table").focus();
  await page.keyboard.press("t");
  await drawn(page);
}

// Terrain panel: add a box, cylinder or ramp; a model set down over it lands on its highest floor,
// and Page Up and Page Down step between the floors there while carrying.
test("a model carried onto terrain stands on its floor", async ({ page }) => {
  await newGame(page);
  await page.getByRole("tab", { name: "Terrain" }).click();
  await page.getByRole("button", { name: "Add terrain" }).click();
  await expect(log(page).last()).toContainText("Ana placed Box");
  await expect(page.getByRole("article", { name: "Box" })).toContainText("box, 1 floor");
  await page.getByLabel("Shape").selectOption("ramp");
  await page.getByRole("button", { name: "Add terrain" }).click();
  await expect(page.getByRole("article", { name: "Ramp" })).toContainText("ramp, 0 floors");
  await page.getByRole("article", { name: "Ramp" }).getByRole("button", { name: "Remove" }).click();
  await expect(labels(page, "Ramp")).toHaveCount(0);

  await page.getByRole("tab", { name: "Army" }).click();
  await addArmy(page, "Captain 40mm");
  await lookDown(page);
  const from = await centre(labels(page, "Captain"));
  const to = await centre(labels(page, "Box"));
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y + 10, { steps: 10 });
  await expect(page.locator(".label.distance")).toContainText("↑3″");
  await page.keyboard.press("PageDown");
  await expect(page.locator(".label.distance")).not.toContainText("↑");
  await page.keyboard.press("PageUp");
  await expect(page.locator(".label.distance")).toContainText("↑3″");
  await page.mouse.up();
  await expect(log(page).last()).toContainText("Ana moved Captain");

  // Terrain is moved like a model, by dragging it.
  const box = await centre(labels(page, "Box"));
  await page.mouse.move(box.x + 25, box.y + 25);
  await page.mouse.down();
  await page.mouse.move(box.x + 25 - 120, box.y + 25, { steps: 8 });
  await page.mouse.up();
  await expect(log(page).last()).toContainText("Ana moved Box");
});

// Picking up, from the usual slanted view: pointing at a roof sets the model down on that roof,
// and the ruler shows how far up it is.
test("a model carried onto a roof lands where the pointer is, seen at a slant", async ({ page }) => {
  await newGame(page);
  await page.getByRole("tab", { name: "Terrain" }).click();
  await page.getByLabel("Height").fill("8");
  await page.getByRole("button", { name: "Add terrain" }).click();
  await expect(log(page).last()).toContainText("Ana placed Box");
  await page.getByRole("tab", { name: "Army" }).click();
  await addArmy(page, "Captain 40mm");
  await drawn(page);

  // The ruler, from the table in front of the box to its roof.
  const roof = await centre(labels(page, "Box"));
  const captain = await centre(labels(page, "Captain"));
  await page.getByLabel("The table").focus();
  await page.keyboard.down("Tab");
  await page.mouse.move(roof.x, captain.y);
  await page.mouse.down();
  await page.mouse.move(roof.x, roof.y + 8, { steps: 8 });
  await expect(page.locator(".label.distance")).toContainText("8″ up");
  await page.mouse.up();
  await page.keyboard.up("Tab");

  await page.mouse.move(captain.x, captain.y);
  await page.mouse.down();
  await page.mouse.move(roof.x, roof.y + 8, { steps: 10 });
  await expect(page.locator(".label.distance")).toContainText("↑8″");
  await page.mouse.up();
  await expect(log(page).last()).toContainText("Ana moved Captain");
  const move = await page.evaluate(() => (window as any).openbattleFake.log().entries.at(-1).action.moves[0]);
  expect(move.floor).not.toBeNull();
  // The box stands at the middle of the 60 by 44 table and is 6 inches across.
  expect(Math.abs(move.position.x - 30)).toBeLessThan(3);
  expect(Math.abs(move.position.y - 22)).toBeLessThan(3);
});

// Terrain panel: load a 3D mesh file; its floors come from the mesh, and it can be resized.
test("a mesh file becomes terrain with floors from its shape", async ({ page }) => {
  await newGame(page);
  await page.getByRole("tab", { name: "Terrain" }).click();
  await page.getByLabel("Load a mesh file").setInputFiles({ name: "Ruin.stl", mimeType: "model/stl", buffer: cuboidStl(76.2, 50.8, 25.4) });
  await expect(log(page).last()).toContainText("Ana placed Ruin");
  const ruin = page.getByRole("article", { name: "Ruin" });
  await expect(ruin).toContainText("mesh, 1 floor");
  await expect(ruin.getByLabel("Width")).toHaveValue("3");
  await expect(ruin.getByLabel("Depth")).toHaveValue("2");
  await expect(ruin.getByLabel("Height")).toHaveValue("1");
  await ruin.getByLabel("Height").fill("4");
  await ruin.getByRole("button", { name: "Resize" }).click();
  await expect(log(page).last()).toContainText("Ana resized Ruin");
  await expect(labels(page, "Ruin")).toHaveCount(1);

  // A file that is not a mesh is refused with a note.
  await page.getByLabel("Load a mesh file").setInputFiles({ name: "notes.obj", mimeType: "text/plain", buffer: Buffer.from("hello") });
  await expect(page.getByRole("alert")).toContainText("not a readable mesh");
});

// Models: a mesh file can be chosen for each unit when adding to an army.
test("a unit can be given a mesh file", async ({ page }) => {
  await newGame(page);
  await page.getByLabel("Army list").fill('3x Walkers 32mm 2"');
  await page.getByRole("button", { name: "Read list" }).click();
  await page.getByLabel("Mesh for Walkers").setInputFiles({ name: "walker.stl", mimeType: "model/stl", buffer: cuboidStl(20, 20, 50) });
  await expect(page.locator(".listed")).toContainText("✓");
  await page.getByRole("button", { name: "Add to army" }).click();
  await expect(labels(page, "Walkers")).toHaveCount(3);
});
