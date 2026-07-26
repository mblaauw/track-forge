import { test, expect } from "@playwright/test";
import { ForgePage } from "./pages/ForgePage";

test.describe("Full forge flow", () => {
  test("EDM instrumental: forge → pipeline completes → takes appear", async ({
    page,
  }) => {
    const forge = new ForgePage(page);
    await forge.goto();

    // ── Setup phase ────────────────────────────────────────────────────
    // Default state: EDM genre, instrumental mode
    await expect(forge.setupColumn.soundCard).toBeVisible();
    await expect(forge.setupColumn.soundCard).toContainText("EDM");

    // Forge button should be ready
    await expect(forge.contextBar.forgeBtn).toBeVisible();
    await expect(forge.contextBar.forgeBtn).not.toBeDisabled();

    // ── Forge phase ─────────────────────────────────────────────────────
    await forge.contextBar.clickForge();

    // Forge strip should appear (pipeline running)
    const forgeStrip = page.getByTestId("forge-strip");
    await expect(forgeStrip).toBeVisible({ timeout: 5000 });

    // Forge button should now be disabled and show "Forging…"
    await expect(forge.contextBar.forgeBtn).toBeDisabled();
    await expect(forge.contextBar.forgeBtn).toContainText(/Forging/);

    // Status should indicate FORGING
    await expect(forge.contextBar.statusText).toHaveText("FORGING");

    // ── Completion phase ────────────────────────────────────────────────
    // Wait for forge strip to disappear (pipeline completed)
    await forgeStrip.waitFor({ state: "detached", timeout: 20000 });

    // Forge button should be re-enabled
    await expect(forge.contextBar.forgeBtn).not.toBeDisabled();
    await expect(forge.contextBar.forgeBtn).not.toContainText(/Forging/);
    await expect(forge.contextBar.statusText).toHaveText("READY");

    // Transport bar with play controls should be visible (takes present)
    const transportBar = page.locator(".transport-bar");
    await expect(transportBar).toBeVisible({ timeout: 5000 });

    // ── Takes verification ──────────────────────────────────────────────
    // RendersPanel should show at least 1 take
    await forge.rendersPanel.expandIfCollapsed();
    const takeCount = await forge.rendersPanel.takeCount();
    expect(takeCount).toBeGreaterThanOrEqual(1);

    // Each take card should have a play button
    const cards = forge.rendersPanel.takeCards();
    const firstCard = cards.first();
    await expect(firstCard).toBeVisible();
    // Play button inside the card should be visible
    const playBtn = firstCard.locator('[data-testid^="play-btn-"]');
    await expect(playBtn).toBeVisible();
  });

  test("status indicators update correctly through forge lifecycle", async ({
    page,
  }) => {
    const forge = new ForgePage(page);
    await forge.goto();

    // Initial: READY
    await expect(forge.contextBar.statusText).toHaveText("READY");

    // Click forge
    await forge.contextBar.clickForge();

    // During: FORGING
    await expect(forge.contextBar.statusText).toHaveText("FORGING");

    // Wait for completion
    await forge.contextBar.waitForForgeComplete(20000);

    // After: READY again
    await expect(forge.contextBar.statusText).toHaveText("READY");
  });
});
