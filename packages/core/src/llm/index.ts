export {
  LlmClient,
  LlmError,
  createLlmClient,
  getProviderCapabilities,
  buildProviderRequest,
} from "./client.js";
export type { ProviderRequest } from "./client.js";
export type {
  LlmMessage,
  LlmRequest,
  LlmResponse,
  LlmProvider,
  LogicalLlmRequest,
  ProviderCapabilities,
  ProviderConfig,
} from "./types.js";
export { PROVIDER_DEFAULTS } from "./types.js";
export {
  writeLyrics,
  buildLyricsPrompt,
  validateLyricsSemantics,
  lintRenderedLyricsRequest,
  expectedLineCountForSection,
  LyricsWriterError,
} from "./lyrics-writer.js";
export { writeLyricsTrace } from "./lyrics-trace.js";
export { recordPromptManifest } from "./prompt-manifest.js";
export type { PromptTraceLink } from "./prompt-manifest.js";
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
} from "./lyrics-writer.js";
