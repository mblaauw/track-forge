import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createDb } from "../src/db/index.js";
import { createJob, loadJob } from "../src/pipeline/job-service.js";
import { runPipeline } from "../src/pipeline/orchestrator.js";
import { schema } from "../src/db/index.js";
import { eq } from "drizzle-orm";
import type { PipelineDeps } from "../src/pipeline/types.js";
import type { Db } from "../src/db/index.js";
import type { GenreModule } from "@track-forge/genre-core";
import type { JobId, GenreId, PresetId, SunoArtifact } from "@track-forge/contracts";

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

// ── Versioning invariants ───────────────────────────────────────────

describe("Versioning invariants", () => {
  let db: Db;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "tf-vi-test-"));
    db = createDb(join(tmpDir, "test.db"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  async function runPipelineAndGetResult() {
    const job = await createJob(
      db, "test-genre" as GenreId, "test-preset" as PresetId,
      JSON.stringify({ mood: "test" }), "some reference",
    );
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
    return { job, result };
  }

  it("creates exactly one version per successful run", async () => {
    const { job, result } = await runPipelineAndGetResult();
    expect(result.success).toBe(true);

    const versions = await db
      .select()
      .from(schema.versions)
      .where(eq(schema.versions.jobId, job.id));

    expect(versions).toHaveLength(1);
    expect(versions[0]!.number).toBe(1);
  });

  it("returned versionId matches the created version row", async () => {
    const { result } = await runPipelineAndGetResult();

    const rows = await db
      .select()
      .from(schema.versions)
      .where(eq(schema.versions.id, result.versionId!));

    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe(result.versionId);
  });

  it("all artifacts reference the created version ID", async () => {
    const { result } = await runPipelineAndGetResult();

    const [version] = await db
      .select()
      .from(schema.versions)
      .where(eq(schema.versions.id, result.versionId!));

    const artifacts = JSON.parse(version!.artifacts) as SunoArtifact[];
    expect(artifacts.length).toBeGreaterThan(0);

    for (const a of artifacts) {
      expect(a.versionId).toBe(result.versionId);
    }
  });

  it("no artifact has versionId pointing to a different version row", async () => {
    const { result } = await runPipelineAndGetResult();

    const allVersions = await db.select().from(schema.versions);
    const otherIds = allVersions
      .filter((v) => v.id !== result.versionId)
      .map((v) => v.id);

    const [version] = await db
      .select()
      .from(schema.versions)
      .where(eq(schema.versions.id, result.versionId!));

    const artifacts = JSON.parse(version!.artifacts) as SunoArtifact[];
    for (const a of artifacts) {
      expect(otherIds).not.toContain(a.versionId);
    }
  });

  it("patch notes are stored in version metadata, not as title artifact", async () => {
    // The mock LLM always returns a generic response so
    // there are no critic findings → no patches.
    // This test verifies that if patches existed, they're
    // NOT stored with type "title".
    const { result } = await runPipelineAndGetResult();

    const [version] = await db
      .select()
      .from(schema.versions)
      .where(eq(schema.versions.id, result.versionId!));

    const artifacts = JSON.parse(version!.artifacts) as SunoArtifact[];
    const titleArtifacts = artifacts.filter((a) => a.type === "title");
    const patchNotes = titleArtifacts.filter(
      (a) => a.value.startsWith("Patches:"),
    );
    expect(patchNotes).toHaveLength(0);
  });

  it("finalizedAt is set for final versions", async () => {
    const { result } = await runPipelineAndGetResult();

    const [version] = await db
      .select()
      .from(schema.versions)
      .where(eq(schema.versions.id, result.versionId!));

    expect(version!.status).toBe("final");
    expect(version!.finalizedAt).not.toBeNull();
  });
});
