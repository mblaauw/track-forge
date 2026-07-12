// ── Suno API types ────────────────────────────────────────────────

export type SunoModelVersion = "chirp-v3-5" | "chirp-v3" | "chirp-v2";

/** Request body for Suno custom-mode generation */
export interface SunoGenerateRequest {
  title: string;
  /** Style description string (custom mode) */
  style: string;
  /** Lyric text with section markers */
  lyrics: string;
  /** Tags appended to style (genre, mood, instruments) */
  tags?: string;
  /** Tags to exclude */
  negativeTags?: string;
  /** Make instrumental (no lyrics) */
  instrumental: boolean;
  /** Model version */
  modelVersion?: SunoModelVersion;
  /** Optional callback URL */
  callbackUrl?: string;
  /** Optional webhook token for verification */
  webhookToken?: string;
}

/** Suno generation status */
export type SunoGenerationStatus =
  | "queued"
  | "processing"
  | "completed"
  | "error";

/** Response from Suno API feed endpoint */
export interface SunoFeedItem {
  id: string;
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
  /** Generation IDs for tracking */
  ids: string[];
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
