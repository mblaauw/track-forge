import { type Page } from "@playwright/test";
import { ContextBar } from "./ContextBar";
import { SetupColumn } from "./SetupColumn";
import { RendersPanel } from "./RendersPanel";
import { LibraryPanel } from "./LibraryPanel";

/**
 * Top-level page object for the Track Forge composer page.
 * Provides typed access to all UI regions.
 */
export class ForgePage {
  readonly contextBar: ContextBar;
  readonly setupColumn: SetupColumn;
  readonly rendersPanel: RendersPanel;
  readonly libraryPanel: LibraryPanel;

  constructor(readonly page: Page) {
    this.contextBar = new ContextBar(page);
    this.setupColumn = new SetupColumn(page);
    this.rendersPanel = new RendersPanel(page);
    this.libraryPanel = new LibraryPanel(page);
  }

  /** Navigate to the forge page and wait for it to load. */
  async goto(): Promise<void> {
    await this.page.goto("/");
    await this.page.waitForLoadState("networkidle");
  }

  /**
   * Full forge flow: navigate, verify setup, forge, wait for completion.
   * Assumes EDM genre (default). Returns when takes are visible.
   */
  async forgeInstrumental(timeout = 20000): Promise<void> {
    await this.contextBar.clickForge();
    // Wait for pipeline progress strip to appear then disappear
    await this.contextBar.waitForForgeComplete(timeout);
    // Wait for takes to appear in the renders panel
    await this.rendersPanel.expandIfCollapsed();
    await this.rendersPanel.waitForTakes(1, timeout);
  }
}
