import { type Locator, type Page } from "@playwright/test";

/**
 * Page object for the RendersPanel (right sidebar showing takes).
 */
export class RendersPanel {
  readonly panel: Locator;
  readonly newTakeBtn: Locator;
  readonly rendersList: Locator;
  readonly emptyMessage: Locator;

  constructor(readonly page: Page) {
    this.panel = page.getByTestId("renders-panel");
    this.newTakeBtn = this.panel.getByRole("button", { name: /New take/ });
    this.rendersList = this.panel.locator(".renders-list");
    this.emptyMessage = this.panel.locator(".renders-empty");
  }

  /** Returns all take card locators. */
  takeCards(): Locator {
    return this.panel.locator('[data-testid^="take-card-"]');
  }

  /** Get a specific take card by its id. */
  takeCard(id: string): Locator {
    return this.panel.getByTestId(`take-card-${id}`);
  }

  /** Returns the play button for a specific take. */
  playButton(takeId: string): Locator {
    return this.panel.getByTestId(`play-btn-${takeId}`);
  }

  /** Count of visible take cards. */
  async takeCount(): Promise<number> {
    return await this.takeCards().count();
  }

  /** Wait for at least N take cards to appear. */
  async waitForTakes(count = 1, timeout = 10000): Promise<void> {
    await this.page.waitForFunction(
      ({ count }) => {
        const cards = document.querySelectorAll('[data-testid^="take-card-"]');
        return cards.length >= count;
      },
      { count },
      { timeout },
    );
  }

  /** Expand the right panel if it's collapsed. */
  async expandIfCollapsed(): Promise<void> {
    const rail = this.panel.locator(".col-rail.collapsed");
    if (await rail.isVisible().catch(() => false)) {
      await rail.click();
    }
  }
}
