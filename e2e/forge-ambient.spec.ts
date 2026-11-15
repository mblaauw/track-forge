import { test, expect } from "@playwright/test";
import { ForgePage } from "./pages/ForgePage";

test.describe("Ambient forge", () => {
  test("choosing a preset updates the sound and the arrangement", async ({
    page,
  }) => {
    const forge = new ForgePage(page);
    await forge.goto();
    await forge.setupColumn.selectGenre("ambient");

    await forge.setupColumn.presetPicker.click();
    const options = forge.setupColumn.presetList.getByRole("button");
    expect(await options.count()).toBeGreaterThan(1);

    // Each option carries its description, not just a name.
    const second = options.nth(1);
    const name = (await second.locator(".option-name").textContent())!;
    await expect(second.locator(".option-desc")).not.toBeEmpty();
    await second.click();

    await expect(forge.setupColumn.presetPicker).toContainText(name);
    await expect(page.getByTestId("region-0")).toBeVisible();
  });

  test("a tempo can be typed digit by digit", async ({ page }) => {
    const forge = new ForgePage(page);
    await forge.goto();

    // Typing passes through out-of-range values ("9", then "95"); they
    // must not be clamped while the user is still typing.
    const tempo = page.getByTestId("bpm-input");
    await tempo.click();
    await tempo.press("ControlOrMeta+a");
    await tempo.pressSequentially("95");
    await expect(tempo).toHaveValue("95");
    await tempo.blur();
    await expect(tempo).toHaveValue("95");

    // Out of range is tidied up when the field is left.
    await tempo.fill("999");
    await tempo.blur();
    await expect(tempo).toHaveValue("200");
  });

  test("tempo changes the length of the song", async ({ page }) => {
    const forge = new ForgePage(page);
    await forge.goto();

    const tempo = page.getByTestId("bpm-input");
    const length = page.getByTestId("arrangement-duration");
    await tempo.fill("60");
    const slow = await length.textContent();
    await tempo.fill("180");
    await expect(length).not.toHaveText(slow!);
  });
});
