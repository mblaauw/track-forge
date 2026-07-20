import { test, expect } from "@playwright/test";

test.describe("import/export", () => {
  test("page loads with forge button accessible", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // The forge button should be present (exact match)
    const forgeButton = page.getByRole("button", { name: "Forge" });
    await expect(forgeButton).toBeVisible();
  });
});
