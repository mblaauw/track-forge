import type {
  Job,
  Config,
  GenerationStage,
  LyricsWriterResult,
  VersionId,
} from "@track-forge/contracts";
import type { GenreModule } from "@track-forge/genre-core";
import type {
  ResolvedSongIntent,
  SongIntentV1,
} from "@track-forge/song-intent";
import type { PromptFragment } from "../suno/types.js";
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

/** Mutable state built up across pipeline stages (in-memory, not persisted) */
export interface PipelineState {
  job: Job;
  module: GenreModule;

  /** Resolved song intent (produced by compilation stage from frozen intent revision) */
  resolved?: ResolvedSongIntent;
  /** Compiled style JSON (produced by compilation stage) */
  compiledJson: string | null;
  /** Lyrics writer result (produced by lyrics_writing stage) */
  lyricsWriterResult: LyricsWriterResult | null;
  /** Created version ID (produced by versioning stage) */
  versionId: VersionId | null;
  /** Frozen intent revision ID (set before pipeline starts) */
  intentRevisionId?: string;
  /** The SongIntentV1 that was frozen (stages use this instead of re-parsing job.inputs) */
  frozenIntent?: SongIntentV1;
  /** Pre-generated lyrics from UI (side-channel, not part of intent) */
  preGeneratedLyrics?: Record<string, string[]>;
  /** Compiled prompt fragments (produced by compilation stage via sunoAdapter.render()) */
  compiledFragments?: {
    style: PromptFragment[];
    lyrics: PromptFragment[];
    exclusions: PromptFragment[];
  };
  /** Compilation record ID (set during versioning stage) */
  compilationId?: string;
}

export interface PipelineResult {
  success: boolean;
  jobId: string;
  versionId: VersionId | null;
  error: string | null;
}
