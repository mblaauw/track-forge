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
  /** Optional genre metadata for payload transformations */
  genreTransform?: SunoGenreTransform;
  /** Override default model version */
  modelVersion?: SunoModelVersion;
  /** Optional callback URL */
  callbackUrl?: string;
}

export interface SunoGenreTransform {
  genreId: string;
  subgenre?: string;
  bpm?: number;
  mood?: string;
  energy?: number;
}

// ── Validation types ─────────────────────────────────────────────────

export interface PayloadWarning {
  field: "style" | "negativeTags" | "lyrics" | "title";
  message: string;
  currentLength: number;
  maxLength: number;
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
export function generateSunoPayload(
  input: SunoPayloadInput,
  capabilities?: SunoCapabilities,
): { request: SunoGenerateRequest; warnings: PayloadWarning[] } {
  const caps = capabilities ?? getCapabilities(input.modelVersion);
  const warnings: PayloadWarning[] = [];

  // ── Model version ────────────────────────────────────────────────
  const model: SunoModelVersion = input.modelVersion ?? "V4_5ALL";

  // ── Style ────────────────────────────────────────────────────────
  let style = input.style;
  if (input.genreTransform) {
    style = applyGenreTransform(style, input.genreTransform);
  }
  if (style.length > caps.maxStyleLength) {
    warnings.push({
      field: "style",
      message: `Style truncated from ${style.length} to ${caps.maxStyleLength} chars`,
      currentLength: style.length,
      maxLength: caps.maxStyleLength,
    });
    style = style.slice(0, caps.maxStyleLength);
  }

  // ── Negative tags (excluded styles) ──────────────────────────────
  let negativeTags = input.excludedStyles;
  if (caps.supportsNegativeTags && negativeTags.length > caps.maxTagsLength) {
    warnings.push({
      field: "negativeTags",
      message: `Negative tags truncated from ${negativeTags.length} to ${caps.maxTagsLength} chars`,
      currentLength: negativeTags.length,
      maxLength: caps.maxTagsLength,
    });
    negativeTags = negativeTags.slice(0, caps.maxTagsLength);
  }

  // ── Lyrics (mapped to prompt) ────────────────────────────────────
  let prompt = input.lyrics;
  if (prompt.length > caps.maxLyricsLength) {
    warnings.push({
      field: "lyrics",
      message: `Lyrics truncated from ${prompt.length} to ${caps.maxLyricsLength} chars`,
      currentLength: prompt.length,
      maxLength: caps.maxLyricsLength,
    });
    prompt = prompt.slice(0, caps.maxLyricsLength);
  }

  // ── Instrumental flag ────────────────────────────────────────────
  // Empty or whitespace-only lyrics → instrumental
  const instrumental = prompt.trim().length === 0;

  // ── Title ────────────────────────────────────────────────────────
  const title = input.title || "Untitled";
  if (title.length > caps.maxTitleLength) {
    warnings.push({
      field: "title",
      message: `Title truncated from ${title.length} to ${caps.maxTitleLength} chars`,
      currentLength: title.length,
      maxLength: caps.maxTitleLength,
    });
  }

  const request: SunoGenerateRequest = {
    customMode: true,
    instrumental,
    model,
    title: title.slice(0, caps.maxTitleLength),
    style,
    callBackUrl: caps.supportsCallbacks ? input.callbackUrl : undefined,
  };

  // Only include prompt (lyrics) if not instrumental
  if (!instrumental && prompt.length > 0) {
    request.prompt = prompt;
  }

  // Only include negativeTags if supported and non-empty
  if (caps.supportsNegativeTags && negativeTags.length > 0) {
    request.negativeTags = negativeTags;
  }

  return { request, warnings };
}

// ── Genre-specific transformations ───────────────────────────────────

function applyGenreTransform(
  style: string,
  transform: SunoGenreTransform,
): string {
  const additions: string[] = [];

  // Add BPM info if available (EDM, etc.)
  if (transform.bpm) {
    // Only add if the style doesn't already mention BPM
    if (!/\b\d{2,3}\s*BPM\b/i.test(style)) {
      additions.push(`${transform.bpm} BPM`);
    }
  }

  // Add mood if available and not already in style
  if (transform.mood) {
    const moodLower = transform.mood.toLowerCase();
    const styleLower = style.toLowerCase();
    if (!styleLower.includes(moodLower)) {
      additions.push(`Mood: ${transform.mood}`);
    }
  }

  // Add energy descriptor
  if (transform.energy !== undefined) {
    if (transform.energy >= 8 && !/high energy/i.test(style)) {
      additions.push("High energy");
    } else if (transform.energy <= 4 && !/low energy/i.test(style)) {
      additions.push("Low energy");
    }
  }

  if (additions.length === 0) return style;

  return `${style.trim()} ${additions.join(". ")}.`.trim();
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
