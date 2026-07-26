import type {
  SunoGenerateRequest,
  SunoModelVersion,
  PromptFragment,
  CompiledArtifacts,
} from "./types.js";
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
  /**
   * Optional fragments for fragment-aware truncation.
   * When provided, truncation drops complete low-priority fragments
   * instead of character-slicing through meaningful content.
   */
  fragments?: {
    style?: PromptFragment[];
    lyrics?: PromptFragment[];
    exclusions?: PromptFragment[];
  };
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
 *
 * Truncation is fragment-aware when `input.fragments` is provided:
 * low-priority fragments are dropped whole rather than character-slicing.
 */
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

  // ── Style (fragment-aware truncation) ────────────────────────────
  let { text: style, fragments: styleFrags } = fragmentTruncate(
    input.style,
    input.fragments?.style,
    caps.maxStyleLength,
    "style",
    warnings,
  );

  // ── Negative tags (excluded styles) ──────────────────────────────
  let { text: negativeTags } = fragmentTruncate(
    input.excludedStyles,
    input.fragments?.exclusions,
    caps.maxTagsLength,
    "negativeTags",
    warnings,
  );

  // ── Lyrics (fragment-aware) ──────────────────────────────────────
  let { text: prompt } = fragmentTruncate(
    input.lyrics,
    input.fragments?.lyrics,
    caps.maxLyricsLength,
    "lyrics",
    warnings,
  );

  // ── Instrumental flag ────────────────────────────────────────────
  const instrumental = prompt.trim().length === 0;

  // ── Title ────────────────────────────────────────────────────────
  const title = applySimpleTruncation(
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

// ── Fragment-aware truncation ────────────────────────────────────────

/**
 * Truncate a text value, preferring to drop complete low-priority fragments
 * before character-slicing. Falls back to character slicing as a last resort.
 */
function fragmentTruncate(
  value: string,
  fragments: PromptFragment[] | undefined,
  max: number,
  field: PayloadWarning["field"],
  warnings: PayloadWarning[],
): { text: string; fragments?: PromptFragment[] } {
  if (value.length <= max) return { text: value, fragments };

  if (!fragments || fragments.length === 0) {
    // No fragments available — fall back to character slicing.
    return {
      text: applySimpleTruncation(value, max, field, warnings),
      fragments,
    };
  }

  // Sort by priority ascending (lowest priority first to drop)
  const sorted = [...fragments].sort((a, b) => a.priority - b.priority);
  const kept: PromptFragment[] = [];
  let remaining = "";

  for (let i = sorted.length - 1; i >= 0; i--) {
    const candidate = [sorted[i]!.text, remaining].filter(Boolean).join(". ");
    if (candidate.length <= max) {
      kept.unshift(sorted[i]!);
      remaining = candidate;
    }
  }

  if (remaining.length <= max && remaining.length > 0) {
    warnings.push({
      field,
      message: `Dropped ${fragments.length - kept.length} low-priority fragment(s); ${remaining.length} of ${max} chars used`,
      currentLength: remaining.length,
      maxLength: max,
      priority: PRIORITY[field],
    });
    return { text: remaining, fragments: kept };
  }

  // Even dropping all fragments didn't help — fall back to character slicing
  return {
    text: applySimpleTruncation(value, max, field, warnings),
    fragments,
  };
}

/**
 * Blind character-slice truncation — last resort fallback.
 * Reports a warning when truncation occurs.
 */
function applySimpleTruncation(
  value: string,
  max: number,
  field: PayloadWarning["field"],
  warnings: PayloadWarning[],
): string {
  if (value.length <= max) return value;
  warnings.push({
    field,
    message: `${field} truncated from ${value.length} to ${max} chars (character-sliced)`,
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
