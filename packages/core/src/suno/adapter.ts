import type { SunoGenerateRequest, SunoModelVersion } from "./types.js";
import type { SunoCapabilities } from "./capabilities.js";
import type { SunoPayloadInput, PayloadWarning } from "./payload.js";
import { getCapabilities } from "./capabilities.js";
import { generateSunoPayload } from "./payload.js";

/**
 * SunoAdapter — typed boundary between the pipeline's compiled artifacts
 * and the Suno API provider.
 *
 * Responsibilities:
 *  - Report provider capabilities per model version.
 *  - Build an API-ready `SunoGenerateRequest` from compiled artifacts.
 *
 * Provider-specific logic (length limits, exclusion support, instrumental
 * inference, vocal-gender field) lives here; genre interpretation belongs
 * before this adapter (in the intent pipeline).
 */
export interface SunoAdapter {
  readonly id: "suno";
  readonly adapterVersion: string;

  /** Return capabilities for a given model version (or default). */
  capabilities(model?: SunoModelVersion): SunoCapabilities;

  /**
   * Build a `SunoGenerateRequest` from compiled artifacts.
   * Returns the request and any payload warnings (truncation, etc.).
   */
  buildPayload(
    input: SunoPayloadInput,
    model?: SunoModelVersion,
  ): {
    request: SunoGenerateRequest;
    warnings: PayloadWarning[];
  };
}

// ── Default adapter instance ──────────────────────────────────────────

export const sunoAdapter: SunoAdapter = {
  id: "suno",
  adapterVersion: "1.0.0",

  capabilities(model?: SunoModelVersion): SunoCapabilities {
    return getCapabilities(model);
  },

  buildPayload(
    input: SunoPayloadInput,
    model?: SunoModelVersion,
  ): { request: SunoGenerateRequest; warnings: PayloadWarning[] } {
    const caps = model
      ? getCapabilities(model)
      : getCapabilities(input.modelVersion);
    return generateSunoPayload(input, caps);
  },
};
