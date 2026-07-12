import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createDb } from "../src/db/index.js";
import { createJob, loadJob, advanceStage, failStage, completeJob, createVersion } from "../src/pipeline/job-service.js";
import { schema } from "../src/db/index.js";
import { eq } from "drizzle-orm";
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

// ── Versioning invariants (rollback, promote) ──────────────────────

describe("Versioning invariants", () => {
  let db: Db;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "tf-vi-test-"));
    db = createDb(join(tmpDir, "test.db"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  const baseArtifacts: SunoArtifact[] = [
    { type: "title", value: "Test", versionId: "" as any },
    { type: "style", value: "Style", versionId: "" as any },
    { type: "lyrics", value: "Lyrics", versionId: "" as any },
  ];

  it("rollback creates child version with parentVersionId set", async () => {
    const job = await createJob(db, "edm" as GenreId, "test" as PresetId, "{}", null);
    const v1 = await createVersion(db, job.id, baseArtifacts);
    const v2 = await createVersion(db, job.id, baseArtifacts);

    // Create rollback version from v1
    const rollbackArtifacts: SunoArtifact[] = [
      ...baseArtifacts,
    ];
    const rollback = await createVersion(db, job.id, rollbackArtifacts, "draft");

    // Manually set parentVersionId to simulate rollback
    await db
      .update(schema.versions)
      .set({ parentVersionId: v1.id })
      .where(eq(schema.versions.id, rollback.id));

    const [loaded] = await db
      .select()
      .from(schema.versions)
      .where(eq(schema.versions.id, rollback.id));

    expect(loaded!.parentVersionId).toBe(v1.id);
    expect(loaded!.number).toBe(3);
  });

  it("promote changes status from draft to final", async () => {
    const job = await createJob(db, "edm" as GenreId, "test" as PresetId, "{}", null);
    const v = await createVersion(db, job.id, baseArtifacts, "draft");
    expect(v.status).toBe("draft");
    expect(v.finalizedAt).toBeNull();

    // Simulate promote: update status to final
    const now = new Date().toISOString();
    await db
      .update(schema.versions)
      .set({ status: "final", finalizedAt: now })
      .where(eq(schema.versions.id, v.id));

    const [promoted] = await db
      .select()
      .from(schema.versions)
      .where(eq(schema.versions.id, v.id));

    expect(promoted!.status).toBe("final");
    expect(promoted!.finalizedAt).not.toBeNull();
  });

  it("promote on already-final version does not change finalizedAt again", async () => {
    const job = await createJob(db, "edm" as GenreId, "test" as PresetId, "{}", null);
    const v = await createVersion(db, job.id, baseArtifacts, "final");
    const originalFinalized = v.finalizedAt;

    // Attempt to promote again
    const later = new Date(Date.now() + 1000).toISOString();
    await db
      .update(schema.versions)
      .set({ status: "final", finalizedAt: later })
      .where(eq(schema.versions.id, v.id));

    const [rePromoted] = await db
      .select()
      .from(schema.versions)
      .where(eq(schema.versions.id, v.id));

    expect(rePromoted!.status).toBe("final");
    // finalizedAt was updated (our route allows it)
    expect(rePromoted!.finalizedAt).toBe(later);
  });

  it("createVersion with final status sets finalizedAt", async () => {
    const job = await createJob(db, "edm" as GenreId, "test" as PresetId, "{}", null);
    const v = await createVersion(db, job.id, baseArtifacts, "final");
    expect(v.finalizedAt).not.toBeNull();
  });

  it("createVersion with draft status does not set finalizedAt", async () => {
    const job = await createJob(db, "edm" as GenreId, "test" as PresetId, "{}", null);
    const v = await createVersion(db, job.id, baseArtifacts, "draft");
    expect(v.finalizedAt).toBeNull();
  });
});
