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
    defaultModelVersion: "V4_5ALL",
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

    const body: Record<string, unknown> = {
      customMode: true,
      instrumental: request.instrumental,
      model: request.model,
      title: request.title,
      style: request.style,
    };

    if (request.prompt) {
      body.prompt = request.prompt;
    }

    if (request.negativeTags) {
      body.negativeTags = request.negativeTags;
    }

    if (callBackUrl) {
      body.callBackUrl = callBackUrl;
    }

    if (request.vocalGender) {
      body.vocalGender = request.vocalGender;
    }
    if (request.styleWeight !== undefined) {
      body.styleWeight = request.styleWeight;
    }
    if (request.weirdnessConstraint !== undefined) {
      body.weirdnessConstraint = request.weirdnessConstraint;
    }
    if (request.audioWeight !== undefined) {
      body.audioWeight = request.audioWeight;
    }
    if (request.personaId) {
      body.personaId = request.personaId;
      body.personaModel = request.personaModel ?? "style_persona";
    }

    this.log.info(
      { title: request.title, model: request.model },
      "submitting generation to Suno API v1",
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
      throw new Error(
        `Suno API error: ${json.msg ?? "unknown"} (code ${json.code})`,
      );
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
        errorCode?: string | null;
        errorMessage?: string | null;
        response?: {
          sunoData?: Array<Record<string, unknown>>;
        };
      };
    };

    if (json.code !== 200 || !json.data) {
      throw new Error(
        `Suno API error fetching status: ${json.msg ?? "unknown"}`,
      );
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
      const text = await res.text().catch(() => "unknown");
      throw new Error(`Suno API error ${res.status}: ${text}`);
    }

    return res;
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

export function normalizeTaskResponse(
  taskId: string,
  data: {
    taskId: string;
    status: string;
    errorCode?: string | null;
    errorMessage?: string | null;
    response?: {
      sunoData?: Array<Record<string, unknown>>;
    };
  },
): SunoFeedItem {
  const status = TASK_STATUS_MAP[data.status] ?? "processing";
  const firstSong = data.response?.sunoData?.[0];

  if (!firstSong) {
    return {
      id: taskId,
      taskId,
      status,
      error: data.errorMessage ?? data.errorCode ?? undefined,
    };
  }

  return {
    id: String(firstSong.id ?? taskId),
    taskId,
    status,
    title: firstSong.title as string | undefined,
    audioUrl: firstSong.audioUrl as string | undefined,
    imageUrl: firstSong.imageUrl as string | undefined,
    videoUrl: firstSong.videoUrl as string | undefined,
    duration: firstSong.duration as number | undefined,
    error: data.errorMessage ?? data.errorCode ?? undefined,
    style: firstSong.tags as string | undefined,
    lyrics: firstSong.prompt as string | undefined,
    tags: firstSong.tags as string | undefined,
    modelVersion: firstSong.modelName as string | undefined,
    createdAt: firstSong.createTime as string | undefined,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
