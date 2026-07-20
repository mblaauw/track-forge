import { test, expect } from "@playwright/test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

test.describe("pipeline idempotency & stage persistence", () => {
  /** Create a job via API with minimal inputs (instrumental, no LLM needed) */
  async function createJobViaAPI(
    request: import("@playwright/test").APIRequestContext,
    genreId = "ambient",
    presetId = "drone_minimal",
  ) {
    const res = await request.post("/api/jobs", {
      data: {
        genreId,
        presetId,
        inputs: {
          bpm: 70,
          key: "C",
          scale: "major",
          mood: "meditative",
          complexity: 3,
          lyricsMode: "strict_instrumental",
          subgenre: "drone",
          soundscape: "deep drones",
          title: "Idempotency Test",
        },
        name: "Idempotency Test Session",
      },
    });
    expect(res.ok()).toBe(true);
    return res.json();
  }

  test("pipeline stages persist to DB and are replayable", async ({
    request,
  }) => {
    // Create job
    const job = await createJobViaAPI(request);
    expect(job.status).toBe("pending");
    expect(job.currentStage).toBe("compilation");

    // Start the pipeline
    const startRes = await request.post(`/api/jobs/${job.id}/start`);
    expect(startRes.ok()).toBe(true);

    // Wait for pipeline to complete
    let status = "in_progress";
    let attempts = 0;
    while (status === "in_progress" && attempts < 30) {
      await new Promise((r) => setTimeout(r, 1000));
      const check = await request.get(`/api/jobs/${job.id}`);
      const data = await check.json();
      status = data.status;
      attempts++;
    }

    // Verify pipeline completed
    expect(status).toBe("completed");

    // ── Verify stage data is persisted ──────────────────────────────────
    const finalJob = await (await request.get(`/api/jobs/${job.id}`)).json();
    expect(finalJob.stageData).toBeTruthy();
    const stageData = JSON.parse(finalJob.stageData);
    expect(stageData.compiledJson).toBeTruthy();
    expect(stageData.lyricsWriterResult).toBeDefined();

    // ── Verify versions exist ──────────────────────────────────────────
    const versions = await (
      await request.get(`/api/jobs/${job.id}/versions`)
    ).json();
    expect(versions.length).toBe(1);

    const version = versions[0];
    const artifacts = JSON.parse(version.artifacts);
    const types = artifacts.map((a: { type: string }) => a.type);
    expect(types).toContain("title");
    expect(types).toContain("style");
    expect(types).toContain("lyrics");

    // ── Verify events are persisted for replay ─────────────────────────
    const events = await (
      await request.get(`/api/jobs/${job.id}/events/history?limit=50`)
    ).json();
    expect(events.length).toBeGreaterThanOrEqual(3);

    const stages = events.map((e: { stage: string }) => e.stage);
    expect(stages).toContain("compilation");
    expect(stages).toContain("lyrics_writing");
    expect(stages).toContain("versioning");

    for (const event of events) {
      expect(event.sequence).toBeGreaterThan(0);
      expect(event.timestamp).toBeTruthy();
    }
  });

  test("job survives server restart (simulated)", async ({ request }) => {
    // Create and start a job
    const job = await createJobViaAPI(request);
    await request.post(`/api/jobs/${job.id}/start`);

    // Wait for completion
    let status = "in_progress";
    let attempts = 0;
    while (status === "in_progress" && attempts < 30) {
      await new Promise((r) => setTimeout(r, 1000));
      const check = await request.get(`/api/jobs/${job.id}`);
      const data = await check.json();
      status = data.status;
      attempts++;
    }
    expect(status).toBe("completed");

    // Simulate "server restart" by re-fetching (it's still the same server,
    // but this tests that the DB-backed state is intact)
    const afterRestart = await (
      await request.get(`/api/jobs/${job.id}`)
    ).json();
    expect(afterRestart.id).toBe(job.id);
    expect(afterRestart.status).toBe("completed");

    // Versions still exist
    const versions = await (
      await request.get(`/api/jobs/${job.id}/versions`)
    ).json();
    expect(versions.length).toBe(1);

    // Events still exist
    const events = await (
      await request.get(`/api/jobs/${job.id}/events/history`)
    ).json();
    expect(events.length).toBeGreaterThan(0);
  });

  test("multiple sequential jobs create independent versions", async ({
    request,
  }) => {
    const ids: string[] = [];

    for (let i = 0; i < 3; i++) {
      const job = await createJobViaAPI(request);
      ids.push(job.id);
      await request.post(`/api/jobs/${job.id}/start`);

      // Wait for completion
      let status = "in_progress";
      let attempts = 0;
      while (status === "in_progress" && attempts < 30) {
        await new Promise((r) => setTimeout(r, 1000));
        const check = await request.get(`/api/jobs/${job.id}`);
        const data = await check.json();
        status = data.status;
        attempts++;
      }
      expect(status).toBe("completed");
    }

    // Each job has exactly one version
    for (const id of ids) {
      const versions = await (
        await request.get(`/api/jobs/${id}/versions`)
      ).json();
      expect(versions.length).toBe(1);
      expect(versions[0].number).toBe(1);
    }

    // All 3 jobs are listable
    const allJobs = await (await request.get("/api/jobs?limit=10")).json();
    expect(allJobs.length).toBeGreaterThanOrEqual(3);
  });

  test("cancel stops a pending job before it starts", async ({ request }) => {
    // Create a job but don't start it
    const job = await createJobViaAPI(request);
    expect(job.status).toBe("pending");

    // Cancel while still pending
    const cancelRes = await request.post(`/api/jobs/${job.id}/cancel`);
    if (!cancelRes.ok()) {
      const body = await cancelRes.text();
      throw new Error(`Cancel failed: ${cancelRes.status()} ${body}`);
    }
    const cancelled = await cancelRes.json();
    expect(cancelled.status).toBe("cancelled");

    // Verify it's cancelled in DB
    const check = await request.get(`/api/jobs/${job.id}`);
    const data = await check.json();
    expect(data.status).toBe("cancelled");
  });
});
