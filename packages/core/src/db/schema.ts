import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const jobs = sqliteTable("jobs", {
  id: text("id").primaryKey(),
  name: text("name"),
  genreId: text("genre_id").notNull(),
  presetId: text("preset_id").notNull(),
  status: text("status").notNull().default("pending"),
  currentStage: text("current_stage").notNull().default("ref_interpretation"),
  reference: text("reference"),
  sourceHash: text("source_hash"),
  /** JSON-encoded genre-specific user inputs */
  inputs: text("inputs"),
  /** Natural-language adjustment instructions */
  nlAdjustments: text("nl_adjustments"),
  /** JSON-encoded CriticFinding[] from review stage */
  findings: text("findings"),
  /** JSON-encoded compiled artifacts saved when pipeline pauses at review */
  compiledJson: text("compiled_json"),
  /** JSON-encoded intermediate pipeline state (songPlan, rawStyle, rawLyrics, interpretedRef) */
  stageData: text("stage_data"),
  stageAttempt: integer("stage_attempt").notNull().default(0),
  error: text("error"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const versions = sqliteTable("versions", {
  id: text("id").primaryKey(),
  jobId: text("job_id").notNull().references(() => jobs.id),
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
  /** Suno generation ID */
  id: text("id").primaryKey(),
  /** Reference to job */
  jobId: text("job_id").notNull().references(() => jobs.id),
  /** Optional reference to version */
  versionId: text("version_id").references(() => versions.id),
  status: text("status").notNull().default("queued"),
  /** Audio URL from Suno */
  audioUrl: text("audio_url"),
  /** Cover image URL */
  imageUrl: text("image_url"),
  /** Video URL */
  videoUrl: text("video_url"),
  /** Duration in seconds */
  duration: integer("duration"),
  /** Title returned by Suno */
  generatedTitle: text("generated_title"),
  /** Style prompt used */
  style: text("style"),
  /** Error detail if failed */
  error: text("error"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
