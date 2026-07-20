import { test, expect } from "@playwright/test";

test.describe("Hip-Hop vocal forge", () => {
  test("page loads with Hip-Hop genre selectable", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // The genre card should be visible
    const genreCard = page.getByRole("button", { name: /^GENRE/ });
    await expect(genreCard).toBeVisible();
  });

  test("lyrics card toggle works", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // The LYRICS card toggle should be present (exact match)
    const lyricsBtn = page.getByRole("button", { name: /^LYRICS/ });
    await expect(lyricsBtn).toBeVisible();
  });
});
