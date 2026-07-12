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
    defaultModelVersion: "chirp-v3-5",
    pollIntervalMs: DEFAULT_POLL_INTERVAL,
    pollTimeoutMs: DEFAULT_POLL_TIMEOUT,
  };
}

// ── Client ─────────────────────────────────────────────────────────

export class SunoClient {
  private cfg: SunoClientConfig;
  private appConfig: Pick<Config, "publicBaseUrl">;
  private log: Logger;

  constructor(cfg: SunoClientConfig, appConfig: Pick<Config, "publicBaseUrl">, logger: Logger) {
    this.cfg = cfg;
    this.appConfig = appConfig;
    this.log = logger.child({ module: "suno-client" });
  }

  // ── Submit generation ──────────────────────────────────────────

  async submit(request: SunoGenerateRequest): Promise<SunoSubmitResult> {
    const callbackUrl = request.callbackUrl ?? resolveCallbackUrl(this.appConfig);

    const body: Record<string, unknown> = {
      title: request.title,
      prompt: request.style,
      tags: request.tags,
      make_instrumental: request.instrumental,
      mv: request.modelVersion ?? this.cfg.defaultModelVersion,
    };

    if (request.lyrics && !request.instrumental) {
      body.lyrics = request.lyrics;
    }

    if (request.negativeTags) {
      body.negative_tags = request.negativeTags;
    }

    if (callbackUrl) {
      body.callback_url = callbackUrl;
    }

    if (request.webhookToken) {
      body.webhook_token = request.webhookToken;
    }

    this.log.info({ title: request.title }, "submitting generation to Suno");

    const res = await this.fetch("/api/generate", {
      method: "POST",
      body: JSON.stringify(body),
    });

    const data = (await res.json()) as Record<string, unknown> | Array<Record<string, unknown>>;
    const ids: string[] = Array.isArray(data)
      ? data.map((item) => String(item.id ?? "")).filter(Boolean)
      : ((data as Record<string, unknown>).ids as string[]) ??
        ((data as Record<string, unknown>).id
          ? [String((data as Record<string, unknown>).id)]
          : []);

    return {
      ids,
      callbackConfigured: !!callbackUrl,
    };
  }

  // ── Fetch generation status ────────────────────────────────────

  async getGenerationStatus(id: string): Promise<SunoFeedItem> {
    const res = await this.fetch(`/api/feed/${encodeURIComponent(id)}`);
    const data = await res.json();
    return normalizeFeedItem(data);
  }

  // ── Poll until completion ──────────────────────────────────────

  async waitForCompletion(
    id: string,
    timeoutMs?: number,
  ): Promise<SunoFeedItem> {
    const deadline = Date.now() + (timeoutMs ?? this.cfg.pollTimeoutMs);

    while (Date.now() < deadline) {
      const item = await this.getGenerationStatus(id);

      if (item.status === "completed" || item.status === "error") {
        return item;
      }

      await sleep(this.cfg.pollIntervalMs);
    }

    throw new Error(`Suno generation ${id} timed out after ${timeoutMs ?? this.cfg.pollTimeoutMs}ms`);
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

function normalizeFeedItem(data: unknown): SunoFeedItem {
  const d = data as Record<string, unknown>;
  return {
    id: String(d.id ?? ""),
    status: (d.status as SunoGenerationStatus) ?? "processing",
    title: d.title as string | undefined,
    audioUrl: d.audio_url as string | undefined,
    imageUrl: d.image_url as string | undefined,
    videoUrl: d.video_url as string | undefined,
    duration: d.duration as number | undefined,
    error: d.error as string | undefined,
    style: d.style as string | undefined,
    lyrics: d.lyrics as string | undefined,
    tags: d.tags as string | undefined,
    modelVersion: d.model_version as string | undefined,
    createdAt: d.created_at as string | undefined,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
