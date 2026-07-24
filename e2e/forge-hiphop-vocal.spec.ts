import { test, expect } from "@playwright/test";

test.describe("Hip-Hop vocal forge", () => {
  test("page loads with Hip-Hop genre selectable", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // The sound card (genre + preset) should be visible
    const soundCard = page.getByRole("button", { name: /^SOUND/ });
    await expect(soundCard).toBeVisible();
  });

  test("lyrics toggle works", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // The LYRICS section is always visible (not collapsible) with a toggle switch
    const lyricsLabel = page.getByText("LYRICS", { exact: true });
    await expect(lyricsLabel).toBeVisible();
    const toggle = page.locator(".setup-toggle");
    await expect(toggle).toBeVisible();
  });
});
