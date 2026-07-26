import { test, expect } from "@playwright/test";

test.describe("Ambient forge", () => {
  test("page loads and preset selector works", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // The PRESET section should be present
    const presetSection = page.getByText("PRESET");
    await expect(presetSection).toBeVisible();
  });

  test("BPM controls are interactive", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // BPM input should be visible in the ARRANGEMENT STRUCTURE header
    const bpmInput = page.locator(".arr-bpm-input");
    await expect(bpmInput).toBeVisible();
  });
});
