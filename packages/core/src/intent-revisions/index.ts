import { eq, desc } from "drizzle-orm";
import { migrateLegacyJob, hashIntent } from "@track-forge/song-intent";
import type { SongIntentV1 } from "@track-forge/song-intent";
import type { Db } from "../db/index.js";
import { schema } from "../db/index.js";

// ── Types ─────────────────────────────────────────────────────────────

export interface IntentRevision {
  id: string;
  jobId: string;
  revisionNumber: number;
  schemaVersion: number;
  intentJson: string;
  provenanceJson: string | null;
  catalogSnapshotJson: string | null;
  intentHash: string;
  createdAt: string;
}

export interface CompilationRecord {
  id: string;
  intentRevisionId: string;
  compilerVersion: string;
  adapterVersion: string;
  modelVersion: string | null;
  resolvedIntentJson: string | null;
  decisionsJson: string | null;
  warningsJson: string | null;
  fragmentsJson: string | null;
  style: string | null;
  lyrics: string | null;
  excludedStyles: string | null;
  createdAt: string;
}

// ── Freeze an intent revision ─────────────────────────────────────────

/**
 * Freeze an immutable intent revision from a job's current inputs.
 * The revision captures the SongIntentV1 + provenance at this point in
 * time, so even if the job is later edited, the frozen revision remains
 * reproducible.
 *
 * Returns an object with `revisionId` and the migrated `MigrateLegacyResult`.
 * Call this BEFORE the pipeline starts.
 */
export async function freezeIntentRevision(
  db: Db,
  jobId: string,
  genreId: string,
  presetId: string,
  inputs: string | null,
  opts?: {
    name?: string | null;
    reference?: string | null;
    provenance?: Record<string, unknown>;
  },
): Promise<
  {
    revisionId: string;
  } & import("@track-forge/song-intent").MigrateLegacyResult
> {
  const migrated = migrateLegacyJob({ genreId, presetId, inputs });

  // Override title from job name if no intent title was present
  if (!migrated.intent.identity.title && opts?.name) {
    migrated.intent.identity.title = opts.name;
  }
  // Add job reference if present
  if (opts?.reference) {
    migrated.intent.references.push({ text: opts.reference });
  }
  const intentHash = hashIntent(migrated.intent);

  // Determine revision number: next sequential for this job
  const lastRev = await db
    .select()
    .from(schema.intentRevisions)
    .where(eq(schema.intentRevisions.jobId, jobId))
    .orderBy(desc(schema.intentRevisions.revisionNumber))
    .limit(1);

  const revisionNumber =
    lastRev.length > 0 ? lastRev[0]!.revisionNumber + 1 : 1;
  const id = `${jobId}-rev-${revisionNumber}`;
  const now = new Date().toISOString();

  await db.insert(schema.intentRevisions).values({
    id,
    jobId,
    revisionNumber,
    schemaVersion: 1,
    intentJson: JSON.stringify(migrated.intent),
    provenanceJson: opts?.provenance ? JSON.stringify(opts.provenance) : null,
    catalogSnapshotJson: null,
    intentHash,
    createdAt: now,
  });

  return { revisionId: id, intent: migrated.intent, hash: migrated.hash };
}

// ── Create a compilation record ───────────────────────────────────────

/**
 * Record that a specific intent revision was compiled into rendered
 * artifacts. Created during the versioning stage.
 *
 * Returns the compilation id.
 */
export async function createCompilation(
  db: Db,
  intentRevisionId: string,
  opts: {
    style: string;
    lyrics: string;
    excludedStyles: string;
    resolvedIntent?: unknown;
    decisions?: unknown;
    warnings?: unknown;
    modelVersion?: string;
  },
): Promise<string> {
  const id = `${intentRevisionId}-comp`;
  const now = new Date().toISOString();

  await db.insert(schema.compilations).values({
    id,
    intentRevisionId,
    compilerVersion: "1.0.0",
    adapterVersion: "1.0.0",
    modelVersion: opts.modelVersion ?? null,
    resolvedIntentJson: opts.resolvedIntent
      ? JSON.stringify(opts.resolvedIntent)
      : null,
    decisionsJson: opts.decisions ? JSON.stringify(opts.decisions) : null,
    warningsJson: opts.warnings ? JSON.stringify(opts.warnings) : null,
    fragmentsJson: null,
    style: opts.style,
    lyrics: opts.lyrics,
    excludedStyles: opts.excludedStyles,
    createdAt: now,
  });

  return id;
}

// ── Load a revision ───────────────────────────────────────────────────

/**
 * Retrieve a frozen intent revision by id.
 */
export async function loadIntentRevision(
  db: Db,
  revisionId: string,
): Promise<IntentRevision | null> {
  const [row] = await db
    .select()
    .from(schema.intentRevisions)
    .where(eq(schema.intentRevisions.id, revisionId))
    .limit(1);

  if (!row) return null;

  return {
    id: row.id,
    jobId: row.jobId,
    revisionNumber: row.revisionNumber,
    schemaVersion: row.schemaVersion,
    intentJson: row.intentJson,
    provenanceJson: row.provenanceJson,
    catalogSnapshotJson: row.catalogSnapshotJson,
    intentHash: row.intentHash,
    createdAt: row.createdAt,
  };
}

/**
 * Parse a frozen revision's intent JSON back to a typed object.
 */
export function parseRevisionIntent(row: IntentRevision): SongIntentV1 {
  return JSON.parse(row.intentJson) as SongIntentV1;
}
