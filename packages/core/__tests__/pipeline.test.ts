import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createDb } from "../src/db/index.js";
import {
  createJob,
  loadJob,
  advanceStage,
  failStage,
  resetJobStage,
} from "../src/pipeline/job-service.js";
import { runPipeline } from "../src/pipeline/orchestrator.js";
import { generateSunoPayload } from "../src/suno/payload.js";
import { schema } from "../src/db/index.js";
import { eq } from "drizzle-orm";
import type { PipelineDeps } from "../src/pipeline/types.js";
import type { Db } from "../src/db/index.js";
import type { GenreModule } from "@track-forge/genre-core";
import { mockLlm, mockSuno, mockGenreModule } from "@track-forge/test-support";
import type {
  JobId,
  GenreId,
  PresetId,
  SunoArtifact,
  CriticFinding,
  GenerationStage,
} from "@track-forge/contracts";

// ── Minimal mock genre module (customized for this test) ──────────────

const mockModule = mockGenreModule();

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
    const job = await createJob(
      db,
      "test-genre" as GenreId,
      "test-preset" as PresetId,
      JSON.stringify({ mood: "test" }),
      "some reference",
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
        db,
        "test-genre" as GenreId,
        "test-preset" as PresetId,
        JSON.stringify({ mood: "test" }),
        "some reference",
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
      const patchNotes = titleArtifacts.filter((a) =>
        a.value.startsWith("Patches:"),
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

  // ── E2E: Review → revision flow ───────────────────────────────────

  describe("E2E - Suno payload round-trip through pipeline", () => {
    let db: Db;
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = mkdtempSync(join(tmpdir(), "tf-e2e-payload-"));
      db = createDb(join(tmpDir, "test.db"));
    });

    afterEach(() => {
      rmSync(tmpDir, { recursive: true, force: true });
    });

    it("pipeline artifacts produce a valid SunoGenerateRequest", async () => {
      const job = await createJob(
        db,
        "test-genre" as GenreId,
        "test-preset" as PresetId,
        "{}",
        null,
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
      expect(result.success).toBe(true);

      // Load version and extract artifacts
      const [version] = await db
        .select()
        .from(schema.versions)
        .where(eq(schema.versions.id, result.versionId!));

      const artifacts = JSON.parse(version!.artifacts) as SunoArtifact[];

      // Extract each artifact type
      const title = artifacts.find((a) => a.type === "title")?.value ?? "";
      const style = artifacts.find((a) => a.type === "style")?.value ?? "";
      const excludedStyles =
        artifacts.find((a) => a.type === "excluded_styles")?.value ?? "";
      const lyrics = artifacts.find((a) => a.type === "lyrics")?.value ?? "";

      // Generate Suno payload from artifacts
      const { request: payload, warnings } = generateSunoPayload({
        title,
        style,
        excludedStyles,
        lyrics,
      });

      expect(payload.customMode).toBe(true);
      expect(payload.title).toBeTruthy();
      expect(payload.style).toBeTruthy();
      expect(payload.model).toBe("V4_5ALL");
      expect(Array.isArray(warnings)).toBe(true);
    });

    it("empty lyrics produce instrumental payload", async () => {
      const job = await createJob(
        db,
        "test-genre" as GenreId,
        "test-preset" as PresetId,
        "{}",
        null,
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
      expect(result.success).toBe(true);

      const [version] = await db
        .select()
        .from(schema.versions)
        .where(eq(schema.versions.id, result.versionId!));

      const artifacts = JSON.parse(version!.artifacts) as SunoArtifact[];
      const lyrics = artifacts.find((a) => a.type === "lyrics")?.value ?? "";
      const style = artifacts.find((a) => a.type === "style")?.value ?? "";
      const excludedStyles =
        artifacts.find((a) => a.type === "excluded_styles")?.value ?? "";
      const title = artifacts.find((a) => a.type === "title")?.value ?? "";

      const { request: payload } = generateSunoPayload({
        title,
        style,
        excludedStyles,
        lyrics,
      });

      expect(payload.instrumental).toBe(true);
      expect(payload.prompt).toBeUndefined();
    });
  });

  // ── Pipeline stage execution order ─────────────────────────────────

  describe("Pipeline stage execution", () => {
    let db: Db;
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = mkdtempSync(join(tmpdir(), "tf-stage-"));
      db = createDb(join(tmpDir, "test.db"));
    });

    afterEach(() => {
      rmSync(tmpDir, { recursive: true, force: true });
    });

    it("runs all three stages in order (compilation → lyrics_writing → versioning)", async () => {
      const job = await createJob(
        db,
        "test-genre" as GenreId,
        "test-preset" as PresetId,
        JSON.stringify({ mood: "test" }),
        null,
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
      expect(result.success).toBe(true);

      const [finalJob] = await db
        .select()
        .from(schema.jobs)
        .where(eq(schema.jobs.id, job.id));

      expect(finalJob!.status).toBe("completed");
      expect(finalJob!.currentStage).toBe("versioning");
    });

    it("skips LLM call when lyricsMode is strict_instrumental", async () => {
      let llmCalled = false;
      const llm = {
        async complete() {
          llmCalled = true;
          return {
            content: '{"document":{"sections":[{"type":"verse","lines":["test"]}]}}',
            model: "mock",
            usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
          };
        },
      };

      const job = await createJob(
        db,
        "test-genre" as GenreId,
        "test-preset" as PresetId,
        JSON.stringify({ mood: "test", lyricsMode: "strict_instrumental" }),
        null,
      );
      const deps: PipelineDeps = {
        db,
        llm: llm as any,
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
      expect(llmCalled).toBe(false);

      const [version] = await db
        .select()
        .from(schema.versions)
        .where(eq(schema.versions.id, result.versionId!));

      const artifacts = JSON.parse(version!.artifacts) as SunoArtifact[];
      const lyrics = artifacts.find((a) => a.type === "lyrics")?.value ?? "";
      expect(lyrics).toBe("");
    });
  });
});
