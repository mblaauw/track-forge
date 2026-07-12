import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createDb } from "../src/db/index.js";
import { createJob } from "../src/pipeline/job-service.js";
import { runPipeline } from "../src/pipeline/orchestrator.js";
import type { PipelineDeps } from "../src/pipeline/types.js";
import type { Db } from "../src/db/index.js";
import type { GenreModule } from "@track-forge/genre-core";
import type { JobId, GenreId, PresetId } from "@track-forge/contracts";

// ── Simple mock objects matching the shape used by pipeline ──────────

function mockLlm() {
  return {
    async complete() {
      return { content: "Mock analysis result for testing.", model: "mock", usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 } };
    },
  };
}

function mockSuno() {
  return {
    async submit() {
      return { ids: ["mock-id"], callbackConfigured: false };
    },
    async getGenerationStatus() {
      return { id: "mock-id", status: "completed" as const, audioUrl: "https://example.com/audio.mp3" };
    },
    async waitForCompletion() {
      return { id: "mock-id", status: "completed" as const, audioUrl: "https://example.com/audio.mp3" };
    },
  };
}

// ── Minimal mock genre module ─────────────────────────────────────────

const mockModule: GenreModule = {
  id: "test-genre",
  name: "Test Genre",
  inputSchema: null as any,
  blueprintSchema: null as any,
  defaults: {},
  form: [],
  adjustmentVocabulary: { styleTerms: [], structureTerms: [], deliveryTerms: [] },
  tagPolicy: { mandatoryTags: [], forbiddenTags: [], canonicalMap: {} },
  presets: [],
  promptFragments: {},
  renderers: {
    title: () => "Mock Title",
    style: () => "Mock style description with 120 BPM",
    excludedStyles: () => "slow, ballad",
    lyrics: () => "[Intro]\n(instrumental)\n\n[Verse]\nLyrics here",
  },
  critics: {
    fast: { id: "fast-panel", promptTemplate: "Review this song" },
    full: [],
  },
  validators: {
    input: () => [],
    blueprint: () => [],
  },
  migrations: [],
};

describe("Pipeline orchestrator", () => {
  let db: Db;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "tf-pl-test-"));
    db = createDb(join(tmpDir, "test.db"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("runs full pipeline and creates version", async () => {
    const job = await createJob(db, "test-genre" as GenreId, "test-preset" as PresetId, JSON.stringify({ mood: "test" }), "some reference");
    const deps: PipelineDeps = {
      db,
      llm: mockLlm() as any,
      suno: mockSuno() as any,
      config: {
        sunoBaseUrl: "https://api.sunomusic.com/v1",
        logLevel: "fatal" as any,
        port: 0,
        llmProvider: "openai",
        llmModel: "gpt-4o",
        dbPath: ":memory:",
      } as any,
    };

    const result = await runPipeline(job.id, deps, mockModule);
    expect(result.success).toBe(true);
    expect(result.versionId).toBeTruthy();
    expect(result.error).toBeNull();
  });

  it("returns error for nonexistent job", async () => {
    const deps: PipelineDeps = {
      db,
      llm: mockLlm() as any,
      suno: mockSuno() as any,
      config: {} as any,
    };
    const result = await runPipeline("nonexistent-id", deps, mockModule);
    expect(result.success).toBe(false);
    expect(result.error).toBe("Job not found");
  });

  it("handles renderer failure gracefully", async () => {
    const brokenModule: GenreModule = {
      ...mockModule,
      renderers: {
        title: () => { throw new Error("render fail"); },
        style: () => "",
        excludedStyles: () => "",
        lyrics: () => "",
      },
    };
    const job = await createJob(db, "test-genre" as GenreId, "test-preset" as PresetId, "{}", "ref");
    const deps: PipelineDeps = {
      db,
      llm: mockLlm() as any,
      suno: mockSuno() as any,
      config: {} as any,
    };
    const result = await runPipeline(job.id, deps, brokenModule);
    expect(result.success).toBe(false);
  });
});
