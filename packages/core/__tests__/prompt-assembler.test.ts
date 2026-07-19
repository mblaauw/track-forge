import { describe, it, expect } from "vitest";
import type { GenreModule } from "@track-forge/genre-core";
import type { InterpretedReference, SourceHash } from "@track-forge/contracts";
import {
  PromptAssembler,
  fillTemplate,
  buildPromptContext,
  sanitizeReference,
} from "../src/pipeline/prompt-assembler.js";

const hash = "hash" as SourceHash;

const sampleInterpretedRef: InterpretedReference = {
  sourceHash: hash,
  genre: "rock",
  subgenre: "alternative",
  mood: "energetic",
  tempo: "120 BPM",
  key: "C",
  structure: ["verse", "chorus", "bridge"],
  instrumentation: ["guitar", "drums", "bass"],
  production: ["clean", "compressed"],
  lyricalThemes: ["life", "love"],
  rhymeScheme: "AABB",
  vocalStyle: "raspy",
  suggestedTags: ["guitar-driven"],
  negativeTags: ["auto-tune"],
  rawAnalysis: "A rock track with alternative influences.",
};

// ── Mock genre module ─────────────────────────────────────────────────

function mockModule(fragments: Record<string, string> = {}): GenreModule {
  return {
    id: "test",
    name: "Test Genre",
    promptFragments: fragments,
  } as GenreModule;
}

describe("fillTemplate", () => {
  it("replaces simple placeholders", () => {
    const result = fillTemplate("Hello {{name}}!", {
      genreId: "test",
      genreName: "Test",
      presetId: "p",
      reference: null,
      interpretedRef: null,
      name: "World",
    });
    expect(result).toBe("Hello World!");
  });

  it("replaces multiple placeholders", () => {
    const ctx = {
      genreId: "test",
      genreName: "Test",
      presetId: "p",
      reference: null,
      interpretedRef: null,
      subgenre: "House",
      mood: "Energetic",
    };
    const result = fillTemplate("Genre: {{subgenre}}, Mood: {{mood}}.", ctx);
    expect(result).toBe("Genre: House, Mood: Energetic.");
  });

  it("converts arrays to comma-separated", () => {
    const ctx = {
      genreId: "test",
      genreName: "Test",
      presetId: "p",
      reference: null,
      interpretedRef: null,
      tags: ["a", "b", "c"],
    };
    const result = fillTemplate("Tags: {{tags}}", ctx);
    expect(result).toBe("Tags: a, b, c");
  });

  it("returns empty string for unknown placeholder", () => {
    const ctx = {
      genreId: "test",
      genreName: "Test",
      presetId: "p",
      reference: null,
      interpretedRef: null,
    };
    const result = fillTemplate("{{unknown}}", ctx);
    expect(result).toBe("");
  });

  it("resolves dotted paths from context", () => {
    const ctx = {
      genreId: "test",
      genreName: "Test",
      presetId: "p",
      reference: null,
      interpretedRef: null,
      inputs: { genre: "techno" },
    };
    const result = fillTemplate("{{inputs.genre}}", ctx);
    expect(result).toBe("techno");
  });
});

describe("buildPromptContext", () => {
  it("parses input JSON into context", () => {
    const ctx = buildPromptContext({
      genreId: "edm",
      genreName: "EDM",
      presetId: "test",
      inputs: JSON.stringify({ subgenre: "techno", bpm: 128, mood: "dark" }),
      reference: null,
      interpretedRef: null,
    });
    expect(ctx.genreId).toBe("edm");
    expect(ctx.subgenre).toBe("techno");
    expect(ctx.bpm).toBe(128);
    expect(ctx.mood).toBe("dark");
  });

  it("handles null inputs", () => {
    const ctx = buildPromptContext({
      genreId: "x",
      genreName: "X",
      presetId: "p",
      inputs: null,
      reference: null,
      interpretedRef: null,
    });
    expect(ctx.genreId).toBe("x");
  });

  it("sanitizes raw reference text by stripping URLs", () => {
    const ctx = buildPromptContext({
      genreId: "x",
      genreName: "X",
      presetId: "p",
      inputs: null,
      reference: "Check out https://example.com/song lyrics here",
      interpretedRef: null,
    });
    expect(ctx.reference).not.toContain("https://");
    expect(ctx.reference).toContain("lyrics here");
  });

  it("prefers interpreted ref over raw reference when available", () => {
    const ctx = buildPromptContext({
      genreId: "x",
      genreName: "X",
      presetId: "p",
      inputs: null,
      reference: "raw lyrics that should not appear",
      interpretedRef: sampleInterpretedRef,
    });
    expect(ctx.reference).toContain("Genre: rock (alternative)");
    expect(ctx.reference).not.toContain("raw lyrics");
  });

  it("truncates long raw reference without interpreted ref", () => {
    const long = "a".repeat(1000);
    const ctx = buildPromptContext({
      genreId: "x",
      genreName: "X",
      presetId: "p",
      inputs: null,
      reference: long,
      interpretedRef: null,
    });
    expect(ctx.reference!.length).toBeLessThan(600);
    expect(ctx.reference).toMatch(/\.\.\.$/);
  });

  it("returns null when no reference provided", () => {
    const ctx = buildPromptContext({
      genreId: "x",
      genreName: "X",
      presetId: "p",
      inputs: null,
      reference: null,
      interpretedRef: null,
    });
    expect(ctx.reference).toBeNull();
  });

  it("includes formatted interpreted ref when available", () => {
    const ctx = buildPromptContext({
      genreId: "x",
      genreName: "X",
      presetId: "p",
      inputs: null,
      reference: "some lyrics",
      interpretedRef: sampleInterpretedRef,
    });
    expect(ctx.interpretedRef).toContain("Genre: rock (alternative)");
    expect(ctx.interpretedRef).toContain("Mood: energetic");
  });
});

describe("PromptAssembler", () => {
  it("resolves prompt from genre fragments", () => {
    const module = mockModule({ planning: "Plan a {{subgenre}} track." });
    const assembler = new PromptAssembler(module);
    const ctx = buildPromptContext({
      genreId: "edm",
      genreName: "EDM",
      presetId: "p",
      inputs: JSON.stringify({ subgenre: "techno" }),
      reference: null,
      interpretedRef: null,
    });
    const result = assembler.resolvePrompt("planning", ctx);
    expect(result).toBe("Plan a techno track.");
  });

  it("falls back to default template when fragment missing", () => {
    const module = mockModule({});
    const assembler = new PromptAssembler(module);
    const ctx = buildPromptContext({
      genreId: "x",
      genreName: "X",
      presetId: "p",
      inputs: null,
      reference: null,
      interpretedRef: null,
    });
    const result = assembler.resolvePrompt("planning", ctx);
    expect(result).toContain("song plan");
  });

  it("returns null for unknown stage", () => {
    const module = mockModule({});
    const assembler = new PromptAssembler(module);
    const result = assembler.resolvePrompt("nonexistent_stage", {} as any);
    expect(result).toBeNull();
  });

  it("builds manifest with all stages", () => {
    const module = mockModule({});
    const assembler = new PromptAssembler(module);
    const ctx = buildPromptContext({
      genreId: "x",
      genreName: "X",
      presetId: "p",
      inputs: null,
      reference: null,
      interpretedRef: null,
    });
    const manifest = assembler.buildManifest(ctx);
    expect(manifest.planning).toBeTruthy();
    expect(manifest.style_writing).toBeTruthy();
    expect(manifest.lyrics_writing).toBeTruthy();
  });

  it("tries alternative fragment keys", () => {
    // EDM uses "style" not "style_writing"
    const module = mockModule({ style: "Describe {{subgenre}} style." });
    const assembler = new PromptAssembler(module);
    const ctx = buildPromptContext({
      genreId: "edm",
      genreName: "EDM",
      presetId: "p",
      inputs: JSON.stringify({ subgenre: "house" }),
      reference: null,
      interpretedRef: null,
    });
    const result = assembler.resolvePrompt("style_writing", ctx);
    expect(result).toBe("Describe house style.");
  });

  it("prefers genre fragment over fallback", () => {
    const module = mockModule({ planning: "Custom {{subgenre}} plan." });
    const assembler = new PromptAssembler(module);
    const ctx = buildPromptContext({
      genreId: "x",
      genreName: "X",
      presetId: "p",
      inputs: JSON.stringify({ subgenre: "drill" }),
      reference: null,
      interpretedRef: null,
    });
    const result = assembler.resolvePrompt("planning", ctx);
    expect(result).toBe("Custom drill plan.");
    expect(result).not.toContain("song plan");
  });
});
