import { eq, desc, sql } from "drizzle-orm";
import type { Db } from "../db/index.js";
import { schema, getSqlite } from "../db/index.js";
import type {
  Job,
  JobId,
  GenreId,
  PresetId,
  GenerationStage,
  Version,
  VersionId,
  VersionStatus,
  SunoArtifact,
  LyricsWriterResult,
  LyricsFormat,
} from "@track-forge/contracts";

export interface StageData {
  lyricsWriterResult?: LyricsWriterResult | null;
  compiledJson?: string | null;
  lyricsFormat?: LyricsFormat | null;
}

// ── Job CRUD ──────────────────────────────────────────────────────────

export async function createJob(
  db: Db,
  genreId: GenreId,
  presetId: PresetId,
  inputs: string,
  reference: string | null,
  name?: string | null,
): Promise<Job> {
  const id = crypto.randomUUID() as JobId;
  const sourceHash = reference ? hashRef(reference) : null;
  const now = new Date().toISOString();

  await db.insert(schema.jobs).values({
    id,
    name: name ?? null,
    genreId,
    presetId,
    status: "pending",
    currentStage: "compilation",
    reference,
    sourceHash,
    inputs,
    stageAttempt: 0,
    error: null,
    createdAt: now,
    updatedAt: now,
  });

  return loadJobOrThrow(db, id);
}

export async function loadJob(db: Db, jobId: JobId): Promise<Job | null> {
  const rows = await db
    .select()
    .from(schema.jobs)
    .where(eq(schema.jobs.id, jobId))
    .limit(1);
  return (rows[0] ?? null) as Job | null;
}

async function loadJobOrThrow(db: Db, jobId: JobId): Promise<Job> {
  const job = await loadJob(db, jobId);
  if (!job) throw new Error(`Job ${jobId} not found`);
  return job;
}

// ── Stage transitions ─────────────────────────────────────────────────

export async function advanceStage(
  db: Db,
  jobId: JobId,
  nextStage: GenerationStage,
): Promise<Job> {
  const now = new Date().toISOString();
  await db
    .update(schema.jobs)
    .set({ currentStage: nextStage, stageAttempt: 0, updatedAt: now })
    .where(eq(schema.jobs.id, jobId));
  return loadJobOrThrow(db, jobId);
}

export async function failStage(
  db: Db,
  jobId: JobId,
  error: string,
  maxAttempts = 3,
): Promise<Job> {
  const job = await loadJobOrThrow(db, jobId);
  const attempt = job.stageAttempt + 1;
  const now = new Date().toISOString();

  if (attempt >= maxAttempts) {
    // Exhausted retries — fail the job
    await db
      .update(schema.jobs)
      .set({
        status: "failed",
        error,
        stageAttempt: attempt,
        updatedAt: now,
      })
      .where(eq(schema.jobs.id, jobId));
  } else {
    // Retry same stage
    await db
      .update(schema.jobs)
      .set({
        status: "in_progress",
        error,
        stageAttempt: attempt,
        updatedAt: now,
      })
      .where(eq(schema.jobs.id, jobId));
  }

  return loadJobOrThrow(db, jobId);
}

export async function completeJob(db: Db, jobId: JobId): Promise<Job> {
  const now = new Date().toISOString();
  await db
    .update(schema.jobs)
    .set({ status: "completed", currentStage: "versioning", updatedAt: now })
    .where(eq(schema.jobs.id, jobId));
  return loadJobOrThrow(db, jobId);
}

export async function failJob(db: Db, jobId: JobId, error: string): Promise<Job> {
  const now = new Date().toISOString();
  await db
    .update(schema.jobs)
    .set({ status: "failed", error, updatedAt: now })
    .where(eq(schema.jobs.id, jobId));
  return loadJobOrThrow(db, jobId);
}

export async function resetJobStage(
  db: Db,
  jobId: JobId,
  stage: GenerationStage,
): Promise<Job> {
  const now = new Date().toISOString();
  await db
    .update(schema.jobs)
    .set({
      currentStage: stage,
      status: "pending",
      stageAttempt: 0,
      error: null,
      updatedAt: now,
    })
    .where(eq(schema.jobs.id, jobId));
  return loadJobOrThrow(db, jobId);
}

export async function cancelJob(db: Db, jobId: JobId): Promise<Job> {
  const now = new Date().toISOString();
  await db
    .update(schema.jobs)
    .set({
      status: "cancelled",
      error: "Cancelled by user",
      updatedAt: now,
    })
    .where(eq(schema.jobs.id, jobId));
  return loadJobOrThrow(db, jobId);
}

// ── Version CRUD ──────────────────────────────────────────────────────

export function createVersion(
  db: Db,
  jobId: JobId,
  artifacts: SunoArtifact[],
  status: VersionStatus = "draft",
): Version {
  const id = crypto.randomUUID() as VersionId;
  const now = new Date().toISOString();
  const sqlite = getSqlite(db);

  // Fix up artifact versionIds to match the generated version id
  const fixedArtifacts = artifacts.map((a) => ({ ...a, versionId: id }));

  return sqlite.transaction(() => {
    const row = sqlite
      .prepare(
        "SELECT COALESCE(MAX(number), 0) + 1 AS next_num FROM versions WHERE job_id = ?",
      )
      .get(jobId) as { next_num: number };
    const number = row.next_num;

    sqlite
      .prepare(
        "INSERT INTO versions (id, job_id, status, number, artifacts, finalized_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        id,
        jobId,
        status,
        number,
        JSON.stringify(fixedArtifacts),
        status === "final" ? now : null,
        now,
      );

    const created = sqlite
      .prepare("SELECT * FROM versions WHERE id = ?")
      .get(id) as Record<string, unknown> | undefined;
    if (!created) throw new Error(`Version ${id} not found after insert`);
    return {
      id: created.id,
      jobId: created.job_id,
      status: created.status,
      number: created.number,
      artifacts: created.artifacts,
      stage: created.stage ?? null,
      parentVersionId: created.parent_version_id ?? null,
      finalizedAt: created.finalized_at ?? null,
      createdAt: created.created_at,
    } as unknown as Version;
  })() as Version;
}

async function loadVersionOrThrow(
  db: Db,
  versionId: VersionId,
): Promise<Version> {
  const rows = await db
    .select()
    .from(schema.versions)
    .where(eq(schema.versions.id, versionId))
    .limit(1);
  if (rows.length === 0) throw new Error(`Version ${versionId} not found`);
  return rows[0] as unknown as Version;
}

// ── Pipeline state persistence ────────────────────────────────────────

export async function savePipelineState(
  db: Db,
  jobId: JobId,
  data: StageData,
): Promise<void> {
  const now = new Date().toISOString();
  await db
    .update(schema.jobs)
    .set({
      stageData: JSON.stringify(data),
      updatedAt: now,
    })
    .where(eq(schema.jobs.id, jobId));
}

export async function loadPipelineState(
  db: Db,
  jobId: JobId,
): Promise<StageData | null> {
  const job = await loadJob(db, jobId);
  if (!job?.stageData) return null;
  try {
    return JSON.parse(job.stageData) as StageData;
  } catch {
    return null;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────

function hashRef(ref: string): string {
  let hash = 0;
  for (let i = 0; i < ref.length; i++) {
    const char = ref.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit int
  }
  return Math.abs(hash).toString(36);
}
