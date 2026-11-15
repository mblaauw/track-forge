import { type Locator, type Page } from "@playwright/test";

/** The sessions menu, opened from the top bar. */
export class LibraryPanel {
  readonly button: Locator;
  readonly panel: Locator;
  readonly newBtn: Locator;
  readonly searchInput: Locator;

  constructor(readonly page: Page) {
    this.button = page.getByTestId("sessions-button");
    this.panel = page.getByTestId("library-panel");
    this.newBtn = page.getByTestId("new-session");
    this.searchInput = page.getByTestId("session-search");
  }

  async open(): Promise<void> {
    if (!(await this.panel.isVisible().catch(() => false))) {
      await this.button.click();
      await this.panel.waitFor();
    }
  }

  /** Kept for older specs: opening the menu is the equivalent. */
  async expandIfCollapsed(): Promise<void> {
    await this.open();
  }

  rows(): Locator {
    return this.panel.locator('[data-testid^="library-row-"]');
  }

  row(jobId: string): Locator {
    return this.panel.getByTestId(`library-row-${jobId}`);
  }

  async rowCount(): Promise<number> {
    await this.open();
    return await this.rows().count();
  }

  async loadSession(jobId: string): Promise<void> {
    await this.open();
    await this.row(jobId).click();
  }

  async clickNew(): Promise<void> {
    await this.open();
    await this.newBtn.click();
  }

  async search(query: string): Promise<void> {
    await this.open();
    await this.searchInput.fill(query);
  }
}
