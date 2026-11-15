import { type Locator, type Page } from "@playwright/test";

/**
 * The Sound zone (genre, preset, character) and the lyric brief that sits
 * with the Lyrics panel in the Song zone.
 */
export class SetupColumn {
  readonly panel: Locator;
  readonly presetPicker: Locator;
  readonly presetList: Locator;
  readonly vocalsSwitch: Locator;
  readonly lyricTopic: Locator;

  constructor(readonly page: Page) {
    this.panel = page.locator(".zone-sound");
    this.presetPicker = page.getByTestId("preset-picker");
    this.presetList = page.getByTestId("preset-list");
    this.vocalsSwitch = page.getByTestId("vocals-switch");
    this.lyricTopic = page.getByTestId("lyric-topic-input");
  }

  genreChip(genreId: string): Locator {
    return this.page.getByTestId(`genre-chip-${genreId}`);
  }

  /** Choose a genre and wait for its first preset to be applied. */
  async selectGenre(genreId: string): Promise<void> {
    const chip = this.genreChip(genreId);
    if ((await chip.getAttribute("aria-checked")) === "true") return;
    await chip.click();
    await this.page.getByTestId("region-0").waitFor();
  }

  async isGenreActive(genreId: string): Promise<boolean> {
    return (
      (await this.genreChip(genreId).getAttribute("aria-checked")) === "true"
    );
  }

  /** Open the preset picker and choose a preset by its visible name. */
  async selectPreset(presetName: string): Promise<void> {
    await this.presetPicker.click();
    await this.presetList.getByRole("button", { name: presetName }).click();
  }

  async selectPresetById(presetId: string): Promise<void> {
    await this.presetPicker.click();
    await this.page.getByTestId(`preset-${presetId}`).click();
  }

  /** Turn vocals on if they are off. */
  async enableVocals(): Promise<void> {
    if ((await this.vocalsSwitch.getAttribute("aria-checked")) !== "true") {
      await this.vocalsSwitch.click();
    }
  }

  /** Fill the lyric brief; turns vocals on first if needed. */
  async setLyricTopic(topic: string): Promise<void> {
    await this.enableVocals();
    await this.lyricTopic.fill(topic);
  }

  async toggleLyrics(): Promise<void> {
    await this.vocalsSwitch.click();
  }
}
