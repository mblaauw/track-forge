import type { Config } from "@track-forge/contracts";
import type {
  LlmRequest,
  LlmResponse,
  LlmProvider,
  ProviderConfig,
} from "./types.js";
import { PROVIDER_DEFAULTS } from "./types.js";

// ── Factory ──────────────────────────────────────────────────────────

export interface LlmLogger {
  debug(obj: Record<string, unknown>, msg?: string): void;
  info(obj: Record<string, unknown>, msg?: string): void;
  warn(obj: Record<string, unknown>, msg?: string): void;
  error(obj: Record<string, unknown>, msg?: string): void;
}

export function createLlmClient(
  config: Pick<Config, "llmProvider" | "llmApiKey" | "llmBaseUrl" | "llmModel">,
  logger?: LlmLogger,
): LlmClient {
  const model = config.llmModel;
  const baseUrl =
    config.llmBaseUrl ??
    PROVIDER_DEFAULTS[config.llmProvider]?.baseUrl ??
    "http://localhost:11434";
  const providerConfig: ProviderConfig = {
    provider: config.llmProvider,
    apiKey: config.llmApiKey,
    baseUrl,
    model,
  };
  return new LlmClient(providerConfig, logger);
}

// ── Client ───────────────────────────────────────────────────────────

export class LlmClient {
  private cfg: ProviderConfig;
  private logger?: LlmLogger;

  constructor(cfg: ProviderConfig, logger?: LlmLogger) {
    this.cfg = cfg;
    this.logger = logger;
  }

  async complete(req: LlmRequest): Promise<LlmResponse> {
    this.logger?.debug(
      {
        prompt: req.messages[0]?.content?.slice(0, 500),
        messages: req.messages.length,
        temperature: req.temperature ?? 0.7,
        maxTokens: req.maxTokens ?? 2048,
        model: this.cfg.model,
      },
      "LLM request",
    );

    const response = await this._complete(req);

    this.logger?.debug(
      {
        content: response.content.slice(0, 500),
        reasoningContent: response.reasoningContent?.slice(0, 2000),
        usage: response.usage,
        model: response.model,
      },
      "LLM response",
    );

    return response;
  }

  private async _complete(req: LlmRequest): Promise<LlmResponse> {
    return this.request(req);
  }

  /**
   * Single parameterised fetch+parse loop for all providers.
   * Each provider variant supplies its own url, headers, body builder and
   * response parser — the timeout/signal/error plumbing is shared.
   */
  private async request(req: LlmRequest): Promise<LlmResponse> {
    const { baseUrl, apiKey, model } = this.cfg;

    // ── Build provider-specific request ───────────────────────────
    const systemMsg = req.messages.filter((m) => m.role === "system");
    const nonSystem = req.messages.filter((m) => m.role !== "system");

    const provider = this.cfg.provider;
    const isAnthropic = provider === "anthropic";
    const isOpenAI = provider === "openai" || provider === "openai-compatible";
    const isOllama = provider === "ollama";

    const url = isOllama
      ? `${baseUrl}/api/chat`
      : isAnthropic
        ? `${baseUrl}/messages`
        : `${baseUrl}/chat/completions`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (isOpenAI) {
      headers.Authorization = `Bearer ${apiKey}`;
    } else if (isAnthropic) {
      headers["x-api-key"] = apiKey ?? "";
      headers["anthropic-version"] = "2023-06-01";
    }

    const bodyObj: Record<string, unknown> = {
      model,
      messages: req.messages,
      temperature: req.temperature ?? 0.7,
      max_tokens: req.maxTokens ?? 2048,
    };
    if (isAnthropic) {
      bodyObj.system = systemMsg.map((m) => m.content).join("\n");
      bodyObj.messages = nonSystem.map((m) => ({
        role: m.role,
        content: m.content,
      }));
    }
    if (isOllama) bodyObj.stream = false;

    // ── Fire with timeout + combined abort ─────────────────────────
    const timeoutController = new AbortController();
    const timeout = setTimeout(
      () => timeoutController.abort(new Error("Request timed out")),
      180_000,
    );
    const combined = combineSignals(req.signal, timeoutController.signal);

    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(bodyObj),
        signal: combined.signal,
      });
    } finally {
      clearTimeout(timeout);
      combined.cleanup();
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const label = isOpenAI ? "OpenAI" : isAnthropic ? "Anthropic" : "Ollama";
      throw new LlmError(`${label} API error ${res.status}`, res.status, body);
    }

    const json = (await res.json()) as Record<string, unknown>;

    // ── Parse provider-specific response shape ─────────────────────
    if (isOpenAI) {
      const choices = json.choices as
        | Array<{
            message: { content: string; reasoning_content?: string };
          }>
        | undefined;
      const msg = choices?.[0]?.message;
      return {
        content: msg?.content ?? "",
        model: (json.model as string) ?? model,
        reasoningContent: msg?.reasoning_content,
        usage: json.usage
          ? {
              promptTokens: (json.usage as any).prompt_tokens,
              completionTokens: (json.usage as any).completion_tokens,
              totalTokens: (json.usage as any).total_tokens,
            }
          : undefined,
      };
    }

    if (isAnthropic) {
      const contentArr = json.content as Array<{ text: string }> | undefined;
      return {
        content: contentArr?.map((c) => c.text).join("") ?? "",
        model: (json.model as string) ?? model,
        usage: json.usage
          ? {
              promptTokens: (json.usage as any).input_tokens,
              completionTokens: (json.usage as any).output_tokens,
              totalTokens:
                (json.usage as any).input_tokens +
                (json.usage as any).output_tokens,
            }
          : undefined,
      };
    }

    // Ollama
    const msg = json.message as { content: string } | undefined;
    return {
      content: msg?.content ?? "",
      model: (json.model as string) ?? model,
    };
  }
}
function combineSignals(
  s1: AbortSignal | undefined,
  s2: AbortSignal,
): { signal: AbortSignal; cleanup: () => void } {
  if (!s1) return { signal: s2, cleanup: () => {} };
  const c = new AbortController();
  if (s1.aborted) {
    c.abort(s1.reason);
    return { signal: c.signal, cleanup: () => {} };
  }
  const onAbort = () => {
    const reason = s1.aborted ? s1.reason : s2.reason;
    c.abort(reason);
  };
  s1.addEventListener("abort", onAbort, { once: true });
  s2.addEventListener("abort", onAbort, { once: true });
  return {
    signal: c.signal,
    cleanup: () => {
      s1.removeEventListener("abort", onAbort);
      s2.removeEventListener("abort", onAbort);
    },
  };
}

// ── Error ────────────────────────────────────────────────────────────

export class LlmError extends Error {
  status: number;
  body: string;

  constructor(message: string, status: number, body: string) {
    super(message);
    this.name = "LlmError";
    this.status = status;
    this.body = body;
  }
}
