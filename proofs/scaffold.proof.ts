import { test, expect } from "@playwright/test";

// The app and the relay are served together: a browser can open the start page and reach the relay.
test("the app opens and the relay answers", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("OpenBattle");
  await expect(page.getByRole("heading", { name: "OpenBattle" })).toBeVisible();
  const health = await page.request.get("/health");
  expect(health.ok()).toBe(true);
});
