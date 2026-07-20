import { test, expect } from "@playwright/test";

test.describe("EDM instrumental forge", () => {
  test("page loads and forge button is visible", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // The forge button should be present as a single element
    const forgeButton = page.getByRole("button", { name: "Forge" });
    await expect(forgeButton).toBeVisible();
  });

  test("Setup column shows genre selector", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // The GENRE card summary should show EDM as default
    const genreCard = page.getByRole("button", { name: /^GENRE/ });
    await expect(genreCard).toBeVisible();
    await expect(genreCard).toContainText("EDM");
  });

  test("descriptor card is present and toggleable", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // The DESCRIPTORS card toggle should be visible
    const descCard = page.getByRole("button", { name: /^DESCRIPTORS/ });
    await expect(descCard).toBeVisible();

    // Toggling should not crash
    await descCard.click();
  });
});
