import type { SunoModelVersion } from "./types.js";

// ── Types ─────────────────────────────────────────────────────────

export interface SunoCapabilities {
  /** Maximum lyrics length (characters) */
  maxLyricsLength: number;
  /** Maximum style prompt length (characters) */
  maxStyleLength: number;
  /** Maximum total tags length (characters) */
  maxTagsLength: number;
  /** Whether negative tags are supported */
  supportsNegativeTags: boolean;
  /** Whether callback URLs are supported */
  supportsCallbacks: boolean;
  /** Maximum generations per request */
  maxBatchSize: number;
}

// ── Registry ──────────────────────────────────────────────────────

const CAPABILITIES: Record<SunoModelVersion, SunoCapabilities> = {
  "chirp-v3-5": {
    maxLyricsLength: 3000,
    maxStyleLength: 2000,
    maxTagsLength: 500,
    supportsNegativeTags: true,
    supportsCallbacks: true,
    maxBatchSize: 2,
  },
  "chirp-v3": {
    maxLyricsLength: 3000,
    maxStyleLength: 2000,
    maxTagsLength: 500,
    supportsNegativeTags: true,
    supportsCallbacks: true,
    maxBatchSize: 2,
  },
  "chirp-v2": {
    maxLyricsLength: 3000,
    maxStyleLength: 2000,
    maxTagsLength: 500,
    supportsNegativeTags: false,
    supportsCallbacks: false,
    maxBatchSize: 1,
  },
};

const DEFAULT_CAPABILITIES: SunoCapabilities = {
  maxLyricsLength: 3000,
  maxStyleLength: 2000,
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

export function registerCapabilities(
  model: SunoModelVersion,
  caps: SunoCapabilities,
): void {
  CAPABILITIES[model] = caps;
}
