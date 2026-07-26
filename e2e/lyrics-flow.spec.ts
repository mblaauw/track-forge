import { test, expect } from "@playwright/test";
import { ForgePage } from "./pages/ForgePage";

test.describe("Lyrics generation flow", () => {
  // Pipeline includes real LLM call + Suno dry-run — needs generous timeout
  test.setTimeout(120_000);
  test("Hip-Hop vocal: forge with lyric topic generates lyrics in version artifacts", async ({
    page,
    request,
  }) => {
    const forge = new ForgePage(page);
    await forge.goto();

    // ── Setup: Hip-Hop + Boom Bap Classic (full_lyrics preset) ──────
    await forge.setupColumn.selectGenre("hiphop");
    await forge.setupColumn.selectPresetById("boom_bap_classic");
    await forge.setupColumn.setLyricTopic(
      "late-night drive through neon-lit streets after a breakup",
    );

    // ── Forge ───────────────────────────────────────────────────────
    await forge.contextBar.clickForge();

    const forgeStrip = page.getByTestId("forge-strip");
    await expect(forgeStrip).toBeVisible({ timeout: 5000 });
    // Pipeline runs — LLM is called for real. Generous 40s timeout
    // for model + Suno dry-run to complete.
    await forgeStrip.waitFor({ state: "detached", timeout: 90_000 });

    // Status should reflect completion
    await expect(forge.contextBar.statusText).toHaveText("READY");

    // ── Extract job ID from session storage ─────────────────────────
    const jobId = await page.evaluate(() => {
      const raw = localStorage.getItem("tf-session");
      if (!raw) return null;
      return JSON.parse(raw).jobId;
    });
    expect(jobId).toBeTruthy();

    // ── Fetch version and verify lyrics artifact ────────────────────
    const versionsResp = await request.get(`/api/jobs/${jobId}/versions`);
    expect(versionsResp.ok()).toBeTruthy();
    const versions = await versionsResp.json();
    expect(versions.length).toBeGreaterThanOrEqual(1);

    const latest = versions[0];
    const artifacts: Array<{ type: string; value: string }> =
      typeof latest.artifacts === "string"
        ? JSON.parse(latest.artifacts)
        : latest.artifacts;

    // Title should be present
    const titleArtifact = artifacts.find(
      (a: { type: string }) => a.type === "title",
    );
    expect(titleArtifact).toBeTruthy();
    expect(titleArtifact!.value).toBeTruthy();

    // Lyrics should be present and non-empty
    const lyricsArtifact = artifacts.find(
      (a: { type: string }) => a.type === "lyrics",
    );
    expect(lyricsArtifact).toBeTruthy();
    expect(lyricsArtifact!.value).toBeTruthy();
    expect(lyricsArtifact!.value.length).toBeGreaterThan(0);

    // Should contain Suno bracket section markers
    expect(lyricsArtifact!.value).toMatch(/\[.*\]/);
  });

  test("EDM vocal: forge with lyric topic generates lyrics in version artifacts", async ({
    page,
    request,
  }) => {
    const forge = new ForgePage(page);
    await forge.goto();

    // ── Setup: EDM + Dance-Pop Catchy (full_lyrics preset) ─────────
    await forge.setupColumn.selectGenre("edm");
    await forge.setupColumn.selectPresetById("dance_pop_catchy");
    await forge.setupColumn.setLyricTopic(
      "dancing under the strobe lights at a crowded festival",
    );

    // ── Forge ───────────────────────────────────────────────────────
    await forge.contextBar.clickForge();

    const forgeStrip = page.getByTestId("forge-strip");
    await expect(forgeStrip).toBeVisible({ timeout: 5000 });
    await forgeStrip.waitFor({ state: "detached", timeout: 90_000 });

    await expect(forge.contextBar.statusText).toHaveText("READY");

    // ── Extract job ID from session storage ─────────────────────────
    const jobId = await page.evaluate(() => {
      const raw = localStorage.getItem("tf-session");
      if (!raw) return null;
      return JSON.parse(raw).jobId;
    });
    expect(jobId).toBeTruthy();

    // ── Fetch version and verify lyrics artifact ────────────────────
    const versionsResp = await request.get(`/api/jobs/${jobId}/versions`);
    expect(versionsResp.ok()).toBeTruthy();
    const versions = await versionsResp.json();
    expect(versions.length).toBeGreaterThanOrEqual(1);

    const latest = versions[0];
    const artifacts: Array<{ type: string; value: string }> =
      typeof latest.artifacts === "string"
        ? JSON.parse(latest.artifacts)
        : latest.artifacts;

    const titleArtifact = artifacts.find(
      (a: { type: string }) => a.type === "title",
    );
    expect(titleArtifact).toBeTruthy();
    expect(titleArtifact!.value).toBeTruthy();

    const lyricsArtifact = artifacts.find(
      (a: { type: string }) => a.type === "lyrics",
    );
    expect(lyricsArtifact).toBeTruthy();
    expect(lyricsArtifact!.value).toBeTruthy();
    expect(lyricsArtifact!.value.length).toBeGreaterThan(0);

    expect(lyricsArtifact!.value).toMatch(/\[.*\]/);
  });
});
