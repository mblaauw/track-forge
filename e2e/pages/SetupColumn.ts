import { type Locator, type Page } from "@playwright/test";

/**
 * Page object for the SetupColumn (left sidebar with genre/preset/descriptors).
 */
export class SetupColumn {
  readonly panel: Locator;
  readonly soundCard: Locator;
  readonly descriptorsCard: Locator;
  readonly referenceCard: Locator;
  readonly lyricsSection: Locator;
  readonly lyricsToggle: Locator;

  constructor(readonly page: Page) {
    this.panel = page.locator(".setup-col, .col-rail");
    this.soundCard = page.getByRole("button", { name: /^SOUND/ });
    this.descriptorsCard = page.getByRole("button", { name: /^DESCRIPTORS/ });
    this.referenceCard = page.getByRole("button", { name: /^REFERENCE/ });
    this.lyricsSection = page.getByText("LYRICS", { exact: true });
    this.lyricsToggle = page.locator(".setup-toggle");
  }

  /** Click a genre chip by its genre id. */
  async selectGenre(genreId: string): Promise<void> {
    await this.page.getByTestId(`genre-chip-${genreId}`).click();
  }

  /** Returns true if the genre chip has the "active" class. */
  async isGenreActive(genreId: string): Promise<boolean> {
    const chip = this.page.getByTestId(`genre-chip-${genreId}`);
    const cls = await chip.getAttribute("class");
    return cls?.includes("active") ?? false;
  }

  /** Click a preset from the preset list by name. */
  async selectPreset(presetName: string): Promise<void> {
    await this.page
      .locator(".setup-select-list")
      .getByRole("button", { name: presetName })
      .click();
  }

  /** Click a preset by its data-testid. */
  async selectPresetById(presetId: string): Promise<void> {
    await this.page.getByTestId(`preset-${presetId}`).click();
  }

  /** Set the lyric topic text. */
  async setLyricTopic(topic: string): Promise<void> {
    await this.page.getByTestId("lyric-topic-input").fill(topic);
  }

  /** Toggle the lyrics mode (instrumental/vocal). */
  async toggleLyrics(): Promise<void> {
    await this.lyricsToggle.click();
  }

  /** Expand the left panel if collapsed. */
  async expandIfCollapsed(): Promise<void> {
    const rail = this.page.locator(".col-rail.collapsed");
    if (await rail.isVisible().catch(() => false)) {
      await rail.click();
    }
  }
}
