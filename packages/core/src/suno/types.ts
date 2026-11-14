// ── Suno API types ────────────────────────────────────────────────

import type { SunoModel } from "@track-forge/contracts";

/**
 * Model identifiers accepted by the provider. The v6 family is the only
 * live generation target — the canonical list is `SUNO_MODELS` in
 * `@track-forge/contracts`.
 */
export type SunoModelVersion = SunoModel;

/**
 * Request body for POST /api/v1/generate in custom mode.
 * Contract: https://docs.sunoapi.org/suno-api/generate-music
 */
export interface SunoGenerateRequest {
  /** Must be true for custom mode */
  customMode: true;
  /** Whether to generate instrumental (no vocals) */
  instrumental: boolean;
  /** Model version */
  model: SunoModelVersion;
  /**
   * Lyrics with section metatags. v6 reads the dedicated `lyrics` field
   * and prefers it over the legacy `prompt` field, which this app no
   * longer sends.
   */
  lyrics?: string;
  /** Style description (max 1000 chars) */
  style: string;
  /** Track title (max 80 chars) */
  title: string;
  /** Styles/traits to exclude (max 1000 chars) */
  negativeTags?: string;
  /** Target length in seconds (10–360). The provider default is 20. */
  duration?: number;
  /** 0–4. 0 keeps the style prompt exactly as written. */
  variety?: number;
  /** Optional callback URL */
  callBackUrl?: string;
  /** Persona ID (from Generate Persona or Suno Voice) */
  personaId?: string;
  /** Persona model type */
  personaModel?: "style_persona" | "voice_persona";
  /** Preferred vocal gender — raises the probability, not a guarantee */
  vocalGender?: "m" | "f";
  /** Style guidance weight (0.00–1.00) */
  styleWeight?: number;
  /** Creative deviation (0.00–1.00) */
  weirdnessConstraint?: number;
  /** Input audio influence weight (0.00–1.00). Vocal takes only. */
  audioWeight?: number;
}

/** Suno generation status */
export type SunoGenerationStatus =
  "queued" | "processing" | "completed" | "error";

/** An individual track within a Suno generation task */
export interface SunoTrack {
  id: string;
  index: number;
  audioUrl?: string;
  imageUrl?: string;
  videoUrl?: string;
  duration?: number;
  title?: string;
}

/** Response from Suno API record-info endpoint */
export interface SunoFeedItem {
  /** Generation ID */
  id: string;
  /** Task ID this generation belongs to */
  taskId?: string;
  status: SunoGenerationStatus;
  title?: string;
  /** URL to generated audio (first track) */
  audioUrl?: string;
  /** URL to cover image (first track) */
  imageUrl?: string;
  /** URL to video (first track) */
  videoUrl?: string;
  /** Duration in seconds (first track) */
  duration?: number;
  /** Error message if failed */
  error?: string;
  /** Full style prompt used */
  style?: string;
  /** Lyrics used */
  lyrics?: string;
  /** Tags used */
  tags?: string;
  /** Model version used */
  modelVersion?: string;
  /** Timestamp */
  createdAt?: string;
  /** All tracks returned by Suno (typically 2 per task) */
  tracks?: SunoTrack[];
}

/** Client response wrapping Suno results */
export interface SunoSubmitResult {
  /** Task ID for tracking generation */
  taskId: string;
  /** Whether callback will be used */
  callbackConfigured: boolean;
}

/** Configuration for Suno client behaviour */
export interface SunoClientConfig {
  baseUrl: string;
  authToken?: string;
  defaultModelVersion: SunoModelVersion;
  /** Poll interval in ms (default 5000) */
  pollIntervalMs: number;
  /** Max poll time in ms (default 300000 = 5 min) */
  pollTimeoutMs: number;
}

// ── Fragment model for prompt construction ────────────────────────────

/**
 * A single atomic prompt fragment — the indivisible unit of prompt content.
 * Fragment-aware truncation drops low-priority fragments entirely instead
 * of character-slicing through the middle of meaningful content.
 */
export interface PromptFragment {
  id: string;
  source:
    | "descriptor"
    | "characteristic"
    | "mood"
    | "structure"
    | "vocal_type"
    | "bpm"
    | "key"
    | "genre"
    | "preset"
    | "exclusion";
  text: string;
  /** Lower priority → dropped first under truncation. 0 = drops first, 100 = never drops. */
  priority: number;
  /** Byte length of `text` — pre-computed for fast truncation decisions. */
  byteLength: number;
}

/**
 * Structured compilation result containing fragments for each Suno prompt
 * component. Enables fragment-aware truncation before payload building.
 */
export interface CompiledArtifacts {
  styleFragments: PromptFragment[];
  lyricsFragments: PromptFragment[];
  exclusionFragments: PromptFragment[];
  /** The flat concatenated style string (for backwards compat / preview) */
  style: string;
  /** The flat concatenated lyrics string */
  lyrics: string;
  /** The flat concatenated excluded styles string */
  excludedStyles: string;
}
