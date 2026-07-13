import type { SunoModelVersion } from "./types.js";

// ── Types ─────────────────────────────────────────────────────────

export interface SunoCapabilities {
  /** Maximum lyrics length (characters) */
  maxLyricsLength: number;
  /** Maximum style prompt length (characters) */
  maxStyleLength: number;
  /** Maximum title length (characters) */
  maxTitleLength: number;
  /** Maximum total tags length (characters) */
  maxTagsLength: number;
  /** Whether negative tags are supported */
  supportsNegativeTags: boolean;
  /** Whether callback URLs are supported */
  supportsCallbacks: boolean;
  /** Maximum generations per request */
  maxBatchSize: number;
}

// ── Registry (limits per sunoapi.org docs) ────────────────────────

const CAPABILITIES: Record<SunoModelVersion, SunoCapabilities> = {
  "V4": {
    maxLyricsLength: 3000,
    maxStyleLength: 200,
    maxTitleLength: 80,
    maxTagsLength: 500,
    supportsNegativeTags: true,
    supportsCallbacks: true,
    maxBatchSize: 2,
  },
  "V4_5": {
    maxLyricsLength: 5000,
    maxStyleLength: 1000,
    maxTitleLength: 100,
    maxTagsLength: 500,
    supportsNegativeTags: true,
    supportsCallbacks: true,
    maxBatchSize: 2,
  },
  "V4_5PLUS": {
    maxLyricsLength: 5000,
    maxStyleLength: 1000,
    maxTitleLength: 100,
    maxTagsLength: 500,
    supportsNegativeTags: true,
    supportsCallbacks: true,
    maxBatchSize: 2,
  },
  "V4_5ALL": {
    maxLyricsLength: 5000,
    maxStyleLength: 1000,
    maxTitleLength: 80,
    maxTagsLength: 500,
    supportsNegativeTags: true,
    supportsCallbacks: true,
    maxBatchSize: 2,
  },
  "V5": {
    maxLyricsLength: 5000,
    maxStyleLength: 1000,
    maxTitleLength: 100,
    maxTagsLength: 500,
    supportsNegativeTags: true,
    supportsCallbacks: true,
    maxBatchSize: 2,
  },
  "V5_5": {
    maxLyricsLength: 5000,
    maxStyleLength: 1000,
    maxTitleLength: 100,
    maxTagsLength: 500,
    supportsNegativeTags: true,
    supportsCallbacks: true,
    maxBatchSize: 2,
  },
};

const DEFAULT_CAPABILITIES: SunoCapabilities = {
  maxLyricsLength: 5000,
  maxStyleLength: 1000,
  maxTitleLength: 100,
  maxTagsLength: 500,
  supportsNegativeTags: true,
  supportsCallbacks: true,
  maxBatchSize: 2,
};

// ── Accessors ─────────────────────────────────────────────────────

export function getCapabilities(
  modelVersion?: SunoModelVersion,
): SunoCapabilities {
  if (modelVersion && modelVersion in CAPABILITIES) {
    return CAPABILITIES[modelVersion];
  }
  return DEFAULT_CAPABILITIES;
}


