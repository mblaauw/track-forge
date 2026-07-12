import { eq } from "drizzle-orm";
import type { Db } from "../db/index.js";
import { schema } from "../db/index.js";
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
  InterpretedReference,
  StyleWriterResult,
  LyricsWriterResult,
} from "@track-forge/contracts";

/** Subset of PipelineState that can be persisted/restored */
import type { LyricsFormat } from "@track-forge/contracts";

export interface StageData {
  interpretedRef?: InterpretedReference | null;
  songPlan?: string | null;
  styleWriterResult?: StyleWriterResult | null;
  lyricsWriterResult?: LyricsWriterResult | null;
  compiledJson?: string | null;
  findings?: unknown[] | null;
  appliedPatch?: string | null;
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
    currentStage: "ref_interpretation",
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
  const rows = await db.select().from(schema.jobs).where(eq(schema.jobs.id, jobId)).limit(1);
  return (rows[0] ?? null) as Job | null;
}

async function loadJobOrThrow(db: Db, jobId: JobId): Promise<Job> {
  const job = await loadJob(db, jobId);
  if (!job) throw new Error(`Job ${jobId} not found`);
  return job;
}

async function countVersions(db: Db, jobId: JobId): Promise<number> {
  const rows = await db
    .select({ count: schema.versions.id })
    .from(schema.versions)
    .where(eq(schema.versions.jobId, jobId));
  return rows.length;
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

export async function completeJob(
  db: Db,
  jobId: JobId,
): Promise<Job> {
  const now = new Date().toISOString();
  await db
    .update(schema.jobs)
    .set({ status: "completed", currentStage: "versioning", updatedAt: now })
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

export async function cancelJob(
  db: Db,
  jobId: JobId,
): Promise<Job> {
  const now = new Date().toISOString();
  await db
    .update(schema.jobs)
    .set({
      status: "cancelled" as any,
      error: "Cancelled by user",
      updatedAt: now,
    })
    .where(eq(schema.jobs.id, jobId));
  return loadJobOrThrow(db, jobId);
}

// ── Version CRUD ──────────────────────────────────────────────────────

export async function createVersion(
  db: Db,
  jobId: JobId,
  artifacts: SunoArtifact[],
  status: VersionStatus = "draft",
): Promise<Version> {
  const versionNumber = await countVersions(db, jobId) + 1;
  const id = crypto.randomUUID() as VersionId;
  const now = new Date().toISOString();

  await db.insert(schema.versions).values({
    id,
    jobId,
    status,
    number: versionNumber,
    artifacts: JSON.stringify(artifacts),
    finalizedAt: status === "final" ? now : null,
    createdAt: now,
  });

  return loadVersionOrThrow(db, id);
}

async function loadVersionOrThrow(db: Db, versionId: VersionId): Promise<Version> {
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
