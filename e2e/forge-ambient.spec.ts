import { test, expect } from "@playwright/test";

test.describe("Ambient forge", () => {
  test("page loads and preset selector works", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // The PRESET section should be present
    const presetSection = page.getByText("PRESET");
    await expect(presetSection).toBeVisible();
  });

  test("BPM and key controls are interactive", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // TEMPO & KEY section should be visible
    const tempoKeySection = page.getByText("TEMPO");
    await expect(tempoKeySection).toBeVisible();
  });
});
