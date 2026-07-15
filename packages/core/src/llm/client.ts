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
  const model = config.llmModel ?? "gpt-4o";
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
    switch (this.cfg.provider) {
      case "openai":
      case "openai-compatible":
        return this.openaiComplete(req);
      case "anthropic":
        return this.anthropicComplete(req);
      case "ollama":
        return this.ollamaComplete(req);
    }
  }

  // ── OpenAI ───────────────────────────────────────────────────────

  private async openaiComplete(req: LlmRequest): Promise<LlmResponse> {
    const timeoutController = new AbortController();
    const timeout = setTimeout(
      () => timeoutController.abort(new Error("Request timed out")),
      180_000,
    );
    const combined = combineSignals(req.signal, timeoutController.signal);

    try {
      const res = await fetch(`${this.cfg.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.cfg.apiKey}`,
        },
        body: JSON.stringify({
          model: this.cfg.model,
          messages: req.messages,
          temperature: req.temperature ?? 0.7,
          max_tokens: req.maxTokens ?? 2048,
        }),
        signal: combined.signal,
      });

      clearTimeout(timeout);
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new LlmError(`OpenAI API error ${res.status}`, res.status, body);
      }

      const json = (await res.json()) as {
        choices: { message: { content: string; reasoning_content?: string } }[];
        model: string;
        usage?: {
          prompt_tokens: number;
          completion_tokens: number;
          total_tokens: number;
        };
      };

      return {
        content: json.choices[0]?.message?.content ?? "",
        model: json.model,
        reasoningContent: json.choices[0]?.message?.reasoning_content,
        usage: json.usage
          ? {
              promptTokens: json.usage.prompt_tokens,
              completionTokens: json.usage.completion_tokens,
              totalTokens: json.usage.total_tokens,
            }
          : undefined,
      };
    } finally {
      clearTimeout(timeout);
      combined.cleanup();
    }
  }

  // ── Anthropic ────────────────────────────────────────────────────

  private async anthropicComplete(req: LlmRequest): Promise<LlmResponse> {
    const systemMsg = req.messages.find((m) => m.role === "system");
    const nonSystem = req.messages.filter((m) => m.role !== "system");

    const res = await fetch(`${this.cfg.baseUrl}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.cfg.apiKey ?? "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.cfg.model,
        system: systemMsg?.content,
        messages: nonSystem.map((m) => ({ role: m.role, content: m.content })),
        temperature: req.temperature ?? 0.7,
        max_tokens: req.maxTokens ?? 2048,
      }),
      signal: req.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new LlmError(`Anthropic API error ${res.status}`, res.status, body);
    }

    const json = (await res.json()) as {
      content: { text: string }[];
      model: string;
      usage?: { input_tokens: number; output_tokens: number };
    };

    return {
      content: json.content?.map((c) => c.text).join("") ?? "",
      model: json.model,
      usage: json.usage
        ? {
            promptTokens: json.usage.input_tokens,
            completionTokens: json.usage.output_tokens,
            totalTokens: json.usage.input_tokens + json.usage.output_tokens,
          }
        : undefined,
    };
  }

  // ── Ollama ───────────────────────────────────────────────────────

  private async ollamaComplete(req: LlmRequest): Promise<LlmResponse> {
    const res = await fetch(`${this.cfg.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.cfg.model,
        messages: req.messages,
        temperature: req.temperature ?? 0.7,
        max_tokens: req.maxTokens ?? 2048,
        stream: false,
      }),
      signal: req.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new LlmError(`Ollama API error ${res.status}`, res.status, body);
    }

    const json = (await res.json()) as {
      message: { content: string };
      model: string;
    };

    return {
      content: json.message?.content ?? "",
      model: json.model,
    };
  }
}

// ── Helpers ──────────────────────────────────────────────────────────

/** Combine two AbortSignals into one — fires when either aborts */
function combineSignals(
  s1: AbortSignal | undefined,
  s2: AbortSignal,
): { signal: AbortSignal; cleanup: () => void } {
  if (!s1) return { signal: s2, cleanup: () => {} };
  const c = new AbortController();
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
