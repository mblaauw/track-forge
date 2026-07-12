import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const jobs = sqliteTable("jobs", {
  id: text("id").primaryKey(),
  genreId: text("genre_id").notNull(),
  presetId: text("preset_id").notNull(),
  status: text("status").notNull().default("pending"),
  currentStage: text("current_stage").notNull().default("ref_interpretation"),
  reference: text("reference"),
  sourceHash: text("source_hash"),
  /** JSON-encoded genre-specific user inputs */
  inputs: text("inputs"),
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
  finalizedAt: text("finalized_at"),
  createdAt: text("created_at").notNull(),
});
