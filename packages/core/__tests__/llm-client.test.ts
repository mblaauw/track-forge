import { describe, expect, it } from "vitest";
import {
  buildProviderRequest,
  getProviderCapabilities,
} from "../src/llm/index.js";
import type { LlmRequest, ProviderConfig } from "../src/llm/index.js";

const BASE_MESSAGES: LlmRequest["messages"] = [
  { role: "system", content: "Be strict." },
  { role: "user", content: "Return JSON." },
];

const BASE_REQUEST: LlmRequest = {
  messages: BASE_MESSAGES,
  temperature: 0.2,
  maxTokens: 100,
  seed: 42,
  responseFormat: "json_object",
};

function cfg(overrides: Partial<ProviderConfig>): ProviderConfig {
  return {
    provider: "openai-compatible",
    apiKey: "test-key",
    baseUrl: "https://llm.example/v1",
    model: "test-model",
    ...overrides,
  } as ProviderConfig;
}

describe("LLM provider request normalization", () => {
  it("keeps system role and JSON mode for OpenAI-compatible providers", () => {
    const request = buildProviderRequest(
      cfg({ provider: "openai-compatible", model: "gpt-oss" }),
      BASE_REQUEST,
    );

    expect(request.url).toBe("https://llm.example/v1/chat/completions");
    expect(request.body).toMatchObject({
      model: "gpt-oss",
      messages: BASE_MESSAGES,
      temperature: 0.2,
      max_tokens: 100,
      seed: 42,
      response_format: { type: "json_object" },
    });
  });

  it("uses native JSON Schema for OpenAI when a schema is supplied", () => {
    const request = buildProviderRequest(
      cfg({ provider: "openai", model: "gpt-4o" }),
      {
        ...BASE_REQUEST,
        responseSchema: {
          type: "object",
          properties: { ok: { type: "boolean" } },
          required: ["ok"],
          additionalProperties: false,
        },
      },
    );

    expect(request.body.response_format).toEqual({
      type: "json_schema",
      json_schema: {
        name: "track_forge_response",
        strict: true,
        schema: {
          type: "object",
          properties: { ok: { type: "boolean" } },
          required: ["ok"],
          additionalProperties: false,
        },
      },
    });
  });

  it("moves system content to Anthropic top-level system", () => {
    const request = buildProviderRequest(
      cfg({ provider: "anthropic", model: "claude-3-5-sonnet" }),
      BASE_REQUEST,
    );

    expect(request.url).toBe("https://llm.example/v1/messages");
    expect(request.headers).toMatchObject({
      "x-api-key": "test-key",
      "anthropic-version": "2023-06-01",
    });
    expect(request.body).toMatchObject({
      model: "claude-3-5-sonnet",
      system: "Be strict.",
      messages: [{ role: "user", content: "Return JSON." }],
    });
    expect(request.body).not.toHaveProperty("response_format");
    expect(request.body).not.toHaveProperty("seed");
  });

  it("uses Ollama chat JSON format for models with system role support", () => {
    const request = buildProviderRequest(
      cfg({
        provider: "ollama",
        baseUrl: "http://localhost:11434",
        model: "llama3",
      }),
      BASE_REQUEST,
    );

    expect(request.url).toBe("http://localhost:11434/api/chat");
    expect(request.body).toMatchObject({
      model: "llama3",
      messages: BASE_MESSAGES,
      stream: false,
      format: "json",
      seed: 42,
    });
  });

  it("folds system instructions into user content for unsupported model families", () => {
    const request = buildProviderRequest(
      cfg({
        provider: "ollama",
        baseUrl: "http://localhost:11434",
        model: "gemma:7b",
      }),
      BASE_REQUEST,
    );

    expect(getProviderCapabilities("ollama", "gemma:7b")).toMatchObject({
      supportsSystemRole: false,
    });
    expect(request.body.messages).toEqual([
      {
        role: "user",
        content:
          "<<<SYSTEM INSTRUCTIONS>>>\nBe strict.\n<<<END SYSTEM INSTRUCTIONS>>>\nReturn JSON.",
      },
    ]);
  });
});
