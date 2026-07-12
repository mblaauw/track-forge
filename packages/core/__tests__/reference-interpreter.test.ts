import { describe, it, expect } from "vitest";
import type { SourceHash } from "@track-forge/contracts";
import type { LlmClient, LlmResponse } from "../src/llm/index.js";
import { ReferenceCache } from "../src/pipeline/reference-cache.js";
import {
  interpretReference,
  parseInterpretation,
  formatInterpretedRef,
} from "../src/pipeline/reference-interpreter.js";

const hash = "test-hash" as SourceHash;

// ── Mock LLM ──────────────────────────────────────────────────────────

function mockLlm(response: LlmResponse): LlmClient {
  return { async complete() { return response; } } as unknown as LlmClient;
}

// ── Sample JSON returned by LLM ───────────────────────────────────────

const SAMPLE_JSON = JSON.stringify({
  genre: "hip hop",
  subgenre: "trap",
  mood: "dark and aggressive with melodic hooks",
  tempo: "140 BPM",
  key: "D minor",
  structure: ["intro", "verse", "chorus", "verse", "chorus", "bridge", "outro"],
  instrumentation: ["808 drums", "synth pads", "hi-hats", "bass"],
  production: ["heavy compression", "reverberant", "sidechain pumping"],
  lyricalThemes: ["struggle", "success", "street life"],
  rhymeScheme: "AABB",
  vocalStyle: "melodic rap with autotune",
  suggestedTags: ["trap", "melodic", "dark", "heavy 808"],
  negativeTags: ["acoustic", "lo-fi", "slow"],
});

describe("parseInterpretation", () => {
  it("parses valid JSON correctly", () => {
    const result = parseInterpretation(SAMPLE_JSON, hash);
    expect(result.sourceHash).toBe(hash);
    expect(result.genre).toBe("hip hop");
    expect(result.subgenre).toBe("trap");
    expect(result.mood).toBe("dark and aggressive with melodic hooks");
    expect(result.tempo).toBe("140 BPM");
    expect(result.key).toBe("D minor");
    expect(result.structure).toEqual(["intro", "verse", "chorus", "verse", "chorus", "bridge", "outro"]);
    expect(result.instrumentation).toContain("808 drums");
    expect(result.suggestedTags).toContain("trap");
    expect(result.negativeTags).toContain("acoustic");
    expect(result.vocalStyle).toBe("melodic rap with autotune");
    expect(result.rhymeScheme).toBe("AABB");
  });

  it("strips markdown code fences", () => {
    const fenced = "```json\n" + SAMPLE_JSON + "\n```";
    const result = parseInterpretation(fenced, hash);
    expect(result.genre).toBe("hip hop");
  });

  it("falls back gracefully on invalid JSON", () => {
    const result = parseInterpretation("not valid json at all", hash);
    expect(result.genre).toBe("unknown");
    expect(result.rawAnalysis).toBe("not valid json at all");
  });

  it("fills missing fields with defaults", () => {
    const partial = JSON.stringify({ genre: "rock" });
    const result = parseInterpretation(partial, hash);
    expect(result.genre).toBe("rock");
    expect(result.subgenre).toBeNull();
    expect(result.mood).toBe("unknown");
    expect(result.tempo).toBe("unknown");
    expect(result.structure).toEqual([]);
    expect(result.instrumentation).toEqual([]);
  });

  it("filters non-string array entries", () => {
    const withBad = JSON.stringify({ genre: "jazz", structure: ["verse", 42, "chorus"], suggestedTags: ["cool", null] });
    const result = parseInterpretation(withBad, hash);
    expect(result.structure).toEqual(["verse", "chorus"]);
    expect(result.suggestedTags).toEqual(["cool"]);
  });
});

describe("formatInterpretedRef", () => {
  it("formats full reference nicely", () => {
    const ref = parseInterpretation(SAMPLE_JSON, hash);
    const formatted = formatInterpretedRef(ref);
    expect(formatted).toContain("Genre: hip hop (trap)");
    expect(formatted).toContain("Mood: dark and aggressive with melodic hooks");
    expect(formatted).toContain("Tempo: 140 BPM");
    expect(formatted).toContain("Key: D minor");
    expect(formatted).toContain("Structure: intro, verse, chorus");
    expect(formatted).toContain("Instrumentation: 808 drums");
    expect(formatted).toContain("Avoid: acoustic, lo-fi, slow");
  });

  it("handles minimal reference", () => {
    const ref = parseInterpretation('{"genre":"unknown","mood":"","tempo":""}', hash);
    const formatted = formatInterpretedRef(ref);
    expect(formatted).toContain("Genre: unknown");
    expect(formatted).not.toContain("Key:");
  });
});

describe("interpretReference", () => {
  it("calls LLM on cache miss and returns parsed result", async () => {
    const llm = mockLlm({ content: SAMPLE_JSON, model: "test" });
    const cache = new ReferenceCache();
    const result = await interpretReference("some reference", hash, llm, cache);

    expect(result.genre).toBe("hip hop");
    expect(cache.has(hash)).toBe(true);
    expect(cache.get(hash)?.genre).toBe("hip hop");
  });

  it("returns cached result without calling LLM", async () => {
    let llmCalled = false;
    const llm = {
      async complete() {
        llmCalled = true;
        return { content: SAMPLE_JSON, model: "test" };
      },
    } as unknown as LlmClient;

    const cache = new ReferenceCache();
    const cached = parseInterpretation(SAMPLE_JSON, hash);
    cache.set(hash, cached);

    const result = await interpretReference("some reference", hash, llm, cache);
    expect(result.genre).toBe("hip hop");
    expect(llmCalled).toBe(false);
  });

  it("works without cache", async () => {
    const llm = mockLlm({ content: SAMPLE_JSON, model: "test" });
    const result = await interpretReference("ref", hash, llm);

    expect(result.genre).toBe("hip hop");
  });

  it("handles LLM returning non-JSON gracefully", async () => {
    const llm = mockLlm({ content: "The song has a rock feel with guitars.", model: "test" });
    const result = await interpretReference("ref", hash, llm);

    expect(result.genre).toBe("unknown");
    expect(result.rawAnalysis).toBe("The song has a rock feel with guitars.");
  });
});
