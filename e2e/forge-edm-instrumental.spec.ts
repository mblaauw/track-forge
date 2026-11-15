import { test, expect } from "@playwright/test";
import { ForgePage } from "./pages/ForgePage";

test.describe("EDM instrumental forge", () => {
  test("opens on EDM, instrumental, ready to forge", async ({ page }) => {
    const forge = new ForgePage(page);
    await forge.goto();

    await expect(forge.setupColumn.genreChip("edm")).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await expect(forge.setupColumn.vocalsSwitch).toHaveAttribute(
      "aria-checked",
      "false",
    );
    await expect(forge.contextBar.forgeBtn).toBeEnabled();
    await expect(forge.contextBar.statusText).toHaveText("Ready");
  });

  test("the style prompt is shown and follows the character traits", async ({
    page,
  }) => {
    const forge = new ForgePage(page);
    await forge.goto();

    const readout = page.getByTestId("readout-text");
    await expect(readout).toContainText("EDM");
    await expect(readout).toContainText("structure:");

    // Add a trait that is off by default; it appears in the prompt.
    const trait = page.getByRole("button", { name: "cinematic: off" });
    await trait.click();
    await expect(readout).toContainText("cinematic");
    await expect(
      page.getByRole("button", { name: "cinematic: a touch" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  test("a section can be selected, resized and removed with undo", async ({
    page,
  }) => {
    const forge = new ForgePage(page);
    await forge.goto();

    const regions = page.locator('[data-testid^="region-"]');
    const before = await regions.count();
    await page.getByTestId("region-1").click();
    await expect(page.getByTestId("region-1")).toHaveAttribute(
      "aria-selected",
      "true",
    );

    const length = page.getByTestId("arrangement-duration");
    const original = await length.textContent();
    await page.getByRole("button", { name: "Lengthen by 4 bars" }).click();
    await expect(length).not.toHaveText(original!);

    await page.getByRole("button", { name: "Remove", exact: true }).click();
    await expect(regions).toHaveCount(before - 1);
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(regions).toHaveCount(before);
  });

  test("the timeline can be worked from the keyboard", async ({ page }) => {
    const forge = new ForgePage(page);
    await forge.goto();

    const names = () =>
      page.locator('[data-testid^="region-"] .region-name').allTextContents();
    const before = await names();

    await page.getByTestId("region-0").click();
    await page.keyboard.press("ArrowRight");
    // Selection and focus move together.
    await expect(page.getByTestId("region-1")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByTestId("region-1")).toBeFocused();

    // Alt + arrow moves the section; focus stays with it.
    await page.keyboard.press("Alt+ArrowRight");
    const moved = await names();
    expect(moved[2]).toBe(before[1]);
    expect(moved[1]).toBe(before[2]);
    await expect(page.getByTestId("region-2")).toBeFocused();

    // Delete removes it, and focus stays on the timeline.
    await page.keyboard.press("Delete");
    await expect(page.locator('[data-testid^="region-"]')).toHaveCount(
      before.length - 1,
    );
    await expect(
      page.locator('[data-testid^="region-"][aria-selected="true"]'),
    ).toBeFocused();
  });

  test("genre is a radio group with arrow-key selection", async ({ page }) => {
    const forge = new ForgePage(page);
    await forge.goto();

    await forge.setupColumn.genreChip("edm").focus();
    await page.keyboard.press("ArrowRight");
    await expect(forge.setupColumn.genreChip("hiphop")).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await expect(forge.setupColumn.genreChip("hiphop")).toBeFocused();
    // The new genre brings its own arrangement.
    await expect(page.getByTestId("region-0")).toBeVisible();
  });
});
