export { createDb, schema } from "./db/index.js";
export type { Db } from "./db/index.js";
export { loadConfig } from "./config.js";

// LLM client
export { LlmClient, LlmError, createLlmClient } from "./llm/index.js";
export type { LlmMessage, LlmRequest, LlmResponse, LlmProvider } from "./llm/index.js";

// Suno integration
export {
  SunoClient,
  createSunoClientConfig,
  resolveCallbackUrl,
  resolveCompletionMode,
  getCapabilities,
  registerCapabilities,
} from "./suno/index.js";
export type {
  CompletionMode,
  SunoCapabilities,
  SunoClientConfig,
  SunoGenerateRequest,
  SunoFeedItem,
  SunoSubmitResult,
  SunoGenerationStatus,
  SunoModelVersion,
} from "./suno/index.js";

// Lyrics canonical grammar
export { parseLyrics, serializeLyrics, isInstrumental } from "./lyrics/index.js";

// Pipeline
export { runPipeline, createJob, loadJob, resetJobStage, cancelJob, ReferenceCache, interpretReference, formatInterpretedRef, parseInterpretation, PromptAssembler, fillTemplate, buildPromptContext, subscribe, publish, unsubscribeAll } from "./pipeline/index.js";
export type { PipelineDeps, PipelineState, PipelineResult, PipelineEvent, PromptContext, PromptManifest } from "./pipeline/index.js";
export type { GenerationStage } from "@track-forge/contracts";
