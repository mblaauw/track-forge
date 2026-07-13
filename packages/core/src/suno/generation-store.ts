import type { Db } from "../db/index.js";
import { schema } from "../db/index.js";
import { eq, desc } from "drizzle-orm";

export interface GenerationRecord {
  id: string;
  jobId: string;
  versionId?: string;
  status: string;
  audioUrl?: string;
  imageUrl?: string;
  videoUrl?: string;
  duration?: number;
  generatedTitle?: string;
  style?: string;
  error?: string;
}

/**
 * Record a Suno generation ID mapped to a job and optional version.
 */
export async function storeGeneration(
  db: Db,
  gen: GenerationRecord,
): Promise<void> {
  const now = new Date().toISOString();
  await db.insert(schema.generations).values({
    id: gen.id,
    jobId: gen.jobId,
    versionId: gen.versionId ?? null,
    status: gen.status,
    audioUrl: gen.audioUrl ?? null,
    imageUrl: gen.imageUrl ?? null,
    videoUrl: gen.videoUrl ?? null,
    duration: gen.duration ?? null,
    generatedTitle: gen.generatedTitle ?? null,
    style: gen.style ?? null,
    error: gen.error ?? null,
    createdAt: now,
    updatedAt: now,
  });
}

/**
 * Update a generation record with completion data from a callback.
 */
export async function updateGeneration(
  db: Db,
  id: string,
  data: {
    status: string;
    audioUrl?: string;
    imageUrl?: string;
    videoUrl?: string;
    duration?: number;
    generatedTitle?: string;
    style?: string;
    error?: string;
  },
): Promise<void> {
  const now = new Date().toISOString();
  await db
    .update(schema.generations)
    .set({
      status: data.status,
      audioUrl: data.audioUrl ?? null,
      imageUrl: data.imageUrl ?? null,
      videoUrl: data.videoUrl ?? null,
      duration: data.duration ?? null,
      generatedTitle: data.generatedTitle ?? null,
      style: data.style ?? null,
      error: data.error ?? null,
      updatedAt: now,
    })
    .where(eq(schema.generations.id, id));
}

/**
 * Look up a generation record by Suno generation ID.
 */
export async function getGeneration(
  db: Db,
  id: string,
): Promise<GenerationRecord | null> {
  const [row] = await db
    .select()
    .from(schema.generations)
    .where(eq(schema.generations.id, id))
    .limit(1);

  if (!row) return null;

  return {
    id: row.id,
    jobId: row.jobId,
    versionId: row.versionId ?? undefined,
    status: row.status,
    audioUrl: row.audioUrl ?? undefined,
    imageUrl: row.imageUrl ?? undefined,
    videoUrl: row.videoUrl ?? undefined,
    duration: row.duration ?? undefined,
    generatedTitle: row.generatedTitle ?? undefined,
    style: row.style ?? undefined,
    error: row.error ?? undefined,
  };
}

/**
 * List generations for a job, most recent first.
 */
export async function listGenerations(
  db: Db,
  jobId: string,
  limit = 10,
): Promise<GenerationRecord[]> {
  const rows = await db
    .select()
    .from(schema.generations)
    .where(eq(schema.generations.jobId, jobId))
    .orderBy(desc(schema.generations.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    jobId: row.jobId,
    versionId: row.versionId ?? undefined,
    status: row.status,
    audioUrl: row.audioUrl ?? undefined,
    imageUrl: row.imageUrl ?? undefined,
    videoUrl: row.videoUrl ?? undefined,
    duration: row.duration ?? undefined,
    generatedTitle: row.generatedTitle ?? undefined,
    style: row.style ?? undefined,
    error: row.error ?? undefined,
  }));
}
