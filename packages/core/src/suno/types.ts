// ── Suno API types ────────────────────────────────────────────────

/** Model versions supported by sunoapi.org (V4 to V5_5) */
export type SunoModelVersion = "V4" | "V4_5" | "V4_5PLUS" | "V4_5ALL" | "V5" | "V5_5";

/** Request body for Suno API /api/v1/generate (custom mode) */
export interface SunoGenerateRequest {
  /** Must be true for custom mode */
  customMode: true;
  /** Whether to generate instrumental (no lyrics) */
  instrumental: boolean;
  /** Model version */
  model: SunoModelVersion;
  /** Lyrics text (required when instrumental=false) */
  prompt?: string;
  /** Style/genre description */
  style: string;
  /** Track title */
  title: string;
  /** Styles/traits to exclude */
  negativeTags?: string;
  /** Optional callback URL */
  callBackUrl?: string;
  /** Persona ID (from Generate Persona or Suno Voice) */
  personaId?: string;
  /** Persona model type */
  personaModel?: "style_persona" | "voice_persona";
  /** Preferred vocal gender */
  vocalGender?: "m" | "f";
  /** Style guidance weight (0.00–1.00) */
  styleWeight?: number;
  /** Creative deviation constraint (0.00–1.00) */
  weirdnessConstraint?: number;
  /** Input audio influence weight (0.00–1.00) */
  audioWeight?: number;
}

/** Suno generation status */
export type SunoGenerationStatus =
  | "queued"
  | "processing"
  | "completed"
  | "error";

/** Response from Suno API record-info endpoint */
export interface SunoFeedItem {
  /** Generation ID */
  id: string;
  /** Task ID this generation belongs to */
  taskId?: string;
  status: SunoGenerationStatus;
  title?: string;
  /** URL to generated audio */
  audioUrl?: string;
  /** URL to cover image */
  imageUrl?: string;
  /** URL to video */
  videoUrl?: string;
  /** Duration in seconds */
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
