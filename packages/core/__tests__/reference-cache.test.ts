import { describe, it, expect } from "vitest";
import { ReferenceCache } from "../src/pipeline/reference-cache.js";

describe("ReferenceCache", () => {
  const hash1 = "abc123" as any;
  const hash2 = "def456" as any;

  it("starts empty", () => {
    const cache = new ReferenceCache();
    expect(cache.size).toBe(0);
  });

  it("stores and retrieves values", () => {
    const cache = new ReferenceCache();
    const ref = {
      sourceHash: hash1,
      genre: "house",
      subgenre: null,
      mood: "energetic",
      tempo: "128",
      key: null,
      structure: [],
      instrumentation: [],
      production: [],
      lyricalThemes: [],
      rhymeScheme: null,
      vocalStyle: null,
      suggestedTags: [],
      negativeTags: [],
      rawAnalysis: "analysis",
    };
    cache.set(hash1, ref);
    expect(cache.get(hash1)).toBe(ref);
    expect(cache.size).toBe(1);
  });

  it("reports has correctly", () => {
    const cache = new ReferenceCache();
    expect(cache.has(hash1)).toBe(false);
    const ref = {
      sourceHash: hash1,
      genre: "rock",
      subgenre: "alt",
      mood: "upbeat",
      tempo: "120",
      key: "C",
      structure: ["verse", "chorus"],
      instrumentation: ["guitar"],
      production: ["clean"],
      lyricalThemes: ["life"],
      rhymeScheme: "AABB",
      vocalStyle: "raspy",
      suggestedTags: ["guitar-driven"],
      negativeTags: ["auto-tune"],
      rawAnalysis: "analysis text",
    };
    cache.set(hash1, ref);
    expect(cache.has(hash1)).toBe(true);
  });

  it("returns undefined for missing key", () => {
    const cache = new ReferenceCache();
    expect(cache.get(hash2)).toBeUndefined();
  });

  it("overwrites existing key", () => {
    const cache = new ReferenceCache();
    const ref1 = {
      sourceHash: hash1,
      genre: "jazz",
      subgenre: null,
      mood: "smooth",
      tempo: "90",
      key: null,
      structure: [],
      instrumentation: [],
      production: [],
      lyricalThemes: [],
      rhymeScheme: null,
      vocalStyle: null,
      suggestedTags: [],
      negativeTags: [],
      rawAnalysis: "first",
    };
    const ref2 = {
      sourceHash: hash1,
      genre: "blues",
      subgenre: null,
      mood: "soulful",
      tempo: "80",
      key: null,
      structure: [],
      instrumentation: [],
      production: [],
      lyricalThemes: [],
      rhymeScheme: null,
      vocalStyle: null,
      suggestedTags: [],
      negativeTags: [],
      rawAnalysis: "second",
    };
    cache.set(hash1, ref1);
    cache.set(hash1, ref2);
    expect(cache.get(hash1)).toBe(ref2);
    expect(cache.size).toBe(1);
  });

  it("clear removes all entries", () => {
    const cache = new ReferenceCache();
    const a = {
      sourceHash: hash1,
      genre: "a",
      subgenre: null,
      mood: "",
      tempo: "",
      key: null,
      structure: [],
      instrumentation: [],
      production: [],
      lyricalThemes: [],
      rhymeScheme: null,
      vocalStyle: null,
      suggestedTags: [],
      negativeTags: [],
      rawAnalysis: "",
    };
    const b = {
      sourceHash: hash2,
      genre: "b",
      subgenre: null,
      mood: "",
      tempo: "",
      key: null,
      structure: [],
      instrumentation: [],
      production: [],
      lyricalThemes: [],
      rhymeScheme: null,
      vocalStyle: null,
      suggestedTags: [],
      negativeTags: [],
      rawAnalysis: "",
    };
    cache.set(hash1, a);
    cache.set(hash2, b);
    expect(cache.size).toBe(2);
    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.get(hash1)).toBeUndefined();
  });
});
