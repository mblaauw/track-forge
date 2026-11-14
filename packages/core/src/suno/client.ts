import type { Logger } from "pino";
import type { Config } from "@track-forge/contracts";
import type {
  SunoClientConfig,
  SunoGenerateRequest,
  SunoFeedItem,
  SunoSubmitResult,
  SunoGenerationStatus,
} from "./types.js";
import { resolveCallbackUrl } from "./callbacks.js";

// ── Defaults ──────────────────────────────────────────────────────

const DEFAULT_POLL_INTERVAL = 5_000;
const DEFAULT_POLL_TIMEOUT = 300_000;

// ── Client factory ─────────────────────────────────────────────────

export function createSunoClientConfig(config: Config): SunoClientConfig {
  return {
    baseUrl: config.sunoBaseUrl.replace(/\/+$/, ""),
    authToken: config.sunoAuthToken,
    defaultModelVersion: config.sunoModel,
    pollIntervalMs: DEFAULT_POLL_INTERVAL,
    pollTimeoutMs: DEFAULT_POLL_TIMEOUT,
  };
}

// ── Client ─────────────────────────────────────────────────────────

export class SunoClient {
  private cfg: SunoClientConfig;
  private appConfig: Pick<Config, "publicBaseUrl">;
  private log: Logger;

  constructor(
    cfg: SunoClientConfig,
    appConfig: Pick<Config, "publicBaseUrl">,
    logger: Logger,
  ) {
    this.cfg = cfg;
    this.appConfig = appConfig;
    this.log = logger.child({ module: "suno-client" });
  }

  // ── Submit generation (v1 API) ─────────────────────────────────

  async submit(request: SunoGenerateRequest): Promise<SunoSubmitResult> {
    const callBackUrl =
      request.callBackUrl ?? resolveCallbackUrl(this.appConfig);

    // v6 custom-mode body. Lyrics travel in the dedicated `lyrics` field;
    // the legacy `prompt` field is never sent.
    const body: Record<string, unknown> = {
      customMode: true,
      instrumental: request.instrumental,
      model: request.model ?? this.cfg.defaultModelVersion,
      title: request.title,
      style: request.style,
    };

    if (!request.instrumental && request.lyrics) {
      body.lyrics = request.lyrics;
    }
    if (request.negativeTags) {
      body.negativeTags = request.negativeTags;
    }
    if (callBackUrl) {
      body.callBackUrl = callBackUrl;
    }
    if (request.duration !== undefined) {
      body.duration = request.duration;
    }
    if (request.variety !== undefined) {
      body.variety = request.variety;
    }
    if (!request.instrumental && request.vocalGender) {
      body.vocalGender = request.vocalGender;
    }
    if (request.styleWeight !== undefined) {
      body.styleWeight = request.styleWeight;
    }
    if (request.weirdnessConstraint !== undefined) {
      body.weirdnessConstraint = request.weirdnessConstraint;
    }
    // The provider rejects audioWeight on takes without vocals.
    if (!request.instrumental && request.audioWeight !== undefined) {
      body.audioWeight = request.audioWeight;
    }
    if (request.personaId) {
      body.personaId = request.personaId;
      body.personaModel = request.personaModel ?? "style_persona";
    }

    this.log.info(
      {
        title: request.title,
        model: body.model,
        duration: body.duration,
        variety: body.variety,
      },
      "submitting generation to Suno",
    );

    const res = await this.fetch("/api/v1/generate", {
      method: "POST",
      body: JSON.stringify(body),
    });

    const json = (await res.json()) as {
      code: number;
      msg: string;
      data?: { taskId: string };
    };

    if (json.code !== 200 || !json.data?.taskId) {
      throw new SunoApiError(json.code, json.msg);
    }

    return {
      taskId: json.data.taskId,
      callbackConfigured: !!callBackUrl,
    };
  }

  // ── Fetch task status (v1 API record-info) ─────────────────────

  async getGenerationStatus(taskId: string): Promise<SunoFeedItem> {
    const res = await this.fetch(
      `/api/v1/generate/record-info?taskId=${encodeURIComponent(taskId)}`,
    );
    const json = (await res.json()) as {
      code: number;
      msg: string;
      data?: {
        taskId: string;
        status: string;
        errorCode?: string | number | null;
        errorMessage?: string | null;
        response?: {
          sunoData?: Array<Record<string, unknown>>;
        };
      };
    };

    if (json.code !== 200 || !json.data) {
      throw new SunoApiError(json.code, json.msg);
    }

    return normalizeTaskResponse(taskId, json.data);
  }

  // ── Poll until completion (exponential backoff) ───────────────

  async waitForCompletion(
    taskId: string,
    timeoutMs?: number,
  ): Promise<SunoFeedItem> {
    const deadline = Date.now() + (timeoutMs ?? this.cfg.pollTimeoutMs);
    const maxBackoff = 20_000;
    let delay = this.cfg.pollIntervalMs;

    while (Date.now() < deadline) {
      const item = await this.getGenerationStatus(taskId);

      if (item.status === "completed" || item.status === "error") {
        return item;
      }

      await sleep(delay);
      delay = Math.min(delay * 2, maxBackoff);
    }

    throw new Error(
      `Suno task ${taskId} timed out after ${timeoutMs ?? this.cfg.pollTimeoutMs}ms`,
    );
  }

  // ── Internal fetch helper ──────────────────────────────────────

  private async fetch(
    path: string,
    options: RequestInit = {},
  ): Promise<Response> {
    const url = `${this.cfg.baseUrl}${path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string> | undefined),
    };

    if (this.cfg.authToken) {
      headers["Authorization"] = `Bearer ${this.cfg.authToken}`;
    }

    const res = await fetch(url, { ...options, headers });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new SunoApiError(res.status, text);
    }

    return res;
  }
}

// ── Errors ────────────────────────────────────────────────────────

/** What each provider status code means for the person waiting on a take. */
const PROVIDER_ERROR_REASONS: Record<number, string> = {
  400: "Suno rejected the request parameters",
  401: "The Suno API key is missing or invalid",
  405: "Suno rate limit reached; try again shortly",
  413: "The style or lyrics are too long for Suno",
  429: "The Suno account is out of credits",
  430: "Too many Suno requests at once; try again shortly",
  455: "Suno is down for maintenance",
  500: "Suno had a server error",
};

/** Task-level failure statuses reported by record-info. */
const TASK_ERROR_REASONS: Record<string, string> = {
  CREATE_TASK_FAILED: "Suno could not start the generation",
  GENERATE_AUDIO_FAILED: "Suno failed while generating the audio",
  CALLBACK_EXCEPTION: "Suno could not deliver the result",
  SENSITIVE_WORD_ERROR: "Suno blocked the lyrics or style for prohibited words",
};

/** A provider failure carrying a plain reason that is safe to show in the UI. */
export class SunoApiError extends Error {
  readonly code: number;
  readonly reason: string;

  constructor(code: number, detail?: string) {
    const reason = PROVIDER_ERROR_REASONS[code] ?? "Suno returned an error";
    const tail = detail ? `: ${detail.slice(0, 300)}` : "";
    super(`${reason} (code ${code})${tail}`);
    this.name = "SunoApiError";
    this.code = code;
    this.reason = reason;
  }
}

// ── Helpers ───────────────────────────────────────────────────────

const TASK_STATUS_MAP: Record<string, SunoGenerationStatus> = {
  PENDING: "queued",
  TEXT_SUCCESS: "processing",
  FIRST_SUCCESS: "processing",
  SUCCESS: "completed",
  CREATE_TASK_FAILED: "error",
  GENERATE_AUDIO_FAILED: "error",
  CALLBACK_EXCEPTION: "error",
  SENSITIVE_WORD_ERROR: "error",
};

/**
 * Read a track field that the provider spells either way: record-info is
 * documented in snake_case (`audio_url`) but has also returned camelCase
 * (`audioUrl`), so both are accepted.
 */
function pick<T>(
  song: Record<string, unknown>,
  ...keys: string[]
): T | undefined {
  for (const key of keys) {
    const value = song[key];
    if (value !== undefined && value !== null && value !== "") {
      return value as T;
    }
  }
  return undefined;
}

export function normalizeTaskResponse(
  taskId: string,
  data: {
    taskId: string;
    status: string;
    errorCode?: string | number | null;
    errorMessage?: string | null;
    response?: {
      sunoData?: Array<Record<string, unknown>>;
    };
  },
): SunoFeedItem {
  const status = TASK_STATUS_MAP[data.status] ?? "processing";
  const allSongs = data.response?.sunoData ?? [];
  const firstSong = allSongs[0];
  const error =
    status === "error"
      ? (data.errorMessage ??
        TASK_ERROR_REASONS[data.status] ??
        (data.errorCode != null ? String(data.errorCode) : "Suno failed"))
      : (data.errorMessage ?? undefined);

  if (!firstSong) {
    return { id: taskId, taskId, status, error };
  }

  const mapSong = (s: Record<string, unknown>, idx: number) => ({
    id: String(s.id ?? `${taskId}-${idx}`),
    index: idx,
    audioUrl: pick<string>(
      s,
      "audio_url",
      "audioUrl",
      "stream_audio_url",
      "streamAudioUrl",
    ),
    imageUrl: pick<string>(s, "image_url", "imageUrl"),
    videoUrl: pick<string>(s, "video_url", "videoUrl"),
    duration: pick<number>(s, "duration"),
    title: pick<string>(s, "title"),
  });
  const first = mapSong(firstSong, 0);

  return {
    id: first.id === `${taskId}-0` ? taskId : first.id,
    taskId,
    status,
    title: first.title,
    audioUrl: first.audioUrl,
    imageUrl: first.imageUrl,
    videoUrl: first.videoUrl,
    duration: first.duration,
    error,
    style: pick<string>(firstSong, "tags"),
    lyrics: pick<string>(firstSong, "prompt", "lyrics"),
    tags: pick<string>(firstSong, "tags"),
    modelVersion: pick<string>(firstSong, "model_name", "modelName"),
    createdAt: pick<string>(firstSong, "createTime", "create_time"),
    tracks: allSongs.map(mapSong),
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
