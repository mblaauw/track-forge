import type {
  Job,
  Config,
  GenerationStage,
  LyricsWriterResult,
  VersionId,
} from "@track-forge/contracts";
import type { GenreModule } from "@track-forge/genre-core";
import type { Db } from "../db/index.js";
import type { LlmClient } from "../llm/index.js";
import type { SunoClient } from "../suno/index.js";

/** Injectable dependencies for pipeline execution */
export interface PipelineDeps {
  db: Db;
  llm: LlmClient;
  suno: SunoClient;
  config: Config;
  signal?: AbortSignal;
}

/** Mutable state built up across pipeline stages (in-memory, not persisted) */
export interface PipelineState {
  job: Job;
  module: GenreModule;

  /** Compiled style JSON (produced by compilation stage) */
  compiledJson: string | null;
  /** Lyrics writer result (produced by lyrics_writing stage) */
  lyricsWriterResult: LyricsWriterResult | null;
  /** Created version ID (produced by versioning stage) */
  versionId: VersionId | null;
}

export interface PipelineResult {
  success: boolean;
  jobId: string;
  versionId: VersionId | null;
  error: string | null;
}


