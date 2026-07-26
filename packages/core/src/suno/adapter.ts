import type {
  SunoGenerateRequest,
  SunoModelVersion,
  PromptFragment,
  CompiledArtifacts,
} from "./types.js";
import type { SunoCapabilities } from "./capabilities.js";
import type { SunoPayloadInput, PayloadWarning } from "./payload.js";
import type { ResolvedSongIntent } from "@track-forge/song-intent";
import { getCapabilities } from "./capabilities.js";
import { generateSunoPayload } from "./payload.js";

/**
 * SunoAdapter — typed boundary between the pipeline's compiled artifacts
 * and the Suno API provider.
 *
 * Responsibilities:
 *  - Report provider capabilities per model version.
 *  - Render a `ResolvedSongIntent` into structured fragments + flat strings.
 *  - Build an API-ready `SunoGenerateRequest` from compiled artifacts,
 *    with fragment-aware truncation.
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
   * Render a resolved song intent into structured `CompiledArtifacts`
   * containing prompt fragments and flat strings.
   *
   * The fragments enable fragment-aware truncation at `buildPayload` time:
   * low-priority fragments are dropped whole rather than character-slicing
   * through meaningful content.
   */
  render(resolved: ResolvedSongIntent): CompiledArtifacts;

  /**
   * Build a `SunoGenerateRequest` from compiled artifacts.
   * Applies fragment-aware truncation based on model capabilities.
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

/** Build a style fragment with source + priority metadata. */
function fragment(
  id: string,
  source: PromptFragment["source"],
  text: string,
  priority: number,
): PromptFragment {
  return {
    id,
    source,
    text,
    priority,
    byteLength: Buffer.byteLength(text, "utf-8"),
  };
}

export const sunoAdapter: SunoAdapter = {
  id: "suno",
  adapterVersion: "1.0.0",

  capabilities(model?: SunoModelVersion): SunoCapabilities {
    return getCapabilities(model);
  },

  render(resolved: ResolvedSongIntent): CompiledArtifacts {
    const styleFragments: PromptFragment[] = [];

    // Genre + preset label (core identity — highest priority)
    const genreStr = resolved.genreName || "";
    const presetStr = resolved.presetLabels.filter(Boolean).join(", ");
    if (genreStr) {
      styleFragments.push(fragment("genre", "genre", genreStr, 100));
    }
    if (presetStr) {
      styleFragments.push(fragment("preset", "preset", presetStr, 95));
    }

    // BPM (structural — high priority)
    if (resolved.bpm) {
      styleFragments.push(
        fragment("bpm", "bpm", `around ${resolved.bpm} BPM`, 90),
      );
    }

    // Key (if present)
    if (resolved.key) {
      styleFragments.push(fragment("key", "key", `in ${resolved.key}`, 80));
    }

    // Characteristics (genre-defining elements)
    for (const c of resolved.characteristics ?? []) {
      styleFragments.push(fragment(`char-${c}`, "characteristic", c, 70));
    }

    // Descriptors (sorted by weight descending)
    const descriptors = [...(resolved.descriptors ?? [])].sort(
      (a, b) => (b.weight ?? 0) - (a.weight ?? 0),
    );
    for (const d of descriptors) {
      const label = d.label || "";
      if (label) {
        styleFragments.push(
          fragment(
            `desc-${label}`,
            "descriptor",
            label,
            50 + (d.weight ?? 1) * 10,
          ),
        );
      }
    }

    // Mood
    if (resolved.mood) {
      styleFragments.push(fragment("mood", "mood", resolved.mood, 60));
    }

    // Vocal type
    const vocalType = resolved.vocals?.type;
    if (vocalType) {
      styleFragments.push(fragment("vocal-type", "vocal_type", vocalType, 75));
    }

    // Structure
    const sections = resolved.arrangement?.sections ?? [];
    if (sections.length > 0) {
      const sectionOrder = sections
        .map((s) => s.name)
        .filter(Boolean)
        .join(" → ");
      styleFragments.push(fragment("structure", "structure", sectionOrder, 65));
    }

    // Exclusion fragments
    const exclusionFragments: PromptFragment[] = [];
    for (const exc of resolved.exclusions ?? []) {
      exclusionFragments.push(fragment(`excl-${exc}`, "exclusion", exc, 40));
    }

    // Build flat strings from fragments (in priority order)
    const sortedStyle = [...styleFragments].sort(
      (a, b) => b.priority - a.priority,
    );
    const style = sortedStyle.map((f) => f.text).join(". ");

    // Lyrics: empty for instrumental, otherwise from resolved (filled later by lyrics_writing)
    const lyricsFragments: PromptFragment[] = [];

    // Exclusions
    const excludedStyles = exclusionFragments.map((f) => f.text).join(", ");

    return {
      styleFragments,
      lyricsFragments,
      exclusionFragments,
      style,
      lyrics: "",
      excludedStyles,
    };
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
