import type { Config } from "@track-forge/contracts";
import type { LlmRequest, LlmResponse, LlmProvider, ProviderConfig } from "./types.js";
import { PROVIDER_DEFAULTS } from "./types.js";

// ── Factory ──────────────────────────────────────────────────────────

export function createLlmClient(config: Pick<Config, "llmProvider" | "llmApiKey" | "llmBaseUrl" | "llmModel">): LlmClient {
  const model = config.llmModel ?? "gpt-4o";
  const baseUrl = config.llmBaseUrl ?? PROVIDER_DEFAULTS[config.llmProvider]?.baseUrl ?? "http://localhost:11434";
  const providerConfig: ProviderConfig = {
    provider: config.llmProvider,
    apiKey: config.llmApiKey,
    baseUrl,
    model,
  };
  return new LlmClient(providerConfig);
}

// ── Client ───────────────────────────────────────────────────────────

export class LlmClient {
  private cfg: ProviderConfig;

  constructor(cfg: ProviderConfig) {
    this.cfg = cfg;
  }

  async complete(req: LlmRequest): Promise<LlmResponse> {
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
    const timeout = setTimeout(() => timeoutController.abort(new Error("Request timed out")), 180_000);
    const combinedSignal = combineSignals(req.signal, timeoutController.signal);

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
          max_tokens: req.maxTokens ?? 8192,
        }),
        signal: combinedSignal,
      });

      clearTimeout(timeout);
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new LlmError(`OpenAI API error ${res.status}`, res.status, body);
      }

      const json = (await res.json()) as {
        choices: { message: { content: string } }[];
        model: string;
        usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
      };

      return {
        content: json.choices[0]?.message?.content ?? "",
        model: json.model,
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
        max_tokens: req.maxTokens ?? 4096,
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
        max_tokens: req.maxTokens ?? 4096,
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
function combineSignals(s1: AbortSignal | undefined, s2: AbortSignal): AbortSignal {
  if (!s1) return s2;
  const c = new AbortController();
  const onAbort = () => {
    const reason = s1.aborted ? s1.reason : s2.reason;
    c.abort(reason);
  };
  s1.addEventListener("abort", onAbort, { once: true });
  s2.addEventListener("abort", onAbort, { once: true });
  return c.signal;
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
