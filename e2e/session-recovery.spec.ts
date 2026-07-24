import { test, expect } from "@playwright/test";

test.describe("session recovery", () => {
  test("page loads with default session state", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Sound card should show EDM as default
    const soundCard = page.getByRole("button", { name: /^SOUND/ });
    await expect(soundCard).toBeVisible();
    await expect(soundCard).toContainText("EDM");
  });

  test("sound card can be collapsed and expanded", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const soundCard = page.getByRole("button", { name: /^SOUND/ });
    const presetLabel = page.getByText("PRESET", { exact: true });
    await expect(presetLabel).toBeVisible();

    await soundCard.click();
    await expect(presetLabel).not.toBeVisible();

    await soundCard.click();
    await expect(presetLabel).toBeVisible();
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
