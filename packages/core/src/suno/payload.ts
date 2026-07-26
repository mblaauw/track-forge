import type { SunoGenerateRequest, SunoModelVersion } from "./types.js";
import { getCapabilities } from "./capabilities.js";
import type { SunoCapabilities } from "./capabilities.js";

// ── Input types ──────────────────────────────────────────────────────

export interface SunoPayloadInput {
  /** Compiled title artifact */
  title: string;
  /** Compiled style description artifact */
  style: string;
  /** Compiled excluded-styles artifact */
  excludedStyles: string;
  /** Compiled lyrics artifact */
  lyrics: string;
  /** Override default model version */
  modelVersion?: SunoModelVersion;
  /** Optional callback URL */
  callbackUrl?: string;
  /** Dominant vocal gender across the arrangement's vocal sections, if any. */
  vocalGender?: "m" | "f";
}

export interface PayloadWarning {
  field: "style" | "negativeTags" | "lyrics" | "title";
  message: string;
  currentLength: number;
  maxLength: number;
  /** Priority for drop-order-aware truncation (lower = dropped first) */
  priority: number;
}

// ── Payload generation ───────────────────────────────────────────────

/**
 * Transform compiled artifacts into a SunoGenerateRequest (v1 API).
 *
 * Steps:
 *  1. Apply genre-specific transformations to style string.
 *  2. Determine `instrumental` from lyrics content.
 *  3. Map excludedStyles to negativeTags.
 *  4. Validate against model capabilities (truncate with warning).
 *  5. Return request + warnings.
 */
// Priority tiers for fragment-aware truncation (lower = dropped first).
const PRIORITY: Record<PayloadWarning["field"], number> = {
  title: 0,
  negativeTags: 1,
  lyrics: 2,
  style: 3,
};

export function generateSunoPayload(
  input: SunoPayloadInput,
  capabilities?: SunoCapabilities,
): { request: SunoGenerateRequest; warnings: PayloadWarning[] } {
  const caps = capabilities ?? getCapabilities(input.modelVersion);
  const warnings: PayloadWarning[] = [];

  const model: SunoModelVersion = input.modelVersion ?? "V4_5ALL";

  // ── Style ────────────────────────────────────────────────────────
  let style = applyTruncation(
    input.style,
    caps.maxStyleLength,
    "style",
    warnings,
  );

  // ── Negative tags (excluded styles) ──────────────────────────────
  let negativeTags = input.excludedStyles;
  if (caps.supportsNegativeTags && negativeTags.length > caps.maxTagsLength) {
    warnings.push({
      field: "negativeTags",
      message: `Negative tags truncated from ${negativeTags.length} to ${caps.maxTagsLength} chars`,
      currentLength: negativeTags.length,
      maxLength: caps.maxTagsLength,
      priority: PRIORITY.negativeTags,
    });
    negativeTags = negativeTags.slice(0, caps.maxTagsLength);
  }

  // ── Lyrics (mapped to prompt) ────────────────────────────────────
  let prompt = applyTruncation(
    input.lyrics,
    caps.maxLyricsLength,
    "lyrics",
    warnings,
  );

  // ── Instrumental flag ────────────────────────────────────────────
  const instrumental = prompt.trim().length === 0;

  // ── Title ────────────────────────────────────────────────────────
  const title = applyTruncation(
    input.title || "Untitled",
    caps.maxTitleLength,
    "title",
    warnings,
  );

  const request: SunoGenerateRequest = {
    customMode: true,
    instrumental,
    model,
    title,
    style,
    callBackUrl: caps.supportsCallbacks ? input.callbackUrl : undefined,
  };

  if (!instrumental && prompt.length > 0) request.prompt = prompt;
  if (!instrumental && input.vocalGender)
    request.vocalGender = input.vocalGender;
  if (caps.supportsNegativeTags && negativeTags.length > 0)
    request.negativeTags = negativeTags;

  return { request, warnings };
}

function applyTruncation(
  value: string,
  max: number,
  field: PayloadWarning["field"],
  warnings: PayloadWarning[],
): string {
  if (value.length <= max) return value;
  warnings.push({
    field,
    message: `${field} truncated from ${value.length} to ${max} chars`,
    currentLength: value.length,
    maxLength: max,
    priority: PRIORITY[field],
  });
  return value.slice(0, max);
}

// ── Utility ──────────────────────────────────────────────────────────

export function payloadToLog(
  request: SunoGenerateRequest,
): Record<string, unknown> {
  return {
    title: request.title,
    style: request.style.slice(0, 200),
    prompt: request.prompt?.slice(0, 200),
    instrumental: request.instrumental,
    model: request.model,
    negativeTags: request.negativeTags?.slice(0, 200),
    callbackUrl: request.callBackUrl,
  };
}
