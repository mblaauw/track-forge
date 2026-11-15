import { type Locator, type Page } from "@playwright/test";

/**
 * The session title in the top bar, and the forge control at the top of
 * the Output deck (status, Forge button, progress).
 */
export class ContextBar {
  readonly forgeBtn: Locator;
  readonly titleInput: Locator;
  readonly statusText: Locator;
  readonly titleGenBtn: Locator;
  readonly forgeError: Locator;

  constructor(readonly page: Page) {
    this.forgeBtn = page.getByTestId("forge-btn");
    this.titleInput = page.getByRole("textbox", { name: "Track title" });
    this.titleGenBtn = page.getByRole("button", { name: "Generate title" });
    this.statusText = page.getByTestId("forge-status");
    this.forgeError = page.getByTestId("forge-error");
  }

  async clickForge(): Promise<void> {
    await this.forgeBtn.click();
  }

  async setTitle(title: string): Promise<void> {
    await this.titleInput.fill(title);
  }

  async isForgeDisabled(): Promise<boolean> {
    return await this.forgeBtn.isDisabled();
  }

  /** Wait until the forge finishes — the progress list appears, then goes. */
  async waitForForgeComplete(timeout = 15000): Promise<void> {
    const progress = this.page.getByTestId("forge-strip");
    await progress.waitFor({ state: "attached", timeout });
    await progress.waitFor({ state: "detached", timeout });
  }

  /** "Ready", "Forging" or "Failed". */
  async statusTextValue(): Promise<string> {
    return ((await this.statusText.textContent()) ?? "").trim();
  }
}
