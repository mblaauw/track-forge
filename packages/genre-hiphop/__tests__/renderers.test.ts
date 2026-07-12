import { describe, it, expect } from "vitest";
import { createHipHopRenderers } from "../src/renderers.js";
import { HipHopBlueprintSchema } from "../src/schema.js";

function makeBlueprint(overrides: Record<string, unknown> = {}) {
  const base = {
    subgenre: "boom_bap",
    bpm: 90,
    key: "C",
    scale: "minor",
    mood: "raw",
    narrativeArc: "braggadocio" as const,
    rhymeStyle: "end_rhyme" as const,
    flowPattern: "laid_back" as const,
    delivery: "conversational" as const,
    productionStyle: "polished" as const,
    energy: 7,
    complexity: 6,
    lyricsMode: "full_lyrics" as const,
    vocalStyle: "clear",
    tags: ["hip hop", "rap", "boom bap"],
    negativeTags: ["pop"],
    styleClauses: [{ key: "genre", value: "boom bap", order: 1 }],
    songStructure: ["intro", "verse", "chorus", "verse", "chorus", "outro"],
  };
  return HipHopBlueprintSchema.parse({ ...base, ...overrides });
}

describe("Hip-Hop renderers", () => {
  const renderers = createHipHopRenderers();

  it("renderTitle returns non-empty string", () => {
    const bp = makeBlueprint();
    const title = renderers.title(bp);
    expect(title).toBeTruthy();
  });

  it("renderStyle includes BPM and genre description", () => {
    const bp = makeBlueprint();
    const style = renderers.style(bp);
    expect(style).toContain("90BPM");
    expect(style).toContain("Boom Bap");
  });

  it("renderStyle includes energy indicators", () => {
    const low = renderers.style(makeBlueprint({ energy: 3 }));
    expect(low).toContain("3/10");
    const high = renderers.style(makeBlueprint({ energy: 9 }));
    expect(high).toContain("9/10");
  });

  it("renderExcludedStyles returns comma-separated exclusions", () => {
    const bp = makeBlueprint();
    const excluded = renderers.excludedStyles(bp);
    expect(typeof excluded).toBe("string");
    expect(excluded.length).toBeGreaterThan(0);
  });

  it("renderLyrics full_lyrics returns section structure", () => {
    const bp = makeBlueprint({ lyricsMode: "full_lyrics" });
    const lyrics = renderers.lyrics(bp);
    expect(lyrics).toContain("[Verse]");
  });

  it("renderLyrics instrumental returns empty string", () => {
    const bp = makeBlueprint({ lyricsMode: "instrumental" });
    expect(renderers.lyrics(bp)).toBe("");
  });
});
