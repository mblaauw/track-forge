import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createDb } from "../src/db/index.js";
import { createJob, loadJob, advanceStage, failStage, completeJob, createVersion } from "../src/pipeline/job-service.js";
import type { Db } from "../src/db/index.js";
import type { JobId, GenreId, PresetId, SunoArtifact } from "@track-forge/contracts";

describe("JobService", () => {
  let db: Db;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "tf-js-test-"));
    db = createDb(join(tmpDir, "test.db"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("createJob creates a pending job", async () => {
    const job = await createJob(db, "edm" as GenreId, "deep_house_chill" as PresetId, "{}", null);
    expect(job.id).toBeDefined();
    expect(job.status).toBe("pending");
    expect(job.currentStage).toBe("ref_interpretation");
    expect(job.genreId).toBe("edm");
    expect(job.presetId).toBe("deep_house_chill");
    expect(job.inputs).toBe("{}");
    expect(job.reference).toBeNull();
    expect(job.sourceHash).toBeNull();
  });

  it("createJob hashes reference material", async () => {
    const ref = "Sample reference track";
    const job = await createJob(db, "edm" as GenreId, "deep_house_chill" as PresetId, "{}", ref);
    expect(job.sourceHash).toBeDefined();
    expect(job.sourceHash!.length).toBeGreaterThan(0);
    expect(job.reference).toBe(ref);
  });

  it("loadJob returns null for missing job", async () => {
    const result = await loadJob(db, "nonexistent-id" as JobId);
    expect(result).toBeNull();
  });

  it("loadJob returns created job", async () => {
    const created = await createJob(db, "edm" as GenreId, "deep_house_chill" as PresetId, "{}", null);
    const loaded = await loadJob(db, created.id);
    expect(loaded).not.toBeNull();
    expect(loaded!.id).toBe(created.id);
    expect(loaded!.status).toBe("pending");
  });

  it("advanceStage updates currentStage and resets attempt counter", async () => {
    const job = await createJob(db, "edm" as GenreId, "tech_house_driving" as PresetId, "{}", null);
    const advanced = await advanceStage(db, job.id, "planning");
    expect(advanced.currentStage).toBe("planning");
    expect(advanced.stageAttempt).toBe(0);
  });

  it("failStage retries same stage until maxAttempts", async () => {
    const job = await createJob(db, "edm" as GenreId, "test" as PresetId, "{}", null);
    const fail1 = await failStage(db, job.id, "error 1");
    expect(fail1.status).toBe("in_progress"); // retrying
    expect(fail1.stageAttempt).toBe(1);
    expect(fail1.error).toBe("error 1");

    const fail2 = await failStage(db, job.id, "error 2");
    expect(fail2.status).toBe("in_progress"); // retrying (attempt 2 < 3)
    expect(fail2.stageAttempt).toBe(2);

    const fail3 = await failStage(db, job.id, "final error");
    expect(fail3.status).toBe("failed");
    expect(fail3.stageAttempt).toBe(3);
    expect(fail3.error).toBe("final error");
  });

  it("completeJob marks job completed and stage versioning", async () => {
    const job = await createJob(db, "edm" as GenreId, "test" as PresetId, "{}", null);
    const completed = await completeJob(db, job.id);
    expect(completed.status).toBe("completed");
    expect(completed.currentStage).toBe("versioning");
  });

  it("createVersion creates version with incrementing numbers", async () => {
    const job = await createJob(db, "edm" as GenreId, "test" as PresetId, "{}", null);
    const artifacts: SunoArtifact[] = [{ type: "title", value: "Test Track", versionId: "" as any }];
    const v1 = await createVersion(db, job.id, artifacts);
    expect(v1.number).toBe(1);
    expect(v1.status).toBe("draft");

    const v2 = await createVersion(db, job.id, artifacts, "final");
    expect(v2.number).toBe(2);
    expect(v2.status).toBe("final");
    expect(v2.finalizedAt).not.toBeNull();
  });
});
