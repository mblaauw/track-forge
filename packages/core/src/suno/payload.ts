import type {
  SunoGenerateRequest,
  SunoModelVersion,
  PromptFragment,
} from "./types.js";
import {
  DEFAULT_SUNO_MODEL,
  DEFAULT_SUNO_VARIETY,
  SUNO_VARIETY_LEVELS,
  type SunoRenderSettings,
} from "@track-forge/contracts";
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
   * Arrangement length in seconds. v6 renders 20 seconds when no duration
   * is sent, so callers should always supply this.
   */
  durationSec?: number;
  /** Per-take settings (variety, weirdness, style influence). */
  settings?: Pick<
    SunoRenderSettings,
    "variety" | "weirdness" | "styleInfluence"
  >;
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
  field: "style" | "negativeTags" | "lyrics" | "title" | "duration";
  message: string;
  currentLength: number;
  maxLength: number;
  /** Priority for drop-order-aware truncation (lower = dropped first) */
  priority: number;
}

// ── Payload generation ───────────────────────────────────────────────

const PRIORITY: Record<PayloadWarning["field"], number> = {
  title: 0,
  negativeTags: 1,
  lyrics: 2,
  style: 3,
  duration: 4,
};

/**
 * Transform compiled artifacts into a v6 custom-mode SunoGenerateRequest.
 *
 * Steps:
 *  1. Truncate style / negative tags / lyrics / title to the v6 limits
 *     (fragment-aware when `input.fragments` is provided).
 *  2. Determine `instrumental` from lyrics content.
 *  3. Clamp the requested duration into the provider's 10–360 s window.
 *  4. Attach per-take settings — variety defaults to 0 so Suno leaves the
 *     compiled style prompt untouched.
 *  5. Return request + warnings.
 */
export function generateSunoPayload(
  input: SunoPayloadInput,
  capabilities?: SunoCapabilities,
): { request: SunoGenerateRequest; warnings: PayloadWarning[] } {
  const caps = capabilities ?? getCapabilities(input.modelVersion);
  const warnings: PayloadWarning[] = [];

  const model: SunoModelVersion = input.modelVersion ?? DEFAULT_SUNO_MODEL;

  // ── Style (fragment-aware truncation) ────────────────────────────
  const { text: style } = fragmentTruncate(
    input.style,
    input.fragments?.style,
    caps.maxStyleLength,
    "style",
    warnings,
  );

  // ── Negative tags (excluded styles) ──────────────────────────────
  const { text: negativeTags } = fragmentTruncate(
    input.excludedStyles,
    input.fragments?.exclusions,
    caps.maxNegativeTagsLength,
    "negativeTags",
    warnings,
  );

  // ── Lyrics (fragment-aware) ──────────────────────────────────────
  const { text: lyrics } = fragmentTruncate(
    input.lyrics,
    input.fragments?.lyrics,
    caps.maxLyricsLength,
    "lyrics",
    warnings,
  );

  // ── Instrumental flag ────────────────────────────────────────────
  const instrumental = lyrics.trim().length === 0;

  // The provider rejects a custom-mode request with nothing to go on.
  if (style.trim().length === 0 && instrumental && negativeTags.length === 0) {
    throw new Error(
      "Nothing to send to Suno: style, lyrics and excluded styles are all empty",
    );
  }

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
    variety: clampInt(
      input.settings?.variety ?? DEFAULT_SUNO_VARIETY,
      0,
      SUNO_VARIETY_LEVELS.length - 1,
    ),
    callBackUrl: caps.supportsCallbacks ? input.callbackUrl : undefined,
  };

  if (!instrumental) request.lyrics = lyrics;
  if (!instrumental && input.vocalGender)
    request.vocalGender = input.vocalGender;
  if (caps.supportsNegativeTags && negativeTags.length > 0)
    request.negativeTags = negativeTags;

  // ── Duration ─────────────────────────────────────────────────────
  const duration = resolveDuration(input.durationSec, caps, warnings);
  if (duration !== undefined) request.duration = duration;

  // ── Sliders (omitted → Suno's own defaults) ──────────────────────
  if (input.settings?.styleInfluence !== undefined)
    request.styleWeight = unit(input.settings.styleInfluence);
  if (input.settings?.weirdness !== undefined)
    request.weirdnessConstraint = unit(input.settings.weirdness);

  return { request, warnings };
}

function resolveDuration(
  requested: number | undefined,
  caps: SunoCapabilities,
  warnings: PayloadWarning[],
): number | undefined {
  if (
    requested === undefined ||
    !Number.isFinite(requested) ||
    requested <= 0
  ) {
    warnings.push({
      field: "duration",
      message:
        "No duration known for this version; Suno will render 20 seconds",
      currentLength: 0,
      maxLength: caps.maxDurationSec,
      priority: PRIORITY.duration,
    });
    return undefined;
  }
  const rounded = Math.round(requested);
  const clamped = Math.min(
    caps.maxDurationSec,
    Math.max(caps.minDurationSec, rounded),
  );
  if (clamped !== rounded) {
    warnings.push({
      field: "duration",
      message:
        rounded > clamped
          ? `Arrangement runs ${rounded}s; Suno v6 renders at most ${clamped}s, so the take will be shorter`
          : `Arrangement runs ${rounded}s; Suno v6 renders at least ${clamped}s`,
      currentLength: clamped,
      maxLength: caps.maxDurationSec,
      priority: PRIORITY.duration,
    });
  }
  return clamped;
}

/** Clamp to 0–1 and round to the two decimals the provider accepts. */
function unit(value: number): number {
  return Math.round(Math.min(1, Math.max(0, value)) * 100) / 100;
}

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
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
 * Avoids cutting inside Suno bracket tags ([Verse], [Chorus], etc.)
 * by breaking at the nearest preceding natural boundary.
 */
function applySimpleTruncation(
  value: string,
  max: number,
  field: PayloadWarning["field"],
  warnings: PayloadWarning[],
): string {
  if (value.length <= max) return value;

  // Find last safe break point before max: prefer newline, then space,
  // then before an unopened bracket tag.
  let breakAt = Math.min(max, value.length);
  const remainder = value.slice(0, breakAt);

  // Don't cut inside [Tag] — find the opening bracket before breakAt
  // and cut before it if there's no matching closing bracket.
  const lastOpenBracket = remainder.lastIndexOf("[");
  const lastCloseBracket = remainder.lastIndexOf("]");
  if (lastOpenBracket > lastCloseBracket) {
    // We're inside a bracket tag — cut before the opening bracket
    breakAt = Math.max(lastOpenBracket, 0);
  }

  // If that puts us at 0, fall back to character boundary
  if (breakAt === 0) breakAt = Math.min(max, value.length);

  const result = value.slice(0, breakAt);
  warnings.push({
    field,
    message: `${field} truncated from ${value.length} to ${result.length} chars (character-sliced)`,
    currentLength: result.length,
    maxLength: max,
    priority: PRIORITY[field],
  });
  return result;
}

// ── Utility ──────────────────────────────────────────────────────────

export function payloadToLog(
  request: SunoGenerateRequest,
): Record<string, unknown> {
  return {
    title: request.title,
    style: request.style.slice(0, 200),
    lyrics: request.lyrics?.slice(0, 200),
    instrumental: request.instrumental,
    model: request.model,
    duration: request.duration,
    variety: request.variety,
    styleWeight: request.styleWeight,
    weirdnessConstraint: request.weirdnessConstraint,
    vocalGender: request.vocalGender,
    negativeTags: request.negativeTags?.slice(0, 200),
    callbackUrl: request.callBackUrl,
  };
}
