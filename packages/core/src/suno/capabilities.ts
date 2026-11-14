import { SUNO_LIMITS } from "@track-forge/contracts";
import type { SunoModelVersion } from "./types.js";

// ── Types ─────────────────────────────────────────────────────────

export interface SunoCapabilities {
  /** Maximum lyrics length (characters) */
  maxLyricsLength: number;
  /** Maximum style prompt length (characters) */
  maxStyleLength: number;
  /** Maximum title length (characters) */
  maxTitleLength: number;
  /** Maximum negative-tags length (characters) */
  maxNegativeTagsLength: number;
  /** Shortest requestable duration (seconds) */
  minDurationSec: number;
  /** Longest requestable duration (seconds) */
  maxDurationSec: number;
  /** Whether negative tags are supported */
  supportsNegativeTags: boolean;
  /** Whether callback URLs are supported */
  supportsCallbacks: boolean;
  /** Tracks returned per request */
  maxBatchSize: number;
}

// ── Registry ──────────────────────────────────────────────────────
//
// V6, V6_WILD and V6_MINI share one set of limits. Pre-v6 models were
// retired by Suno and are deliberately absent — there is nothing to
// fall back to.

const V6_CAPABILITIES: SunoCapabilities = {
  maxLyricsLength: SUNO_LIMITS.lyrics,
  maxStyleLength: SUNO_LIMITS.style,
  maxTitleLength: SUNO_LIMITS.title,
  maxNegativeTagsLength: SUNO_LIMITS.negativeTags,
  minDurationSec: SUNO_LIMITS.minDurationSec,
  maxDurationSec: SUNO_LIMITS.maxDurationSec,
  supportsNegativeTags: true,
  supportsCallbacks: true,
  maxBatchSize: 2,
};

// ── Accessors ─────────────────────────────────────────────────────

export function getCapabilities(
  _modelVersion?: SunoModelVersion,
): SunoCapabilities {
  return V6_CAPABILITIES;
}
