import type { Db } from "../db/index.js";
import { schema, getSqlite } from "../db/index.js";
import { eq, desc } from "drizzle-orm";
import type { SunoTrack } from "./types.js";

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

  return mapGenerationRow(row);
}

/** Shared DB row → GenerationRecord mapper */
function mapGenerationRow(row: Record<string, unknown>): GenerationRecord {
  return {
    id: row.id as string,
    jobId: row.jobId as string,
    versionId: (row.versionId as string) ?? undefined,
    status: row.status as string,
    audioUrl: (row.audioUrl as string) ?? undefined,
    imageUrl: (row.imageUrl as string) ?? undefined,
    videoUrl: (row.videoUrl as string) ?? undefined,
    duration: (row.duration as number) ?? undefined,
    generatedTitle: (row.generatedTitle as string) ?? undefined,
    style: (row.style as string) ?? undefined,
    error: (row.error as string) ?? undefined,
  };
}

/**
 * Track record stored in suno_tracks table
 */
export interface TrackRecord {
  id: string;
  generationId: string;
  index: number;
  audioUrl?: string;
  imageUrl?: string;
  videoUrl?: string;
  duration?: number;
  title?: string;
}

/**
 * Store all tracks for a generation into the suno_tracks table.
 * Uses raw SQL via getSqlite for batch insert efficiency.
 */
export function storeTracks(
  db: Db,
  generationId: string,
  tracks: SunoTrack[],
): void {
  if (tracks.length === 0) return;
  const sqlite = getSqlite(db);
  const now = new Date().toISOString();
  const insert = sqlite.prepare(
    'INSERT INTO suno_tracks (id, generation_id, "index", audio_url, image_url, video_url, duration, title, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
  );
  sqlite.transaction(() => {
    for (const t of tracks) {
      insert.run(
        t.id,
        generationId,
        t.index,
        t.audioUrl ?? null,
        t.imageUrl ?? null,
        t.videoUrl ?? null,
        t.duration ?? null,
        t.title ?? null,
        now,
      );
    }
  })();
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

  return rows.map(mapGenerationRow);
}
