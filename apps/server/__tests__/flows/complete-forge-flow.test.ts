/**
 * Complete Forge → Take → Render flow integration test.
 *
 * Covers:
 *   1. Health check
 *   2. List genres
 *   3. Create an instrumental job (EDM deep_house_chill)
 *   4. Get job by ID
 *   5. Start pipeline → wait for completion
 *   6. List versions after pipeline
 *   7. Get version
 *   8. Create take (with SUNO_DRY_RUN semantics)
 *   9. List takes
 *  10. Toggle take favorite
 *  11. List event history
 *  12. Delete job
 *
 * Run: npx vitest run apps/server/__tests__/flows/complete-forge-flow.test.ts
 */

import { describe, it, expect } from "vitest";
import { createServerEngine } from "./create-server-engine.js";

// Minimal helper to avoid implicit-any warnings
interface Artifact {
  type: string;
  value?: unknown;
}

// ── Timeout for pipeline processing ────────────────────────────────────────

const PIPELINE_TIMEOUT = 15_000;

describe("Complete Forge → Take → Render flow (instrumental)", () => {
  it(
    "runs the full flow end-to-end",
    async () => {
      const engine = await createServerEngine("forge-take-render");

      try {
        // ── 1. Health check ────────────────────────────────────────────
        const health = await engine.api.health();
        expect(health.status).toBe(200);
        expect(health.body.status).toBe("ok");
        expect(health.body.timestamp).toBeDefined();
        engine.log.info("Health check passed");

        // ── 2. List genres ─────────────────────────────────────────────
        const genres = await engine.api.listGenres();
        expect(genres.status).toBe(200);
        expect(genres.body.length).toBeGreaterThanOrEqual(2);
        const edm = genres.body.find((g: { id: string }) => g.id === "edm");
        expect(edm).toBeDefined();
        engine.log.info("Genres listed", { count: genres.body.length });

        // ── 3. Create an instrumental job ──────────────────────────────
        const createRes = await engine.api.createJob({
          genreId: "edm",
          presetId: "deep_house_chill",
          inputs: {
            family: "house",
            subgenre: "deep_house",
            bpm: 120,
            key: "auto",
            scale: "minor",
            mood: "warm",
            energy: 6,
            complexity: 5,
            lyricsMode: "strict_instrumental",
            customTags: [],
          },
        });
        expect(createRes.status).toBe(201);
        expect(createRes.body.id).toBeDefined();
        expect(createRes.body.genreId).toBe("edm");
        expect(createRes.body.status).toBe("pending");
        const jobId = createRes.body.id;
        engine.log.info("Job created", { jobId });

        // ── 4. Get job by ID ───────────────────────────────────────────
        const getRes = await engine.api.getJob(jobId);
        expect(getRes.status).toBe(200);
        expect(getRes.body.id).toBe(jobId);
        expect(getRes.body.genreId).toBe("edm");

        // ── 5. Start pipeline ──────────────────────────────────────────
        const startRes = await engine.api.startPipeline(jobId);
        expect(startRes.status).toBe(202);
        expect(startRes.body.status).toBe("started");
        engine.log.info("Pipeline started");

        // Wait for pipeline to complete (poll job status)
        let jobStatus = "";
        const deadline = Date.now() + PIPELINE_TIMEOUT;
        while (Date.now() < deadline) {
          const poll = await engine.api.getJob(jobId);
          jobStatus = poll.body.status;
          if (jobStatus === "completed" || jobStatus === "failed") break;
          await new Promise((r) => setTimeout(r, 200));
        }
        expect(jobStatus).toBe("completed");
        engine.log.info("Pipeline completed");

        // ── 6. List versions ───────────────────────────────────────────
        const versions = await engine.api.listVersions(jobId);
        expect(versions.status).toBe(200);
        expect(versions.body.length).toBeGreaterThanOrEqual(1);
        const version = versions.body[0]!;
        expect(version.jobId).toBe(jobId);
        // Pipeline sets version status to "final" directly (versioning stage)
        expect(version.status).toBe("final");
        engine.log.info("Versions listed", { count: versions.body.length });

        // ── 7. Get version ─────────────────────────────────────────────
        const getVersionRes = await engine.api.getVersion(version.id);
        expect(getVersionRes.status).toBe(200);
        expect(getVersionRes.body.id).toBe(version.id);

        // ── 8. Create take (trigger Suno dry-run) ──────────────────────
        const takeRes = await engine.api.createTake(version.id);
        expect(takeRes.status).toBe(201);
        expect(takeRes.body.id).toBeDefined();
        expect(takeRes.body.status).toBe("completed"); // SUNO_DRY_RUN via mock
        const generationId = takeRes.body.id;
        engine.log.info("Take created", { generationId });

        // ── 9. List takes ──────────────────────────────────────────────
        const takes = await engine.api.listTakes(version.id);
        expect(takes.status).toBe(200);
        expect(takes.body.length).toBeGreaterThanOrEqual(1);
        const take = takes.body.find(
          (t: { id: string }) => t.id === generationId,
        );
        expect(take).toBeDefined();
        expect(take!.status).toBe("completed");
        expect(take!.tracks).toBeDefined();
        expect(take!.tracks!.length).toBeGreaterThanOrEqual(1);
        engine.log.info("Takes listed", { count: takes.body.length });

        // ── 10. Toggle take favorite ───────────────────────────────────
        const favRes = await engine.api.toggleTakeFavorite(generationId);
        expect(favRes.status).toBe(200);
        expect(favRes.body.isFavorite).toBe(true);

        const unfavRes = await engine.api.toggleTakeFavorite(generationId);
        expect(unfavRes.status).toBe(200);
        expect(unfavRes.body.isFavorite).toBe(false);
        engine.log.info("Take favorite toggled");

        // ── 11. List event history ─────────────────────────────────────
        const events = await engine.api.getEventHistory(jobId);
        expect(events.status).toBe(200);
        expect(events.body.length).toBeGreaterThanOrEqual(3); // compilation, lyrics_writing (skipped), versioning
        engine.log.info("Events listed", { count: events.body.length });

        // ── 12. Rename job ─────────────────────────────────────────────
        const renameRes = await engine.api.renameJob(jobId, "Renamed Test Job");
        expect(renameRes.status).toBe(200);
        expect(renameRes.body.name).toBe("Renamed Test Job");

        // ── 13. Delete job ─────────────────────────────────────────────
        const delRes = await engine.api.deleteJob(jobId);
        expect(delRes.status).toBe(204);

        const notFound = await engine.api.getJob(jobId);
        expect(notFound.status).toBe(404);
        engine.log.info("Job deleted and verified");
      } finally {
        await engine.cleanup();
      }
    },
    PIPELINE_TIMEOUT + 5_000,
  );
});

describe("Complete Forge → Take → Render flow (vocal lyrics)", () => {
  it(
    "runs the full flow with lyrics generation",
    async () => {
      const engine = await createServerEngine("forge-vocal-flow");

      try {
        // ── Create a vocal job (hiphop with full_lyrics) ──────────────
        const createRes = await engine.api.createJob({
          genreId: "hiphop",
          presetId: "boom_bap_classic",
          inputs: {
            subgenre: "boom_bap",
            bpm: 90,
            key: "C",
            scale: "minor",
            mood: "confident",
            narrativeArc: "braggadocio",
            rhymeStyle: "end_rhyme",
            flowPattern: "laid_back",
            delivery: "conversational",
            productionStyle: "polished",
            energy: 6,
            complexity: 5,
            lyricsMode: "full_lyrics",
            customTags: "",
            reference: "",
            sections: [
              {
                id: "section-1",
                name: "Verse",
                fn: "introduce",
                bars: 16,
                deltas: ["vocal focus", "building"],
              },
              {
                id: "section-2",
                name: "Hook",
                fn: "peak",
                bars: 8,
                deltas: ["catchy", "full arrangement", "climactic"],
              },
            ],
          },
        });
        expect(createRes.status).toBe(201);
        const jobId = createRes.body.id;
        engine.log.info("Vocal job created", { jobId });

        // ── Start pipeline ─────────────────────────────────────────────
        const startRes = await engine.api.startPipeline(jobId);
        expect(startRes.status).toBe(202);

        // Wait for completion
        let jobStatus = "";
        const deadline = Date.now() + PIPELINE_TIMEOUT;
        while (Date.now() < deadline) {
          const poll = await engine.api.getJob(jobId);
          jobStatus = poll.body.status;
          if (jobStatus === "completed" || jobStatus === "failed") break;
          await new Promise((r) => setTimeout(r, 200));
        }
        expect(jobStatus).toBe("completed");
        engine.log.info("Vocal pipeline completed");

        // ── Verify version with lyrics artifact ────────────────────────
        const versions = await engine.api.listVersions(jobId);
        expect(versions.body.length).toBeGreaterThanOrEqual(1);
        const version = versions.body[0]!;
        const artifacts = JSON.parse(version.artifacts);
        const hasLyrics = artifacts.some(
          (a: Artifact) => a.type === "lyrics" && a.value,
        );
        expect(hasLyrics).toBe(true);
        engine.log.info("Version has lyrics artifact");

        // ── Create take ────────────────────────────────────────────────
        const takeRes = await engine.api.createTake(version.id);
        expect(takeRes.status).toBe(201);
        engine.log.info("Vocal take created");

        // ── Clean up ───────────────────────────────────────────────────
        await engine.api.deleteJob(jobId);
      } finally {
        await engine.cleanup();
      }
    },
    PIPELINE_TIMEOUT + 5_000,
  );
});

describe("Error flows", () => {
  it("returns 404 for unknown genre on job creation", async () => {
    const engine = await createServerEngine("error-unknown-genre");
    try {
      const res = await engine.api.createJob({
        genreId: "nonexistent_genre",
        presetId: "test",
        inputs: { bpm: 120 },
      });
      expect(res.status).toBe(404);
      expect(res.body.error).toContain("Unknown genre");
    } finally {
      await engine.cleanup();
    }
  });

  it("returns 400 for invalid inputs", async () => {
    const engine = await createServerEngine("error-invalid-inputs");
    try {
      const res = await engine.api.createJob({
        genreId: "edm",
        presetId: "deep_house_chill",
        inputs: { bpm: 9999 as any }, // out of range
      });
      expect(res.status).toBe(400);
    } finally {
      await engine.cleanup();
    }
  });

  it("returns 404 for missing job", async () => {
    const engine = await createServerEngine("error-missing-job");
    try {
      const res = await engine.api.getJob("nonexistent-id");
      expect(res.status).toBe(404);
    } finally {
      await engine.cleanup();
    }
  });
});
