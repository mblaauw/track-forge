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

export const versions = sqliteTable("versions", {
  id: text("id").primaryKey(),
  jobId: text("job_id")
    .notNull()
    .references(() => jobs.id),
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
    .references(() => jobs.id),
  versionId: text("version_id").references(() => versions.id),
  status: text("status").notNull().default("queued"),
  audioUrl: text("audio_url"),
  imageUrl: text("image_url"),
  videoUrl: text("video_url"),
  duration: integer("duration"),
  generatedTitle: text("generated_title"),
  style: text("style"),
  error: text("error"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  isFavorite: integer("is_favorite", { mode: "boolean" })
    .notNull()
    .default(false),
  seed: integer("seed"),
});

// ── Job events (persisted event history for replay) ──────────────────

export const jobEvents = sqliteTable("job_events", {
  id: text("id").primaryKey(),
  jobId: text("job_id")
    .notNull()
    .references(() => jobs.id),
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
    .references(() => generations.id),
  index: integer("index").notNull(),
  audioUrl: text("audio_url"),
  imageUrl: text("image_url"),
  videoUrl: text("video_url"),
  duration: integer("duration"),
  title: text("title"),
  createdAt: text("created_at").notNull(),
});
