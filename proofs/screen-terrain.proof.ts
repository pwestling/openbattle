import { test, expect, type Page } from "@playwright/test";
import { addArmy, centre, drawn, joinGame, labels, lastKept, newGame, rogueHost } from "./screen-helpers.ts";

const log = (page: Page) => page.getByRole("region", { name: "Log" }).locator("li");

/** A cuboid's triangles, with +y up: w across, h up, d deep. */
function cuboid(w: number, d: number, h: number): number[][][] {
  const c = (x: number, y: number, z: number) => [x * w, y * h, z * d];
  const quads = [
    [c(0, 1, 0), c(0, 1, 1), c(1, 1, 1), c(1, 1, 0)], // top
    [c(0, 0, 0), c(1, 0, 0), c(1, 0, 1), c(0, 0, 1)], // bottom
    [c(0, 0, 0), c(0, 1, 0), c(1, 1, 0), c(1, 0, 0)],
    [c(0, 0, 1), c(1, 0, 1), c(1, 1, 1), c(0, 1, 1)],
    [c(0, 0, 0), c(0, 0, 1), c(0, 1, 1), c(0, 1, 0)],
    [c(1, 0, 0), c(1, 1, 0), c(1, 1, 1), c(1, 0, 1)],
  ];
  return quads.flatMap(([a, b, e, f]) => [
    [a!, b!, e!],
    [a!, e!, f!],
  ]);
}

/** A cuboid as an ASCII STL file: millimetres, with +z up as 3D printing files are. */
function cuboidStl(w: number, d: number, h: number): string {
  const facet = (t: number[][]) =>
    `facet normal 0 0 0\nouter loop\n${t.map(([x, y, z]) => `vertex ${x} ${-z!} ${y}`).join("\n")}\nendloop\nendfacet`;
  return `solid cuboid\n${cuboid(w, d, h).map(facet).join("\n")}\nendsolid cuboid\n`;
}

/** A cuboid as an OBJ file, which says no units: read as inches, +y up. */
function cuboidObj(w: number, d: number, h: number): string {
  const tris = cuboid(w, d, h);
  const vertices = tris.flat().map(([x, y, z]) => `v ${x} ${y} ${z}`);
  const faces = tris.map((_, i) => `f ${i * 3 + 1} ${i * 3 + 2} ${i * 3 + 3}`);
  return `# cuboid\n${vertices.join("\n")}\n${faces.join("\n")}\n`;
}

/** A cuboid as a glTF file: metres, +y up. */
function cuboidGltf(w: number, d: number, h: number): string {
  const points = cuboid(w, d, h).flat();
  const bytes = Buffer.from(new Float32Array(points.flat()).buffer);
  return JSON.stringify({
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    accessors: [{ bufferView: 0, componentType: 5126, count: points.length, type: "VEC3", min: [0, 0, 0], max: [w, h, d] }],
    bufferViews: [{ buffer: 0, byteLength: bytes.length }],
    buffers: [{ byteLength: bytes.length, uri: `data:application/octet-stream;base64,${bytes.toString("base64")}` }],
  });
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
  const move = (await lastKept(page, "move")).moves[0];
  expect(move.floor).not.toBeNull();
  // The box stands at the middle of the 60 by 44 table and is 6 inches across.
  expect(Math.abs(move.position.x - 30)).toBeLessThan(3);
  expect(Math.abs(move.position.y - 22)).toBeLessThan(3);
});

// Picking up: a unit carried with the pointer on the table beside a box puts the models over the
// box on its roof, the highest floor under them.
test("models of a unit carried beside terrain land on the floors under them", async ({ page }) => {
  await newGame(page);
  await page.getByRole("tab", { name: "Terrain" }).click();
  await page.getByRole("button", { name: "Add terrain" }).click();
  await page.getByRole("tab", { name: "Army" }).click();
  await addArmy(page, "5x Scouts 25mm");
  await lookDown(page);
  const first = await centre(labels(page, "Scouts").nth(0));
  const second = await centre(labels(page, "Scouts").nth(1));
  // Scouts stand 25 mm plus 0.6 inches apart, in a row.
  const perInch = Math.hypot(second.x - first.x, second.y - first.y) / (25 / 25.4 + 0.6);
  await page.mouse.click(first.x, first.y);
  await page.mouse.click(first.x, first.y);
  await expect(page.locator(".label.selected")).toHaveCount(5);
  // The 6-inch box is at the table's middle; the first scout goes 3.5 inches left of its centre.
  const box = await centre(labels(page, "Box"));
  await page.mouse.move(first.x, first.y);
  await page.mouse.down();
  await page.mouse.move(box.x - 3.5 * perInch, box.y, { steps: 10 });
  await page.mouse.up();
  await expect(log(page).last()).toContainText("Ana moved Scouts");
  const moves = (await lastKept(page, "move")).moves;
  const onRoof = moves.filter((m: any) => m.floor !== null).length;
  expect(onRoof).toBe(4);
});

// Terrain panel: load a 3D mesh file; its floors come from the mesh, and it can be resized.
test("a mesh file becomes terrain with floors from its shape", async ({ page }) => {
  await newGame(page);
  await page.getByRole("tab", { name: "Terrain" }).click();
  await page
    .getByLabel("Load a mesh file")
    .setInputFiles({ name: "Ruin.stl", mimeType: "model/stl", buffer: Buffer.from(cuboidStl(76.2, 50.8, 25.4)) });
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

  // glTF files are in metres and OBJ files are taken as inches.
  await page
    .getByLabel("Load a mesh file")
    .setInputFiles({ name: "Tower.gltf", mimeType: "model/gltf+json", buffer: Buffer.from(cuboidGltf(0.0762, 0.0508, 0.1016)) });
  const tower = page.getByRole("article", { name: "Tower" });
  await expect(tower).toContainText("mesh, 1 floor");
  await expect(tower.getByLabel("Width")).toHaveValue("3");
  await expect(tower.getByLabel("Depth")).toHaveValue("2");
  await expect(tower.getByLabel("Height")).toHaveValue("4");
  await page
    .getByLabel("Load a mesh file")
    .setInputFiles({ name: "Wall.obj", mimeType: "text/plain", buffer: Buffer.from(cuboidObj(5, 1, 2)) });
  const wall = page.getByRole("article", { name: "Wall" });
  await expect(wall).toContainText("mesh, 1 floor");
  await expect(wall.getByLabel("Width")).toHaveValue("5");
  await expect(wall.getByLabel("Depth")).toHaveValue("1");
  await expect(wall.getByLabel("Height")).toHaveValue("2");

  // A file that is not a mesh is refused with a note.
  await page.getByLabel("Load a mesh file").setInputFiles({ name: "notes.obj", mimeType: "text/plain", buffer: Buffer.from("hello") });
  await expect(page.getByRole("alert")).toContainText("not a readable mesh");
});

// Models: a mesh file can be chosen for each unit when adding to an army.
test("a unit can be given a mesh file", async ({ page }) => {
  await newGame(page);
  await page.getByLabel("Army list").fill('3x Walkers 32mm 2"');
  await page.getByRole("button", { name: "Read list" }).click();
  await page
    .getByLabel("Mesh for Walkers")
    .setInputFiles({ name: "walker.stl", mimeType: "model/stl", buffer: Buffer.from(cuboidStl(20, 20, 50)) });
  await expect(page.locator(".listed")).toContainText("✓");
  await page.getByRole("button", { name: "Add to army" }).click();
  await expect(labels(page, "Walkers")).toHaveCount(3);
  // Drawn with the mesh, not marked as waiting for it.
  for (const walker of await labels(page, "Walkers").all()) await expect(walker).not.toHaveClass(/missing/);
});

// Session: a mesh file often arrives after the action that uses it. Until it does the piece shows
// as missing, and once it is here the piece is drawn with it.
test("a piece whose mesh file arrives late shows as missing until it does", async ({ browser }) => {
  // The host places a piece and holds its file back, then sends it.
  const { rogue, link } = await rogueHost(browser);
  const page = await joinGame(browser, link, "Ben");
  const stl = cuboidStl(76.2, 50.8, 25.4);
  const mesh = await rogue.evaluate(async (stl) => {
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(stl)));
    const mesh = Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("");
    const shape = { kind: "mesh", mesh, width: 3, depth: 2, height: 1 };
    (window as any).rogue.act({ kind: "place terrain", terrain: { id: "ruin", name: "Ruin", shape, position: { x: 30, y: 22 }, facing: 0, floors: [] } });
    return mesh;
  }, stl);
  await expect(labels(page, "Ruin")).toHaveClass(/missing/);
  await rogue.evaluate(([mesh, stl]) => (window as any).rogue.sendFile(mesh, stl), [mesh, stl]);
  await expect(labels(page, "Ruin")).not.toHaveClass(/missing/, { timeout: 5000 });
});
