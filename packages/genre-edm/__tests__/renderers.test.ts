import { describe, it, expect } from "vitest";
import { createEdmRenderers } from "../src/renderers.js";
import { buildDefaultArrangement, EdmBlueprintSchema } from "../src/schema.js";

function makeBlueprint(overrides: Record<string, unknown> = {}) {
  const base = {
    subgenre: "deep_house",
    bpm: 120,
    key: "auto",
    scale: "minor",
    mood: "warm",
    energy: 6,
    complexity: 5,
    lyricsMode: "guided_instrumental" as const,
    arrangement: buildDefaultArrangement(6, 5),
    styleClauses: [{ key: "genre", value: "deep house", order: 1 }],
    tags: ["electronic", "deep house"],
    negativeTags: ["acoustic"],
  };
  return EdmBlueprintSchema.parse({ ...base, ...overrides });
}

describe("EDM renderers", () => {
  const renderers = createEdmRenderers();

  it("renderTitle returns non-empty string with subgenre", () => {
    const bp = makeBlueprint();
    const title = renderers.title(bp);
    expect(title).toBeTruthy();
    expect(title).not.toBe("Untitled");
  });

  it("renderTitle returns Untitled for empty data", () => {
    const bp = makeBlueprint({ mood: "energetic", key: "auto" });
    const title = renderers.title(bp);
    expect(title).toBeTruthy();
  });

  it("renderStyle includes BPM and genre description", () => {
    const bp = makeBlueprint();
    const style = renderers.style(bp);
    expect(style).toContain("120 BPM");
    expect(style).toContain("deep house");
    expect(style).toContain("Mood: warm");
  });

  it("renderStyle includes energy indicators", () => {
    const low = renderers.style(makeBlueprint({ energy: 3 }));
    expect(low).toContain("Low energy");

    const high = renderers.style(makeBlueprint({ energy: 9 }));
    expect(high).toContain("High energy");
  });

  it("renderExcludedStyles returns comma-separated exclusions", () => {
    const bp = makeBlueprint({ scale: "minor", energy: 6, complexity: 5 });
    const excluded = renderers.excludedStyles(bp);
    expect(excluded).toBeTruthy();
    expect(typeof excluded).toBe("string");
    // Uses scale-based exclusion
    expect(excluded).toContain("happy");
  });

  it("renderExcludedStyles for strict_instrumental excludes vocals", () => {
    const bp = makeBlueprint({ lyricsMode: "strict_instrumental" });
    const excluded = renderers.excludedStyles(bp);
    expect(excluded).toContain("vocals");
  });

  it("renderExcludedStyles for guided_instrumental excludes vocals", () => {
    const bp = makeBlueprint({ lyricsMode: "guided_instrumental" });
    const excluded = renderers.excludedStyles(bp);
    expect(excluded).toContain("vocals");
  });

  it("renderExcludedStyles for full_lyrics does not exclude vocals", () => {
    const bp = makeBlueprint({ lyricsMode: "full_lyrics" });
    const excluded = renderers.excludedStyles(bp);
    expect(excluded).not.toContain("vocals");
  });

  it("renderLyrics guided_instrumental returns arrangement tags", () => {
    const bp = makeBlueprint({ lyricsMode: "guided_instrumental" });
    const lyrics = renderers.lyrics(bp);
    expect(lyrics).toContain("BPM");
    expect(lyrics).toContain("[Intro]");
    expect(lyrics).toContain("[Drop]");
  });

  it("renderLyrics strict_instrumental returns empty string", () => {
    const bp = makeBlueprint({ lyricsMode: "strict_instrumental" });
    expect(renderers.lyrics(bp)).toBe("");
  });

  it("renderLyrics full_lyrics returns structure with section markers", () => {
    const bp = makeBlueprint({ lyricsMode: "full_lyrics" });
    const lyrics = renderers.lyrics(bp);
    expect(lyrics).toContain("[Intro]");
    expect(lyrics).toContain("[Drop]");
    expect(lyrics).toContain("(instrumental)");
  });
});
