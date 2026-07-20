import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Fastify from "fastify";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createDb } from "@track-forge/core";
import { registerJobRoutes } from "../src/routes/jobs.js";
import { registerHealthRoutes } from "../src/routes/health.js";
import type { Db } from "@track-forge/core";
import type { Config } from "@track-forge/contracts";
import type { JobRouteDeps } from "../src/routes/jobs.js";

import { mockLlm, mockSuno } from "@track-forge/test-support";

function createTestDeps(
  db: Db,
  configOverrides: Partial<Config> = {},
): JobRouteDeps {
  return {
    db,
    llm: mockLlm(),
    suno: mockSuno(),
    config: {
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
      ...configOverrides,
    },
  };
}

describe("Jobs routes", () => {
  let server: ReturnType<typeof Fastify>;
  let db: Db;
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = mkdtempSync(join(tmpdir(), "tf-srv-test-"));
    db = createDb(join(tmpDir, "test.db"));
    server = Fastify();
    registerHealthRoutes(server);
    registerJobRoutes(server, createTestDeps(db));
    await server.ready();
  });

  afterEach(async () => {
    await server.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("POST /api/jobs creates a job", async () => {
    const res = await server.inject({
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
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.id).toBeDefined();
    expect(body.genreId).toBe("edm");
    expect(body.status).toBe("pending");
  });

  it("POST /api/jobs validates inputs via genre schema", async () => {
    const res = await server.inject({
      method: "POST",
      url: "/api/jobs",
      payload: {
        genreId: "edm",
        presetId: "deep_house_chill",
        inputs: {
          family: "house",
          subgenre: "deep_house",
          bpm: 9999,
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
    expect(res.statusCode).toBe(400);
  });

  it("POST /api/jobs returns 404 for unknown genre", async () => {
    const res = await server.inject({
      method: "POST",
      url: "/api/jobs",
      payload: {
        genreId: "bogus_genre",
        presetId: "test",
        inputs: {},
      },
    });
    expect(res.statusCode).toBe(404);
  });

  it("GET /api/jobs returns paginated jobs", async () => {
    // Create 2 jobs
    await server.inject({
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
    await server.inject({
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

    const res = await server.inject({ method: "GET", url: "/api/jobs" });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(2);
  });

  it("GET /api/jobs/:id returns single job", async () => {
    const createRes = await server.inject({
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
    const created = JSON.parse(createRes.payload);

    const getRes = await server.inject({
      method: "GET",
      url: `/api/jobs/${created.id}`,
    });
    expect(getRes.statusCode).toBe(200);
    expect(JSON.parse(getRes.payload).id).toBe(created.id);
  });

  it("GET /api/jobs/:id returns 404 for missing", async () => {
    const res = await server.inject({
      method: "GET",
      url: "/api/jobs/nonexistent-id",
    });
    expect(res.statusCode).toBe(404);
  });

  it("GET /api/genres returns genre list", async () => {
    const res = await server.inject({ method: "GET", url: "/api/genres" });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.length).toBeGreaterThanOrEqual(2);
    expect(body.some((g: any) => g.id === "edm")).toBe(true);
    expect(body.some((g: any) => g.id === "hiphop")).toBe(true);
  });
});
