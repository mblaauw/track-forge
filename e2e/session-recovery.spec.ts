import { test, expect } from "@playwright/test";
import { ForgePage } from "./pages/ForgePage";

test.describe("session recovery", () => {
  test("a fresh session starts on EDM with an arrangement", async ({
    page,
  }) => {
    const forge = new ForgePage(page);
    await forge.goto();

    await expect(forge.setupColumn.genreChip("edm")).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await expect(page.getByTestId("region-0")).toBeVisible();
    await expect(forge.contextBar.titleInput).not.toHaveValue("");
  });

  test("edits survive a reload", async ({ page }) => {
    const forge = new ForgePage(page);
    await forge.goto();

    await forge.contextBar.setTitle("Reload Survivor");
    await page.getByTestId("bpm-input").fill("111");
    // The session is written to storage on a short debounce.
    await page.waitForFunction(
      () => JSON.parse(localStorage.getItem("tf-session") ?? "{}").bpm === 111,
    );

    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(forge.contextBar.titleInput).toHaveValue("Reload Survivor");
    await expect(page.getByTestId("bpm-input")).toHaveValue("111");
  });

  test("the sessions menu opens, starts a new session, and closes", async ({
    page,
  }) => {
    const forge = new ForgePage(page);
    await forge.goto();
    await forge.contextBar.setTitle("About To Be Replaced");

    await forge.libraryPanel.open();
    await expect(forge.libraryPanel.searchInput).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(forge.libraryPanel.panel).toBeHidden();

    await forge.libraryPanel.clickNew();
    await expect(forge.libraryPanel.panel).toBeHidden();
    await expect(forge.contextBar.titleInput).not.toHaveValue(
      "About To Be Replaced",
    );
  });
});
