import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { eq } from "drizzle-orm";
import { createDb } from "../src/db/index.js";
import { schema } from "../src/db/index.js";
import { createJob } from "../src/pipeline/job-service.js";
import { runPipeline } from "../src/pipeline/orchestrator.js";
import type { PipelineDeps } from "../src/pipeline/types.js";
import type { Db } from "../src/db/index.js";
import { mockLlm, mockSuno, mockGenreModule } from "@track-forge/test-support";
import type { GenreId, PresetId } from "@track-forge/contracts";
import { hipHopModule } from "@track-forge/genre-hiphop";
import { edmModule } from "@track-forge/genre-edm";

const mockModule = mockGenreModule();

const styleResultJson = JSON.stringify({
  titleCandidates: ["Test Title", "Alt Title"],
  descriptiveStyle: "LLM-generated style: energetic hip-hop with 808s",
  negativeTags: ["slow", "ballad"],
  bpm: 140,
  key: "Cm",
  vocalDescription: "aggressive delivery",
});

describe("Generative invariants", () => {
  let db: Db;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "tf-geninv-"));
    db = createDb(join(tmpDir, "test.db"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("Hip-Hop renderers produce actual lyrics, no literal [line] placeholders", () => {
    const inputs = JSON.stringify({
      subgenre: "trap",
      mood: "dark",
      bpm: 140,
      key: "C",
      scale: "minor",
      narrativeArc: "braggadocio",
      flowPattern: "aggressive",
      delivery: "intense",
      energy: 8,
      complexity: 6,
      productionStyle: "electronic",
      lyricsMode: "full_lyrics",
      arrangement: [
        { section: "intro", bars: 8, tags: [] },
        { section: "verse", bars: 16, tags: [] },
        { section: "hook", bars: 8, tags: [] },
        { section: "verse", bars: 16, tags: [] },
        { section: "hook", bars: 8, tags: [] },
        { section: "outro", bars: 8, tags: [] },
      ],
      tags: ["trap"],
    });

    const bp = JSON.parse(inputs) as any;
    const lyrics = hipHopModule.renderers.lyrics(bp);

    expect(lyrics).not.toContain("[line]");
    expect(lyrics).toContain("[Verse]");
    expect(lyrics).toContain("[Hook]");
    expect(lyrics).toContain("[Intro]");
  });

  it("EDM Guided Instrumental uses canonical bracket directions", () => {
    const inputs = JSON.stringify({
      subgenre: "house",
      mood: "uplifting",
      bpm: 128,
      key: "F",
      scale: "minor",
      energy: 8,
      complexity: 5,
      productionStyle: "polished",
      lyricsMode: "guided_instrumental",
      arrangement: [
        { section: "intro", bars: 8, tags: ["filtered"] },
        { section: "build", bars: 8, tags: ["riser"] },
        { section: "drop", bars: 16, tags: ["full power"] },
        { section: "break", bars: 8, tags: ["minimal"] },
        { section: "build", bars: 8, tags: ["riser"] },
        { section: "drop", bars: 16, tags: ["full power"] },
        { section: "outro", bars: 8, tags: ["fade"] },
      ],
      tags: ["house"],
    });

    const bp = JSON.parse(inputs) as any;
    const lyrics = edmModule.renderers.lyrics(bp);

    expect(lyrics).not.toContain("[Style");
    expect(lyrics).toContain("[Intro]");
    expect(lyrics).toContain("[Build]");
    expect(lyrics).toContain("[Drop]");
  });

  it("LLM rawStyle affects compiled Style artifact", async () => {
    const llm = mockLlm(
      JSON.stringify({
        ...JSON.parse(styleResultJson),
        descriptiveStyle: "LLM-custom style: ambient piano with heavy bass",
      }),
    );
    const job = await createJob(
      db,
      "test-genre" as GenreId,
      "test-preset" as PresetId,
      "{}",
      "ref",
    );
    const deps: PipelineDeps = {
      db,
      llm: llm as any,
      suno: mockSuno() as any,
      config: {} as any,
    };

    const result = await runPipeline(job.id, deps, mockModule);
    expect(result.success).toBe(true);

    const rows = await db
      .select()
      .from(schema.versions)
      .where(eq(schema.versions.jobId, job.id));
    const artifacts = rows[0]?.artifacts ? JSON.parse(rows[0].artifacts) : [];
    const styleArtifact = artifacts.find((a: any) => a.type === "style");
    expect(styleArtifact?.value).toContain("LLM-custom style");
  });

  it("Raw artist reference is absent from writer prompts and artifacts", async () => {
    const reference =
      "Kendrick Lamar - HUMBLE. This song is about staying humble";
    const llm = mockLlm(styleResultJson);
    const job = await createJob(
      db,
      "test-genre" as GenreId,
      "test-preset" as PresetId,
      JSON.stringify({ mood: "test" }),
      reference,
    );
    const deps: PipelineDeps = {
      db,
      llm: llm as any,
      suno: mockSuno() as any,
      config: {} as any,
    };

    const result = await runPipeline(job.id, deps, mockModule);
    expect(result.success).toBe(true);

    const rows = await db
      .select()
      .from(schema.versions)
      .where(eq(schema.versions.jobId, job.id));
    const artifacts = rows[0]?.artifacts ? JSON.parse(rows[0].artifacts) : [];
    for (const a of artifacts) {
      expect(a.value).not.toContain("Kendrick Lamar");
      expect(a.value).not.toContain("HUMBLE");
    }
  });
});
