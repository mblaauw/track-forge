import type {
  Job,
  Config,
  GenerationStage,
  LyricsWriterResult,
  VersionId,
} from "@track-forge/contracts";
import type { GenreModule } from "@track-forge/genre-core";
import type { Db } from "../db/index.js";
import type { LlmRequest, LlmResponse } from "../llm/index.js";

/** Injectable dependencies for pipeline execution */
export interface PipelineDeps {
  db: Db;
  /** Any object with a `complete` method matching the LLM contract */
  llm: { complete(req: LlmRequest): Promise<LlmResponse> };
  config: Config;
  signal?: AbortSignal;
}

/** Parsed inputs shared across pipeline stages */
export interface ParsedInputs {
  inputs: Record<string, unknown>;
  presetIds: string[];
  presetLabels: string[];
  descriptors: { label: string; cat: string; weight: number }[];
  rawSections: Record<string, unknown>[];
}

/** Mutable state built up across pipeline stages (in-memory, not persisted) */
export interface PipelineState {
  job: Job;
  module: GenreModule;

  /** Parsed inputs (cached after first parse) */
  parsed?: ParsedInputs;
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
