/**
 * Re-forging a session.
 *
 * A job is a session, not a one-shot: after the first forge the user edits
 * and forges again. Each run must compile the inputs as they are now, write
 * a new version next to the old one, and expose only its own events — a
 * replayed "versioning completed" from the previous run is what used to
 * make the web client render a second take of the old version.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { TestEngineInstance } from "@track-forge/test-support";
import { createServerEngine } from "./create-server-engine.js";

const TIMEOUT = 20_000;

const SECTIONS = [
  { id: "s1", name: "Intro", bars: 8, fn: "establish", deltas: [], tags: [] },
  { id: "s2", name: "Drop", bars: 16, fn: "peak", deltas: [], tags: [] },
];

const INPUTS = {
  bpm: 120,
  mood: "warm",
  energy: 6,
  complexity: 5,
  lyricsMode: "strict_instrumental",
  sections: SECTIONS,
};

function artifact(version: { artifacts: unknown }, type: string): string {
  const list = (
    typeof version.artifacts === "string"
      ? JSON.parse(version.artifacts)
      : version.artifacts
  ) as { type: string; value: string }[];
  return list.find((a) => a.type === type)?.value ?? "";
}

describe("re-forging a session", () => {
  let engine: TestEngineInstance;

  beforeEach(async () => {
    engine = await createServerEngine("reforge");
  });

  afterEach(async () => {
    await engine.cleanup();
  });

  async function waitForJob(jobId: string): Promise<string> {
    const deadline = Date.now() + TIMEOUT;
    let status = "";
    while (Date.now() < deadline) {
      status = (await engine.api.getJob(jobId)).body.status;
      if (status !== "in_progress" && status !== "pending") break;
      await new Promise((r) => setTimeout(r, 100));
    }
    return status;
  }

  async function createAndForge(): Promise<string> {
    const created = await engine.api.createJob({
      genreId: "edm",
      presetId: "deep_house_chill",
      inputs: INPUTS,
    });
    expect(created.status).toBe(201);
    const jobId = created.body.id;
    const start = await engine.api.startPipeline(jobId);
    expect(start.status).toBe(202);
    expect(await waitForJob(jobId)).toBe("completed");
    return jobId;
  }

  async function events(jobId: string, since: number) {
    const res = await engine.server.inject({
      method: "GET",
      url: `/api/jobs/${jobId}/events/history?since=${since}&limit=200`,
    });
    return JSON.parse(res.body) as {
      sequence: number;
      stage: string;
      status: string;
    }[];
  }

  it(
    "compiles the edited inputs into a new version",
    async () => {
      const jobId = await createAndForge();

      // Editing a finished job is allowed — it shapes the next forge.
      const edit = await engine.api.updateJobInputs(jobId, {
        bpm: 96,
        sections: [
          ...SECTIONS,
          {
            id: "s3",
            name: "Outro",
            bars: 8,
            fn: "resolve",
            deltas: [],
            tags: [],
          },
        ],
      });
      expect(edit.status).toBe(200);

      const restart = await engine.api.startPipeline(jobId);
      expect(restart.status).toBe(202);
      const cursor = (restart.body as { eventCursor?: number }).eventCursor!;
      expect(cursor).toBeGreaterThan(0);
      expect(await waitForJob(jobId)).toBe("completed");

      const versions = (await engine.api.listVersions(jobId)).body;
      expect(versions).toHaveLength(2);
      const [latest, first] = versions as any[];
      expect(latest.number).toBe(2);
      expect(first.number).toBe(1);

      // The new version reflects the edit; the old one is untouched.
      expect(artifact(latest, "style")).toContain("around 96 BPM");
      expect(artifact(latest, "style")).toContain(
        "structure: intro → drop → outro",
      );
      expect(artifact(first, "style")).toContain("around 120 BPM");
      expect(artifact(first, "style")).toContain("structure: intro → drop.");

      // Each run froze its own revision and compilation.
      expect(latest.intentRevisionId).toBe(`${jobId}-rev-2`);
      expect(first.intentRevisionId).toBe(`${jobId}-rev-1`);
      expect(latest.compilationId).not.toBe(first.compilationId);

      // Events after the cursor belong to the second run only.
      const second = await events(jobId, cursor);
      expect(second.length).toBeGreaterThan(0);
      expect(second.every((e) => e.sequence > cursor)).toBe(true);
      expect(
        second.filter(
          (e) => e.stage === "versioning" && e.status === "completed",
        ),
      ).toHaveLength(1);
    },
    TIMEOUT * 2,
  );

  it(
    "renders the take from the new version, at its new length",
    async () => {
      const jobId = await createAndForge();
      await engine.api.updateJobInputs(jobId, { bpm: 60 });
      await engine.api.startPipeline(jobId);
      expect(await waitForJob(jobId)).toBe("completed");

      const [latest, first] = (await engine.api.listVersions(jobId))
        .body as any[];
      const take = await engine.api.createTake(latest.id);
      expect(take.status).toBe(201);

      // 24 bars: 48 s at 120 BPM before the edit, 96 s at 60 BPM after.
      expect((take.body as any).duration).toBe(96);
      expect((await engine.api.listTakes(latest.id)).body).toHaveLength(1);
      expect((await engine.api.listTakes(first.id)).body).toHaveLength(0);
    },
    TIMEOUT * 2,
  );

  it(
    "follows a preset switch without carrying the old preset's sound",
    async () => {
      const jobId = await createAndForge();
      const before = (await engine.api.getJob(jobId)).body;
      expect(before.presetId).toBe("deep_house_chill");

      const res = await engine.server.inject({
        method: "PATCH",
        url: `/api/jobs/${jobId}/inputs`,
        payload: {
          presetId: "dubstep_heavy",
          inputs: { ...INPUTS, bpm: 140 },
        },
      });
      expect(res.statusCode).toBe(200);
      const after = JSON.parse(res.body);
      expect(after.presetId).toBe("dubstep_heavy");

      await engine.api.startPipeline(jobId);
      expect(await waitForJob(jobId)).toBe("completed");

      const [latest, first] = (await engine.api.listVersions(jobId))
        .body as any[];
      expect(artifact(first, "style")).toContain("Deep House");
      expect(artifact(latest, "style")).toContain("Dubstep");
      expect(artifact(latest, "style")).not.toContain("Deep House");
    },
    TIMEOUT * 2,
  );

  it("rejects an unknown genre on a sound switch", async () => {
    const jobId = await createAndForge();
    const res = await engine.server.inject({
      method: "PATCH",
      url: `/api/jobs/${jobId}/inputs`,
      payload: { genreId: "polka", inputs: INPUTS },
    });
    expect(res.statusCode).toBe(404);
    expect((await engine.api.getJob(jobId)).body.genreId).toBe("edm");
  });

  it(
    "refuses to start or edit a job that is mid-run",
    async () => {
      const jobId = await createAndForge();
      const sqlite = (engine.db as any).$client;
      sqlite
        .prepare("UPDATE jobs SET status = 'in_progress' WHERE id = ?")
        .run(jobId);

      const start = await engine.api.startPipeline(jobId);
      expect(start.status).toBe(409);
      const edit = await engine.api.updateJobInputs(jobId, { bpm: 100 });
      expect(edit.status).toBe(409);

      // Nothing ran: still exactly the one version from the first forge.
      expect((await engine.api.listVersions(jobId)).body).toHaveLength(1);
    },
    TIMEOUT,
  );

  it(
    "restarts a cancelled job",
    async () => {
      const jobId = await createAndForge();
      const sqlite = (engine.db as any).$client;
      sqlite
        .prepare("UPDATE jobs SET status = 'cancelled' WHERE id = ?")
        .run(jobId);

      const start = await engine.api.startPipeline(jobId);
      expect(start.status).toBe(202);
      expect(await waitForJob(jobId)).toBe("completed");
      expect((await engine.api.listVersions(jobId)).body).toHaveLength(2);
    },
    TIMEOUT * 2,
  );
});
