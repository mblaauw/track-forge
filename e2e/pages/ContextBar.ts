import { type Locator, type Page } from "@playwright/test";

/**
 * Page object for the ContextBar (top header with forge button, title, status).
 */
export class ContextBar {
  readonly forgeBtn: Locator;
  readonly titleInput: Locator;
  readonly statusDot: Locator;
  readonly statusText: Locator;
  readonly genreLabel: Locator;
  readonly titleGenBtn: Locator;

  constructor(readonly page: Page) {
    this.forgeBtn = page.getByTestId("forge-btn");
    this.titleInput = page.getByRole("textbox", { name: "Track title" });
    this.titleGenBtn = page.getByRole("button", { name: "Generate title" });
    // status dot and text are inside .ctx-status
    this.statusDot = page.locator(".ctx-status-dot");
    this.statusText = page.locator(".ctx-status-text");
    this.genreLabel = page.locator(".ctx-meta-genre");
  }

  /** Click forge and wait for the forge strip to appear (pipeline started). */
  async clickForge(): Promise<void> {
    await this.forgeBtn.click();
  }

  /** Set the track title. */
  async setTitle(title: string): Promise<void> {
    await this.titleInput.fill(title);
  }

  /** Returns true when the forge button is disabled (forging or no genre). */
  async isForgeDisabled(): Promise<boolean> {
    return await this.forgeBtn.isDisabled();
  }

  /** Wait until forge completes — forge strip disappears, transport bar appears. */
  async waitForForgeComplete(timeout = 15000): Promise<void> {
    // Forge strip appears during pipeline, then disappears when done
    const forgeStrip = this.page.getByTestId("forge-strip");
    await forgeStrip.waitFor({ state: "attached", timeout });
    // Wait for it to disappear (forge finished → transport bar shows)
    await forgeStrip.waitFor({ state: "detached", timeout });
  }

  /** Returns the status text (READY / FORGING). */
  async statusTextValue(): Promise<string> {
    return (await this.statusText.textContent()) ?? "";
  }
}
