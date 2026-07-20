export { createDb, schema, getSqlite } from "./db/index.js";
export type { Db } from "./db/index.js";
export { loadConfig } from "./config.js";

// LLM client
export { LlmClient, LlmError, createLlmClient } from "./llm/index.js";
export type {
  LlmMessage,
  LlmRequest,
  LlmResponse,
  LlmProvider,
} from "./llm/index.js";

// Suno integration
export {
  SunoClient,
  createSunoClientConfig,
  resolveCallbackUrl,
  getCapabilities,
  generateSunoPayload,
  payloadToLog,
  storeGeneration,
  updateGeneration,
  getGeneration,
  listGenerations,
} from "./suno/index.js";
export type {
  SunoCapabilities,
  SunoClientConfig,
  SunoGenerateRequest,
  SunoFeedItem,
  SunoSubmitResult,
  SunoGenerationStatus,
  SunoModelVersion,
  SunoPayloadInput,
  SunoGenreTransform,
  PayloadWarning,
  GenerationRecord,
} from "./suno/index.js";

export {
  abortJob,
  compileStylePrompt,
  buildSunoContext,
} from "./pipeline/index.js";
export type {
  CompileStyleInput,
  CompileStyleResult,
  SunoContextInput,
} from "./pipeline/index.js";
// Pipeline
export {
  runPipeline,
  trace,
  createJob,
  loadJob,
  resetJobStage,
  cancelJob,
  subscribe,
  publish,
  unsubscribeAll,
  getJobEvents,
  formatSseEvent,
} from "./pipeline/index.js";
export type {
  PipelineDeps,
  PipelineState,
  PipelineResult,
  PipelineEvent,
} from "./pipeline/index.js";
