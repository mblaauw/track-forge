import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

// ── Projects ─────────────────────────────────────────────────────────

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  genreId: text("genre_id"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// ── Jobs ─────────────────────────────────────────────────────────────

export const jobs = sqliteTable("jobs", {
  id: text("id").primaryKey(),
  projectId: text("project_id").references(() => projects.id),
  name: text("name"),
  genreId: text("genre_id").notNull(),
  presetId: text("preset_id").notNull(),
  status: text("status").notNull().default("pending"),
  currentStage: text("current_stage").notNull().default("compilation"),
  reference: text("reference"),
  sourceHash: text("source_hash"),
  inputs: text("inputs"),
  nlAdjustments: text("nl_adjustments"),
  findings: text("findings"),
  compiledJson: text("compiled_json"),
  stageData: text("stage_data"),
  stageAttempt: integer("stage_attempt").notNull().default(0),
  error: text("error"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  isFavorite: integer("is_favorite", { mode: "boolean" })
    .notNull()
    .default(false),
});

export const intentRevisions = sqliteTable("intent_revisions", {
  id: text("id").primaryKey(),
  jobId: text("job_id")
    .notNull()
    .references(() => jobs.id, { onDelete: "cascade" }),
  revisionNumber: integer("revision_number").notNull(),
  schemaVersion: integer("schema_version").notNull(),
  /** JSON: SongIntentV1 */
  intentJson: text("intent_json").notNull(),
  /** JSON: provenance map */
  provenanceJson: text("provenance_json"),
  /** JSON: minimal catalog snapshot (preset values) */
  catalogSnapshotJson: text("catalog_snapshot_json"),
  intentHash: text("intent_hash").notNull(),
  createdAt: text("created_at").notNull(),
});

export const compilations = sqliteTable("compilations", {
  id: text("id").primaryKey(),
  intentRevisionId: text("intent_revision_id")
    .notNull()
    .references(() => intentRevisions.id, { onDelete: "cascade" }),
  compilerVersion: text("compiler_version").notNull(),
  adapterVersion: text("adapter_version").notNull(),
  modelVersion: text("model_version"),
  /** JSON: ResolvedSongIntent */
  resolvedIntentJson: text("resolved_intent_json"),
  /** JSON: ResolutionDecision[] */
  decisionsJson: text("decisions_json"),
  /** JSON: IntentConflict[] */
  warningsJson: text("warnings_json"),
  /** JSON: PromptFragment[] (future) */
  fragmentsJson: text("fragments_json"),
  style: text("style"),
  lyrics: text("lyrics"),
  excludedStyles: text("excluded_styles"),
  createdAt: text("created_at").notNull(),
});

export const versions = sqliteTable("versions", {
  id: text("id").primaryKey(),
  jobId: text("job_id")
    .notNull()
    .references(() => jobs.id, { onDelete: "cascade" }),
  intentRevisionId: text("intent_revision_id").references(
    () => intentRevisions.id,
  ),
  compilationId: text("compilation_id").references(() => compilations.id),
  status: text("status").notNull().default("draft"),
  number: integer("number").notNull(),
  /** JSON-encoded SunoArtifact[] */
  artifacts: text("artifacts").notNull().default("[]"),
  /** Pipeline stage that created this version */
  stage: text("stage"),
  /** Parent version for branch tracking */
  parentVersionId: text("parent_version_id"),
  finalizedAt: text("finalized_at"),
  createdAt: text("created_at").notNull(),
});

export const generations = sqliteTable("generations", {
  id: text("id").primaryKey(),
  jobId: text("job_id")
    .notNull()
    .references(() => jobs.id, { onDelete: "cascade" }),
  versionId: text("version_id").references(() => versions.id, {
    onDelete: "cascade",
  }),
  status: text("status").notNull().default("queued"),
  audioUrl: text("audio_url"),
  imageUrl: text("image_url"),
  videoUrl: text("video_url"),
  duration: integer("duration"),
  generatedTitle: text("generated_title"),
  style: text("style"),
  lyrics: text("lyrics"),
  error: text("error"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  isFavorite: integer("is_favorite", { mode: "boolean" })
    .notNull()
    .default(false),
  seed: integer("seed"),
  /** JSON-encoded PayloadWarning[] from sumo payload construction. */
  payloadWarnings: text("payload_warnings"),
});

// ── Job events (persisted event history for replay) ──────────────────

export const jobEvents = sqliteTable("job_events", {
  id: text("id").primaryKey(),
  jobId: text("job_id")
    .notNull()
    .references(() => jobs.id, { onDelete: "cascade" }),
  sequence: integer("sequence").notNull(),
  stage: text("stage"),
  status: text("status").notNull(),
  data: text("data"),
  error: text("error"),
  timestamp: text("timestamp").notNull(),
});

// ── Suno track records (individual tracks per generation) ────────────

export const sunoTracks = sqliteTable("suno_tracks", {
  id: text("id").primaryKey(),
  generationId: text("generation_id")
    .notNull()
    .references(() => generations.id, { onDelete: "cascade" }),
  index: integer("index").notNull(),
  audioUrl: text("audio_url"),
  imageUrl: text("image_url"),
  videoUrl: text("video_url"),
  duration: integer("duration"),
  title: text("title"),
  createdAt: text("created_at").notNull(),
});
