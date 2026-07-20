import { test, expect } from "@playwright/test";

const createdJobIds: string[] = [];

test.afterEach(async ({ request }) => {
  for (const id of createdJobIds) {
    try {
      await request.delete(`/api/jobs/${id}`);
    } catch {
      // best-effort cleanup
    }
  }
  createdJobIds.length = 0;
});

test.describe("pipeline idempotency & stage persistence", () => {
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
          title: "E2E Idempotency Test",
        },
        name: "E2E Idempotency Test",
      },
    });
    expect(res.ok()).toBe(true);
    const job = await res.json();
    createdJobIds.push(job.id);
    return job;
  }

  test("pipeline stages persist to DB and are replayable", async ({
    request,
  }) => {
    const job = await createJobViaAPI(request);
    expect(job.status).toBe("pending");
    expect(job.currentStage).toBe("compilation");

    await request.post(`/api/jobs/${job.id}/start`);

    let status = "in_progress";
    let attempts = 0;
    while (status === "in_progress" && attempts < 30) {
      await new Promise((r) => setTimeout(r, 1000));
      const check = await request.get(`/api/jobs/${job.id}`);
      status = (await check.json()).status;
      attempts++;
    }
    expect(status).toBe("completed");

    const finalJob = await (await request.get(`/api/jobs/${job.id}`)).json();
    expect(finalJob.stageData).toBeTruthy();
    const stageData = JSON.parse(finalJob.stageData);
    expect(stageData.compiledJson).toBeTruthy();
    expect(stageData.lyricsWriterResult).toBeDefined();

    const versions = await (
      await request.get(`/api/jobs/${job.id}/versions`)
    ).json();
    expect(versions.length).toBe(1);
    const artifacts = JSON.parse(versions[0].artifacts);
    const types = artifacts.map((a: { type: string }) => a.type);
    expect(types).toContain("title");
    expect(types).toContain("style");
    expect(types).toContain("lyrics");

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
    const job = await createJobViaAPI(request);
    await request.post(`/api/jobs/${job.id}/start`);

    let status = "in_progress";
    let attempts = 0;
    while (status === "in_progress" && attempts < 30) {
      await new Promise((r) => setTimeout(r, 1000));
      const check = await request.get(`/api/jobs/${job.id}`);
      status = (await check.json()).status;
      attempts++;
    }
    expect(status).toBe("completed");

    const afterRestart = await (
      await request.get(`/api/jobs/${job.id}`)
    ).json();
    expect(afterRestart.id).toBe(job.id);
    expect(afterRestart.status).toBe("completed");

    const versions = await (
      await request.get(`/api/jobs/${job.id}/versions`)
    ).json();
    expect(versions.length).toBe(1);

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

      let status = "in_progress";
      let attempts = 0;
      while (status === "in_progress" && attempts < 30) {
        await new Promise((r) => setTimeout(r, 1000));
        const check = await request.get(`/api/jobs/${job.id}`);
        status = (await check.json()).status;
        attempts++;
      }
      expect(status).toBe("completed");
    }

    for (const id of ids) {
      const versions = await (
        await request.get(`/api/jobs/${id}/versions`)
      ).json();
      expect(versions.length).toBe(1);
      expect(versions[0].number).toBe(1);
    }
  });

  test("cancel stops a pending job before it starts", async ({ request }) => {
    const job = await createJobViaAPI(request);
    expect(job.status).toBe("pending");

    const cancelRes = await request.post(`/api/jobs/${job.id}/cancel`);
    expect(cancelRes.ok()).toBe(true);
    const cancelled = await cancelRes.json();
    expect(cancelled.status).toBe("cancelled");

    const check = await request.get(`/api/jobs/${job.id}`);
    const data = await check.json();
    expect(data.status).toBe("cancelled");
  });
});
