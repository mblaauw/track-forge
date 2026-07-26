import { type Locator, type Page } from "@playwright/test";

/**
 * Page object for the LibraryPanel (left-right panel showing saved jobs).
 */
export class LibraryPanel {
  readonly panel: Locator;
  readonly newBtn: Locator;
  readonly searchInput: Locator;

  constructor(readonly page: Page) {
    this.panel = page.getByTestId("library-panel");
    this.newBtn = this.panel.getByRole("button", { name: "New" });
    this.searchInput = this.panel.locator(".library-search");
  }

  /** Returns all library row locators. */
  rows(): Locator {
    return this.panel.locator('[data-testid^="library-row-"]');
  }

  /** Get a specific library row by job id. */
  row(jobId: string): Locator {
    return this.panel.getByTestId(`library-row-${jobId}`);
  }

  /** Row count. */
  async rowCount(): Promise<number> {
    return await this.rows().count();
  }

  /** Click a library row to load that session. */
  async loadSession(jobId: string): Promise<void> {
    await this.row(jobId).click();
  }

  /** Expand the library panel if collapsed. */
  async expandIfCollapsed(): Promise<void> {
    const rail = this.panel.locator(".col-rail.collapsed");
    if (await rail.isVisible().catch(() => false)) {
      await rail.click();
    }
  }

  /** Click New button to reset session. */
  async clickNew(): Promise<void> {
    await this.newBtn.click();
  }

  /** Search library by name. */
  async search(query: string): Promise<void> {
    await this.searchInput.fill(query);
  }
}
