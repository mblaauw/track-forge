export { createDb, schema, getSqlite } from "./db/index.js";
export {
  freezeIntentRevision,
  createCompilation,
  loadIntentRevision,
  parseRevisionIntent,
} from "./intent-revisions/index.js";
export type {
  IntentRevision,
  CompilationRecord,
} from "./intent-revisions/index.js";
export type { Db } from "./db/index.js";
export { loadConfig } from "./config.js";

// LLM client
export {
  LlmClient,
  LlmError,
  createLlmClient,
  getProviderCapabilities,
  buildProviderRequest,
} from "./llm/index.js";
export type { ProviderRequest } from "./llm/index.js";
export type {
  LlmMessage,
  LlmRequest,
  LlmResponse,
  LlmProvider,
  LogicalLlmRequest,
  ProviderCapabilities,
  ProviderConfig,
} from "./llm/index.js";
export {
  writeLyrics,
  buildLyricsPrompt,
  writeLyricsTrace,
  validateLyricsSemantics,
  lintRenderedLyricsRequest,
  expectedLineCountForSection,
  LyricsWriterError,
  recordPromptManifest,
} from "./llm/index.js";
export type {
  LyricsLlm,
  LyricsWriterInput,
  LyricsWriterOutput,
  LyricsWriterSectionInput,
  LyricsWriterSectionResult,
  LyricsWriterVocal,
  ValidationIssue,
  PromptDiagnostic,
  LyricsWriterErrorType,
  PromptManifest,
  PromptAttemptTelemetry,
  PromptTraceLink,
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
  storeTracks,
} from "./suno/index.js";
export type {
  SunoCapabilities,
  SunoClientConfig,
  SunoGenerateRequest,
  SunoFeedItem,
  SunoTrack,
  SunoSubmitResult,
  SunoGenerationStatus,
  SunoModelVersion,
  SunoPayloadInput,
  PayloadWarning,
  GenerationRecord,
} from "./suno/index.js";

export { abortJob, renderSunoStyle } from "./pipeline/index.js";
export type {
  CompileStyleInput,
  CompileStyleResult,
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
