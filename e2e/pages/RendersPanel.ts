import { type Locator, type Page } from "@playwright/test";

/** The takes list in the Output deck. */
export class RendersPanel {
  readonly panel: Locator;
  readonly newTakeBtn: Locator;
  readonly emptyMessage: Locator;
  readonly settingsBtn: Locator;

  constructor(readonly page: Page) {
    this.panel = page.getByTestId("renders-panel");
    this.newTakeBtn = this.panel.getByRole("button", { name: /New take/ });
    this.emptyMessage = this.panel.locator(".takes-empty");
    this.settingsBtn = page.getByTestId("take-settings");
  }

  takeCards(): Locator {
    return this.panel.locator('[data-testid^="take-card-"]');
  }

  takeCard(id: string): Locator {
    return this.panel.getByTestId(`take-card-${id}`);
  }

  playButton(takeId: string): Locator {
    return this.panel.getByTestId(`play-btn-${takeId}`);
  }

  async takeCount(): Promise<number> {
    return await this.takeCards().count();
  }

  async waitForTakes(count = 1, timeout = 10000): Promise<void> {
    await this.page.waitForFunction(
      ({ count }) =>
        document.querySelectorAll('[data-testid^="take-card-"]').length >=
        count,
      { count },
      { timeout },
    );
  }

  /** The takes list is always visible on a desktop viewport. */
  async expandIfCollapsed(): Promise<void> {}
}
