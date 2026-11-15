import { test, expect } from "@playwright/test";
import { ForgePage } from "./pages/ForgePage";

test.describe("Hip-Hop vocal forge", () => {
  test("a vocal preset turns vocals on and shows the lyric brief", async ({
    page,
  }) => {
    const forge = new ForgePage(page);
    await forge.goto();
    await forge.setupColumn.selectGenre("hiphop");
    await forge.setupColumn.selectPresetById("boom_bap_classic");

    await expect(forge.setupColumn.vocalsSwitch).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await expect(forge.setupColumn.lyricTopic).toBeVisible();

    // The lyrics that will be sent carry a tag for every section.
    await page.getByTestId("readout-tab-lyrics").click();
    await expect(page.getByTestId("readout-text")).toContainText("[Verse");
  });

  test("turning vocals off makes the song instrumental", async ({ page }) => {
    const forge = new ForgePage(page);
    await forge.goto();
    await forge.setupColumn.selectGenre("hiphop");
    await forge.setupColumn.selectPresetById("boom_bap_classic");

    await forge.setupColumn.toggleLyrics();
    await expect(forge.setupColumn.vocalsSwitch).toHaveAttribute(
      "aria-checked",
      "false",
    );
    await expect(forge.setupColumn.lyricTopic).toBeHidden();

    await page.getByTestId("readout-tab-lyrics").click();
    await expect(page.getByTestId("readout-text")).toContainText(
      "No lyrics are sent",
    );
    await page.getByTestId("readout-tab-avoid").click();
    await expect(page.getByTestId("readout-text")).toContainText("vocals");
  });
});
