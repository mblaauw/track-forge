import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Fastify from "fastify";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createDb } from "@track-forge/core";
import { registerJobRoutes } from "../src/routes/jobs.js";
import { registerImportExportRoutes } from "../src/routes/import-export.js";
import type { Db } from "@track-forge/core";
import type { Config } from "@track-forge/contracts";

import { mockLlm, mockSuno } from "@track-forge/test-support";

function createTestDeps(db: Db) {
  return {
    db,
    llm: mockLlm as any,
    suno: mockSuno as any,
    config: {
      sunoBaseUrl: "https://api.sunomusic.com/v1",
      sunoAuthToken: undefined,
      publicBaseUrl: undefined,
      dbPath: ":memory:",
      logLevel: "fatal",
      port: 0,
      llmProvider: "openai",
      llmApiKey: undefined,
      llmModel: "gpt-4o",
    } as Config,
  };
}

describe("Import / Export routes", () => {
  let server: ReturnType<typeof Fastify>;
  let db: Db;
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = mkdtempSync(join(tmpdir(), "tf-ie-test-"));
    db = createDb(join(tmpDir, "test.db"));
    server = Fastify();
    registerJobRoutes(server, createTestDeps(db));
    registerImportExportRoutes(server, { db });
    await server.ready();
  });

  afterEach(async () => {
    await server.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("GET /api/jobs/:id/export exports a job with versions", async () => {
    const createRes = await server.inject({
      method: "POST",
      url: "/api/jobs",
      payload: {
        genreId: "edm",
        presetId: "deep_house_chill",
        inputs: {
          family: "house",
          subgenre: "deep_house",
          bpm: 120,
          key: "auto",
          scale: "minor",
          mood: "warm",
          energy: 6,
          complexity: 5,
          lyricsMode: "strict_instrumental",
          customTags: [],
        },
      },
    });
    const created = JSON.parse(createRes.payload);

    const res = await server.inject({
      method: "GET",
      url: `/api/jobs/${created.id}/export`,
    });

    expect(res.statusCode).toBe(200);
    const bundle = JSON.parse(res.payload);
    expect(bundle.formatVersion).toBe(1);
    expect(bundle.exportedAt).toBeDefined();
    expect(bundle.projects).toHaveLength(1);
    expect(bundle.projects[0].jobs).toHaveLength(1);
    expect(bundle.projects[0].jobs[0].job.id).toBe(created.id);
    expect(Array.isArray(bundle.projects[0].jobs[0].versions)).toBe(true);
  });

  it("GET /api/jobs/:id/export returns 404 for missing job", async () => {
    const res = await server.inject({
      method: "GET",
      url: "/api/jobs/nonexistent/export",
    });
    expect(res.statusCode).toBe(404);
  });

  it("POST /api/jobs/export bulk-exports selected jobs", async () => {
    const r1 = await server.inject({
      method: "POST",
      url: "/api/jobs",
      payload: {
        genreId: "edm",
        presetId: "deep_house_chill",
        inputs: {
          family: "house",
          subgenre: "deep_house",
          bpm: 120,
          key: "auto",
          scale: "minor",
          mood: "warm",
          energy: 6,
          complexity: 5,
          lyricsMode: "strict_instrumental",
          customTags: [],
        },
      },
    });
    const r2 = await server.inject({
      method: "POST",
      url: "/api/jobs",
      payload: {
        genreId: "hiphop",
        presetId: "boom_bap_classic",
        inputs: {
          subgenre: "boom_bap",
          bpm: 90,
          key: "C",
          scale: "minor",
          mood: "",
          narrativeArc: "braggadocio",
          rhymeStyle: "end_rhyme",
          flowPattern: "laid_back",
          delivery: "conversational",
          productionStyle: "polished",
          energy: 6,
          complexity: 5,
          lyricsMode: "full_lyrics",
          customTags: "",
          reference: "",
        },
      },
    });
    const j1 = JSON.parse(r1.payload);
    const j2 = JSON.parse(r2.payload);

    const res = await server.inject({
      method: "POST",
      url: "/api/jobs/export",
      payload: { ids: [j1.id, j2.id] },
    });

    expect(res.statusCode).toBe(200);
    const bundle = JSON.parse(res.payload);
    expect(bundle.projects).toHaveLength(1);
    expect(bundle.projects[0].jobs).toHaveLength(2);
  });

  it("POST /api/jobs/export returns 400 without ids", async () => {
    const res = await server.inject({
      method: "POST",
      url: "/api/jobs/export",
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it("POST /api/jobs/import creates jobs from bundle", async () => {
    const createRes = await server.inject({
      method: "POST",
      url: "/api/jobs",
      payload: {
        genreId: "edm",
        presetId: "deep_house_chill",
        inputs: {
          family: "house",
          subgenre: "deep_house",
          bpm: 120,
          key: "auto",
          scale: "minor",
          mood: "warm",
          energy: 6,
          complexity: 5,
          lyricsMode: "strict_instrumental",
          customTags: [],
        },
      },
    });
    const original = JSON.parse(createRes.payload);

    const exportRes = await server.inject({
      method: "GET",
      url: `/api/jobs/${original.id}/export`,
    });
    const bundle = JSON.parse(exportRes.payload);

    await server.inject({
      method: "DELETE",
      url: `/api/jobs/${original.id}`,
    });

    const importRes = await server.inject({
      method: "POST",
      url: "/api/projects/import",
      payload: bundle,
    });

    expect(importRes.statusCode).toBe(201);
    const result = JSON.parse(importRes.payload);
    expect(result.imported).toBe(1);
    expect(result.errors).toHaveLength(0);
  });

  it("POST /api/projects/import returns 400 for invalid formatVersion", async () => {
    const res = await server.inject({
      method: "POST",
      url: "/api/projects/import",
      payload: { formatVersion: 2, projects: [] },
    });
    expect(res.statusCode).toBe(400);
  });

  it("POST /api/projects/import skips existing jobs", async () => {
    const createRes = await server.inject({
      method: "POST",
      url: "/api/jobs",
      payload: {
        genreId: "edm",
        presetId: "deep_house_chill",
        inputs: {
          family: "house",
          subgenre: "deep_house",
          bpm: 120,
          key: "auto",
          scale: "minor",
          mood: "warm",
          energy: 6,
          complexity: 5,
          lyricsMode: "strict_instrumental",
          customTags: [],
        },
      },
    });
    const original = JSON.parse(createRes.payload);

    const exportRes = await server.inject({
      method: "GET",
      url: `/api/jobs/${original.id}/export`,
    });
    const bundle = JSON.parse(exportRes.payload);

    const importRes = await server.inject({
      method: "POST",
      url: "/api/projects/import",
      payload: bundle,
    });

    expect(importRes.statusCode).toBe(200);
    const result = JSON.parse(importRes.payload);
    expect(result.imported).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it("POST /api/projects/import reports errors for unknown genre", async () => {
    const bundle = {
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      projects: [
        {
          project: {
            id: "__bulk",
            name: "Test Import",
            description: null,
            genreId: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          jobs: [
            {
              job: {
                id: "test-import-bad-genre",
                genreId: "nonexistent_genre",
                presetId: "test",
                status: "pending",
                currentStage: "ref_interpretation",
                inputs: "{}",
                stageAttempt: 0,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
              versions: [],
            },
          ],
        },
      ],
    };

    const res = await server.inject({
      method: "POST",
      url: "/api/projects/import",
      payload: bundle,
    });

    expect(res.statusCode).toBe(200);
    const result = JSON.parse(res.payload);
    expect(result.imported).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain("Unknown genre");
  });
});
