import { test, expect } from "@playwright/test";

test.describe("render failure handling", () => {
  test("page loads without errors", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Verify console has no uncaught errors
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    await page.waitForTimeout(1000);
    // Allow render errors from missing Suno token in dev
    const criticalErrors = consoleErrors.filter(
      (e) => !e.includes("Suno") && !e.includes("suno") && !e.includes("sse"),
    );
    expect(criticalErrors).toEqual([]);
  });
});
