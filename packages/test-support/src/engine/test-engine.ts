/**
 * TestEngine — orchestrates an in-process server with typed API client,
 * structured logging, temp DB, and lifecycle management.
 *
 * Usage pattern:
 *
 *   const engine = new TestEngine({ name: "my-test" });
 *   // Register routes (caller-provided, since routes live in the server package)
 *   registerJobRoutes(engine.server, { db: engine.db, config: engine.config, llm, suno });
 *   await engine.ready();
 *
 *   const res = await engine.api.health();
 *   await engine.cleanup();
 */

import Fastify from "fastify";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createDb } from "@track-forge/core";
import type { Db } from "@track-forge/core";
import type { Config } from "@track-forge/contracts";

import { TestLogger } from "./test-logger.js";
import { ApiClient, type InjectFn } from "./api-client.js";

// ── Defaults ────────────────────────────────────────────────────────────────

export function createTestConfig(overrides?: Partial<Config>): Config {
  return {
    sunoBaseUrl: "https://api.sunomusic.com/v1",
    sunoAuthToken: undefined,
    publicBaseUrl: undefined,
    dbPath: ":memory:",
    logLevel: "fatal",
    port: 0,
    host: "127.0.0.1",
    llmProvider: "openai",
    llmApiKey: undefined,
    llmModel: "gpt-4o",
    ...overrides,
  } as Config;
}

// ── Mock helpers ───────────────────────────────────────────────────────────

export function createMockLlm(options?: { content?: string; model?: string }) {
  const mockContent =
    options?.content ??
    JSON.stringify({
      sections: [
        { id: "section-1", lines: ["Test line one", "Test line two"] },
        { id: "section-2", lines: ["Chorus hook line", "Chorus repeat line"] },
      ],
    });
  return {
    async complete(): Promise<{
      content: string;
      model: string;
      usage: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
      };
    }> {
      return {
        content: mockContent,
        model: options?.model ?? "mock-model",
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      };
    },
  };
}

export function createMockSuno() {
  return {
    async submit(): Promise<{ taskId: string; callbackConfigured: boolean }> {
      return { taskId: "mock-suno-id", callbackConfigured: false };
    },
    async getGenerationStatus(): Promise<{
      id: string;
      status: string;
      audioUrl: string | null;
    }> {
      return {
        id: "mock-suno-id",
        status: "completed",
        audioUrl: "https://example.com/audio.mp3",
      };
    },
    async waitForCompletion(): Promise<{
      id: string;
      status: string;
      audioUrl: string | null;
    }> {
      return {
        id: "mock-suno-id",
        status: "completed",
        audioUrl: "https://example.com/audio.mp3",
      };
    },
  };
}

// ── TestEngine ──────────────────────────────────────────────────────────────

export interface TestEngineOptions {
  /** Test name (used for log file name) */
  name: string;
  /** Config overrides */
  configOverrides?: Partial<Config>;
  /** Custom log directory (default: data/test-logs) */
  logDir?: string;
}

export interface TestEngineInstance {
  /** Fastify server (caller registers routes, calls ready()) */
  server: ReturnType<typeof Fastify>;
  /** Typed API client wrapping server.inject() */
  api: ApiClient;
  /** Database handle */
  db: Db;
  /** Test logger */
  log: TestLogger;
  /** Config used */
  config: Config;
  /** Temp directory (cleaned up on close) */
  tmpDir: string;
  /** Clean up: close server, remove temp dir */
  cleanup: () => Promise<void>;
  /** Prepare the engine: create Fastify, start listening */
  ready: () => Promise<void>;
}

export class TestEngine {
  static create(options: TestEngineOptions): TestEngineInstance {
    const log = new TestLogger({
      name: options.name,
      dir: options.logDir,
    });

    const tmpDir = mkdtempSync(join(tmpdir(), `tf-engine-${options.name}-`));
    const config = createTestConfig({
      dbPath: join(tmpDir, "test.db"),
      ...options.configOverrides,
    });
    const db = createDb(config.dbPath);

    const server = Fastify({ logger: false });

    // ApiClient — initially points at a noop inject that gets replaced
    // once routes are registered and server is ready.
    let injectFn: InjectFn = async () => {
      throw new Error("Server not ready — call engine.ready() first");
    };
    const api = new ApiClient((opts) => injectFn(opts), log);

    const ready = async () => {
      await server.ready();
      injectFn = async (opts) => {
        const res = await server.inject({
          method: opts.method as any,
          url: opts.url,
          headers: opts.headers as any,
          payload: opts.payload as any,
        });
        return {
          statusCode: res.statusCode,
          payload:
            typeof res.payload === "string"
              ? res.payload
              : JSON.stringify(res.payload),
          headers: res.headers as Record<string, string>,
        };
      };
      log.info("TestEngine ready", {
        tmpDir,
        dbPath: config.dbPath,
        logPath: log.getLogPath(),
      });
    };

    const cleanup = async () => {
      try {
        await server.close();
      } catch {
        // ignore close errors
      }
      try {
        rmSync(tmpDir, { recursive: true, force: true });
      } catch {
        // ignore cleanup errors
      }
    };

    return { server, api, db, log, config, tmpDir, cleanup, ready };
  }
}
