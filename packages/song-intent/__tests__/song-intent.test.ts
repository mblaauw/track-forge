import { describe, it, expect } from "vitest";
import {
  SongIntentV1Schema,
  defaultSongIntent,
  hashIntent,
  migrateLegacyJob,
} from "../src/index.js";

describe("SongIntentV1Schema", () => {
  it("accepts a default intent", () => {
    expect(() => SongIntentV1Schema.parse(defaultSongIntent())).not.toThrow();
  });

  it("rejects an unknown top-level field (strict)", () => {
    const bad = { ...defaultSongIntent(), oops: true };
    expect(() => SongIntentV1Schema.parse(bad)).toThrow();
  });

  it("rejects an unknown field inside musical (strict)", () => {
    const bad = {
      ...defaultSongIntent(),
      musical: { ...defaultSongIntent().musical, oops: true },
    };
    expect(() => SongIntentV1Schema.parse(bad)).toThrow();
  });

  it("rejects an out-of-range bpm", () => {
    const bad = {
      ...defaultSongIntent(),
      musical: { ...defaultSongIntent().musical, bpm: 999 },
    };
    expect(() => SongIntentV1Schema.parse(bad)).toThrow();
  });

  it("rejects an out-of-range descriptor weight", () => {
    const bad = {
      ...defaultSongIntent(),
      musical: {
        ...defaultSongIntent().musical,
        descriptors: [{ label: "x", cat: "sound", weight: 5 as unknown as 1 }],
      },
    };
    expect(() => SongIntentV1Schema.parse(bad)).toThrow();
  });
});

describe("hashIntent", () => {
  it("is order-independent for object keys", () => {
    const a: any = {
      schemaVersion: 1,
      identity: { title: "t" },
      styles: [],
      musical: { characteristics: [], descriptors: [] },
      vocals: { mode: "strict_instrumental", sections: [] },
      lyrics: { themes: [], imageAnchors: [] },
      arrangement: { source: "default", sections: [] },
      exclusions: [],
      references: [],
    };
    const b: any = {
      references: [],
      exclusions: [],
      arrangement: { source: "default", sections: [] },
      lyrics: { themes: [], imageAnchors: [] },
      vocals: { mode: "strict_instrumental", sections: [] },
      musical: { characteristics: [], descriptors: [] },
      styles: [],
      identity: { title: "t" },
      schemaVersion: 1,
    };
    expect(hashIntent(a)).toBe(hashIntent(b));
  });

  it("changes when a field changes", () => {
    const a = defaultSongIntent();
    const b = { ...defaultSongIntent(), identity: { title: "other" } };
    expect(hashIntent(a)).not.toBe(hashIntent(b));
  });
});

describe("migrateLegacyJob: edge cases", () => {
  it("handles null inputs", () => {
    const { intent } = migrateLegacyJob({
      genreId: "edm",
      presetId: "deep_house_chill",
      inputs: null,
    });
    expect(intent.identity.title).toBe("");
    expect(intent.styles[0]?.presetId).toBe("deep_house_chill");
  });

  it("handles malformed JSON inputs", () => {
    const { intent } = migrateLegacyJob({
      genreId: "edm",
      presetId: "deep_house_chill",
      inputs: "not json",
    });
    expect(intent.identity.title).toBe("");
  });

  it("supports comma-joined excludedStyles", () => {
    const { intent } = migrateLegacyJob({
      genreId: "edm",
      presetId: "x",
      inputs: JSON.stringify({ excludedStyles: "vocals, singing, lyrics" }),
    });
    expect(intent.exclusions).toEqual(["vocals", "singing", "lyrics"]);
  });

  it("supports array tags as exclusions", () => {
    const { intent } = migrateLegacyJob({
      genreId: "edm",
      presetId: "x",
      inputs: JSON.stringify({ tags: ["vocals", "lyrics"] }),
    });
    expect(intent.exclusions).toEqual(["vocals", "lyrics"]);
  });

  it("migrates a section with a vocal override", () => {
    const vocal = {
      type: "female_lead",
      delivery: "soft",
      energy: 4,
      adlibs: true,
      harmonies: false,
    };
    const { intent } = migrateLegacyJob({
      genreId: "edm",
      presetId: "x",
      inputs: JSON.stringify({
        sections: [
          {
            id: "s1",
            name: "Verse",
            bars: 16,
            fn: "introduce",
            deltas: [],
            tags: [],
            vocal,
          },
        ],
      }),
    });
    expect(intent.arrangement.sections).toHaveLength(1);
    expect(intent.arrangement.sections[0]?.vocal).toEqual(vocal);
    expect(intent.vocals.sections[0]).toEqual({ sectionId: "s1", vocal });
  });

  it("drops debug-state fields (lyricLines/lyricsGenerated)", () => {
    const { intent } = migrateLegacyJob({
      genreId: "edm",
      presetId: "x",
      inputs: JSON.stringify({
        lyricLines: { s1: ["la"] },
        lyricsGenerated: true,
      }),
    });
    expect(JSON.stringify(intent)).not.toContain("lyricLines");
    expect(JSON.stringify(intent)).not.toContain("lyricsGenerated");
  });

  it("normalizes a known lyricAngle", () => {
    const { intent } = migrateLegacyJob({
      genreId: "edm",
      presetId: "x",
      inputs: JSON.stringify({ lyricAngle: "first_person" }),
    });
    expect(intent.lyrics.angle).toBe("first_person");
  });

  it("drops an unknown lyricAngle rather than coerce", () => {
    const { intent } = migrateLegacyJob({
      genreId: "edm",
      presetId: "x",
      inputs: JSON.stringify({ lyricAngle: "weird_unknown" }),
    });
    expect(intent.lyrics.angle).toBeUndefined();
  });

  it("treats key/scale as optional harmonic hints", () => {
    const { intent } = migrateLegacyJob({
      genreId: "edm",
      presetId: "x",
      inputs: JSON.stringify({ key: "F#", scale: "minor" }),
    });
    expect(intent.musical.key).toBe("F#");
    expect(intent.musical.scale).toBe("minor");
  });
});
