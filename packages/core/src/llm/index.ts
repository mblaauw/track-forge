export { LlmClient, LlmError, createLlmClient } from "./client.js";
export type {
  LlmMessage,
  LlmRequest,
  LlmResponse,
  LlmProvider,
} from "./types.js";
export { PROVIDER_DEFAULTS } from "./types.js";
export { writeLyrics, buildLyricsPrompt } from "./lyrics-writer.js";
export type {
  LyricsLlm,
  LyricsWriterInput,
  LyricsWriterOutput,
  LyricsWriterSectionInput,
  LyricsWriterSectionResult,
  LyricsWriterVocal,
} from "./lyrics-writer.js";
