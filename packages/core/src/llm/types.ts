import type { Config } from "@track-forge/contracts";

// ── Request / Response ───────────────────────────────────────────────

export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmRequest {
  messages: LlmMessage[];
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface LlmResponse {
  content: string;
  model: string;
  reasoningContent?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// ── Provider configuration ───────────────────────────────────────────

export type LlmProvider = Config["llmProvider"];

export interface ProviderConfig {
  provider: LlmProvider;
  apiKey?: string;
  baseUrl: string;
  model: string;
}

export const PROVIDER_DEFAULTS: Partial<
  Record<LlmProvider, { baseUrl: string }>
> = {
  openai: { baseUrl: "https://api.openai.com/v1" },
  anthropic: { baseUrl: "https://api.anthropic.com/v1" },
  ollama: { baseUrl: "http://localhost:11434" },
} as const;
