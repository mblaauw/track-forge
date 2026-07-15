import { describe, it, expect } from "vitest";
import {
  parseLyrics,
  serializeLyrics,
  isInstrumental,
} from "../src/lyrics/canonical.js";

// ── Sample fixture: guided instrumental EDM ───────────────────────────

const GUIDED_INSTRUMENTAL = `[128 BPM]
[Key: Fm]
[Genre: techno]

[Intro]
(8 bars)
(instrumental)

[Build — tension, rising]
(4 bars)
(instrumental)

[Drop — bass, kick]
(8 bars)
(instrumental)

[Breakdown — atmospheric]
(8 bars)
(instrumental)

[Outro]
(4 bars)
(instrumental)`;

// ── Sample fixture: full lyrics hip-hop ───────────────────────────────

const FULL_LYRICS = `[90 BPM]
[Key: Cm]
[Genre: boom bap]

[Intro]
(4 bars)
(instrumental)

[Verse]
(8 bars)
Check the mic, one two
Droppin' knowledge from the breakthrough
Street lights guide my pathway

[Chorus — catchy, melodic]
(4 bars)
This is the hook that gets you
This is the sound that moves you

[Verse]
(8 bars)
Second verse, same as the first
Twice the rhyme, double the thirst

[Outro]
(4 bars)
(instrumental)`;

// ── Tests ─────────────────────────────────────────────────────────────

describe("parseLyrics", () => {
  it("parses guided instrumental format", () => {
    const doc = parseLyrics(GUIDED_INSTRUMENTAL);

    expect(doc.bpm).toBe(128);
    expect(doc.key).toBe("Fm");
    expect(doc.genre).toBe("techno");
    expect(doc.metadata.bpm).toBe("128");
    expect(doc.metadata.key).toBe("Fm");
    expect(doc.metadata.genre).toBe("techno");

    expect(doc.sections).toHaveLength(5);

    // Intro
    expect(doc.sections[0]!.type).toBe("intro");
    expect(doc.sections[0]!.bars).toBe(8);
    expect(doc.sections[0]!.instrumental).toBe(true);
    expect(doc.sections[0]!.tags).toEqual([]);

    // Build with tags
    expect(doc.sections[1]!.type).toBe("build");
    expect(doc.sections[1]!.tags).toContain("tension");
    expect(doc.sections[1]!.tags).toContain("rising");
    expect(doc.sections[1]!.bars).toBe(4);

    // Drop
    expect(doc.sections[2]!.type).toBe("drop");
    expect(doc.sections[2]!.tags).toContain("bass");
    expect(doc.sections[2]!.tags).toContain("kick");

    // Breakdown
    expect(doc.sections[3]!.type).toBe("breakdown");
    expect(doc.sections[3]!.tags).toContain("atmospheric");

    // Outro
    expect(doc.sections[4]!.type).toBe("outro");
  });

  it("parses full lyrics format with lyric lines", () => {
    const doc = parseLyrics(FULL_LYRICS);

    expect(doc.bpm).toBe(90);
    expect(doc.key).toBe("Cm");
    expect(doc.genre).toBe("boom bap");
    expect(doc.sections).toHaveLength(5);

    // Verse with lyrics
    const verse1 = doc.sections[1]!;
    expect(verse1.type).toBe("verse");
    expect(verse1.bars).toBe(8);
    expect(verse1.lines).toHaveLength(3);
    expect(verse1.lines[0]).toBe("Check the mic, one two");
    expect(verse1.lines[1]).toBe("Droppin' knowledge from the breakthrough");

    // Chorus with tags
    const chorus = doc.sections[2]!;
    expect(chorus.type).toBe("chorus");
    expect(chorus.tags).toContain("catchy");
    expect(chorus.tags).toContain("melodic");
    expect(chorus.lines).toHaveLength(2);

    // Second verse
    const verse2 = doc.sections[3]!;
    expect(verse2.type).toBe("verse");
    expect(verse2.lines).toHaveLength(2);
  });

  it("handles empty input", () => {
    const doc = parseLyrics("");
    expect(doc.sections).toHaveLength(0);
    expect(doc.bpm).toBeUndefined();
    expect(doc.key).toBeUndefined();
  });

  it("handles input with only metadata", () => {
    const doc = parseLyrics("[140 BPM]\n[Key: Am]");
    expect(doc.bpm).toBe(140);
    expect(doc.key).toBe("Am");
    expect(doc.sections).toHaveLength(0);
  });

  it("resolves section type aliases", () => {
    const doc = parseLyrics(
      "[Pre-Chorus]\n(4 bars)\n[Pre Chorus]\n(4 bars)\n[prechorus]",
    );

    expect(doc.sections).toHaveLength(3);
    expect(doc.sections[0]!.type).toBe("pre_chorus");
    expect(doc.sections[1]!.type).toBe("pre_chorus");
    expect(doc.sections[2]!.type).toBe("pre_chorus");
  });

  it("falls back to verse for unknown section types", () => {
    const doc = parseLyrics("[Unknown Section]");
    expect(doc.sections).toHaveLength(1);
    expect(doc.sections[0]!.type).toBe("verse");
  });
});

describe("serializeLyrics", () => {
  it("serializes guided instrumental back to canonical form", () => {
    const doc = parseLyrics(GUIDED_INSTRUMENTAL);
    const serialized = serializeLyrics(doc);

    // Should start with metadata
    expect(serialized).toContain("[128 BPM]");
    expect(serialized).toContain("[Key: Fm]");
    expect(serialized).toContain("[Genre: techno]");

    // Should contain section markers
    expect(serialized).toContain("[Intro]");
    expect(serialized).toContain("[Build — tension, rising]");
    expect(serialized).toContain("[Drop — bass, kick]");
    expect(serialized).toContain("(instrumental)");
  });

  it("serializes empty document", () => {
    const doc: Parameters<typeof serializeLyrics>[0] = {
      sections: [],
      metadata: {},
    };
    expect(serializeLyrics(doc)).toBe("");
  });
});

describe("isInstrumental", () => {
  it("returns true for guided instrumental", () => {
    const doc = parseLyrics(GUIDED_INSTRUMENTAL);
    expect(isInstrumental(doc)).toBe(true);
  });

  it("returns false for full lyrics with content", () => {
    const doc = parseLyrics(FULL_LYRICS);
    expect(isInstrumental(doc)).toBe(false);
  });

  it("returns true for empty document", () => {
    const doc = parseLyrics("");
    expect(isInstrumental(doc)).toBe(true);
  });
});

describe("parse → serialize roundtrip", () => {
  it("roundtrips guided instrumental", () => {
    const doc = parseLyrics(GUIDED_INSTRUMENTAL);
    const serialized = serializeLyrics(doc);
    const reparsed = parseLyrics(serialized);

    expect(reparsed.bpm).toBe(doc.bpm);
    expect(reparsed.key).toBe(doc.key);
    expect(reparsed.genre).toBe(doc.genre);
    expect(reparsed.sections).toHaveLength(doc.sections.length);

    for (let i = 0; i < doc.sections.length; i++) {
      expect(reparsed.sections[i]!.type).toBe(doc.sections[i]!.type);
      expect(reparsed.sections[i]!.bars).toBe(doc.sections[i]!.bars);
      expect(reparsed.sections[i]!.instrumental).toBe(
        doc.sections[i]!.instrumental,
      );
      expect(reparsed.sections[i]!.tags).toEqual(doc.sections[i]!.tags);
      expect(reparsed.sections[i]!.lines).toEqual(doc.sections[i]!.lines);
    }
  });

  it("roundtrips full lyrics", () => {
    const doc = parseLyrics(FULL_LYRICS);
    const serialized = serializeLyrics(doc);
    const reparsed = parseLyrics(serialized);

    expect(reparsed.bpm).toBe(doc.bpm);
    expect(reparsed.sections).toHaveLength(doc.sections.length);

    // Check lyric content preserved
    const verse1 = doc.sections[1]!;
    const reVerse1 = reparsed.sections[1]!;
    expect(reVerse1.lines).toEqual(verse1.lines);
  });
});
