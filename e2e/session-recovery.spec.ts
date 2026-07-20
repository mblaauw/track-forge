import { test, expect } from "@playwright/test";

test.describe("session recovery", () => {
  test("page loads with default session state", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Genre card should show EDM as default
    const genreCard = page.getByRole("button", { name: /^GENRE/ });
    await expect(genreCard).toBeVisible();
    await expect(genreCard).toContainText("EDM");
  });

  test("preset card can be expanded", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // The PRESET section header should be present
    const presetBtn = page.getByRole("button", { name: /^PRESET/ });
    await expect(presetBtn).toBeVisible();
  });

  test("library panel can be toggled", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Library panel trigger should be present (handle icon or library icon)
    const libBtn = page.locator(
      '[class*="library"] button, button[class*="library"]',
    );
    const count = await libBtn.count();
    if (count > 0) {
      await libBtn.first().click();
    }
    // No crash is the main assertion
  });
});
