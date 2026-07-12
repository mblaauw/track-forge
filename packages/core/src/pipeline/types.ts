import type { Job, Config, InterpretedReference, GenerationStage, StyleWriterResult, LyricsWriterResult, ControlDescriptor } from "@track-forge/contracts";
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
}

/** Mutable state built up across pipeline stages (in-memory, not persisted) */
export interface PipelineState {
  job: Job;
  module: GenreModule;

  // Stage outputs — null until produced
  interpretedRef: InterpretedReference | null;
  songPlan: string | null;
  styleWriterResult: StyleWriterResult | null;
  lyricsWriterResult: LyricsWriterResult | null;
  compiledJson: string | null; // serialized CompiledStyle
  findings: unknown[] | null; // serialized CriticFinding[]
  appliedPatch: string | null; // serialized SurgicalPatch
  versionId: string | null;

  /** Structured adjustment instructions (parsed from job.nlAdjustments) */
  nlAdjustments: ControlDescriptor[] | null;
}

/** Stage handler function signature */
export type StageHandler = (
  state: PipelineState,
  deps: PipelineDeps,
) => Promise<PipelineState>;

export interface StageDefinition {
  name: string;
  handler: StageHandler;
}

export interface PipelineResult {
  success: boolean;
  jobId: string;
  versionId: string | null;
  error: string | null;
}

/**
 * Structured context for prompt template filling.
 * Fields are flattened to support {{key}} replacement.
 */
export interface PromptContext {
  /** Genre module identifiers */
  genreId: string;
  genreName: string;
  presetId: string;
  /** Raw reference text */
  reference: string | null;
  /** Formatted interpreted reference (null if no ref or not yet interpreted) */
  interpretedRef: string | null;
  /** Natural-language adjustment instructions */
  nlAdjustments: string | null;
  /** Input field values (flattened) */
  [key: string]: unknown;
}

/** Resolved prompts keyed by pipeline stage */
export type PromptManifest = Partial<Record<GenerationStage, string>>;
