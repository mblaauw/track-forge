import { describe, it, expect } from "vitest";
import {
  materializeIntent,
  flattenIntentToInputs,
  defaultSongIntent,
  SongIntentV1Schema,
  type PresetCatalog,
  type SongIntentDraft,
} from "../src/index.js";

const emptyCatalog: PresetCatalog = {
  getPreset() {
    return undefined;
  },
};

function presetVal(bpm: number, mood: string): PresetCatalog["getPreset"] {
  return (_gid: string, _pid: string) => ({
    name: "Test Preset",
    values: {
      bpm,
      mood,
      energy: 5,
      complexity: 4,
      characteristics: ["lo-fi", "warm"],
      lyricsMode: "strict_instrumental",
    },
  });
}

describe("materializeIntent", () => {
  it("produces a valid SongIntentV1 from empty draft", () => {
    const draft: SongIntentDraft = { selectedStyles: [], userValues: {} };
    const result = materializeIntent(draft, emptyCatalog);
    expect(() => SongIntentV1Schema.parse(result.intent)).not.toThrow();
    expect(result.warnings).toHaveLength(0);
    expect(result.provenance).toEqual({});
  });

  it("applies preset values from the catalog", () => {
    const catalog: PresetCatalog = { getPreset: presetVal(90, "dark") };
    const draft: SongIntentDraft = {
      selectedStyles: [
        {
          genreId: "hiphop",
          presetId: "boom_bap",
          role: "primary",
          strength: 3,
        },
      ],
      userValues: {},
    };
    const result = materializeIntent(draft, catalog);
    expect(result.intent.musical.bpm).toBe(90);
    expect(result.intent.musical.mood).toBe("dark");
    expect(result.intent.musical.energy).toBe(5);
    expect(result.intent.musical.characteristics).toEqual(["lo-fi", "warm"]);
  });

  it("user values override preset values", () => {
    const catalog: PresetCatalog = { getPreset: presetVal(90, "dark") };
    const draft: SongIntentDraft = {
      selectedStyles: [
        {
          genreId: "hiphop",
          presetId: "boom_bap",
          role: "primary",
          strength: 3,
        },
      ],
      userValues: {
        musical: { bpm: 140, characteristics: [], descriptors: [] },
      },
    };
    const result = materializeIntent(draft, catalog);
    expect(result.intent.musical.bpm).toBe(140);
    expect(result.intent.musical.energy).toBe(5); // preset value, not overridden
  });

  it("flat user inputs override preset values (userFlat)", () => {
    const catalog: PresetCatalog = { getPreset: presetVal(90, "dark") };
    const draft: SongIntentDraft = {
      selectedStyles: [
        {
          genreId: "hiphop",
          presetId: "boom_bap",
          role: "primary",
          strength: 3,
        },
      ],
      userValues: {},
      userFlat: { bpm: 120, energy: 8 },
    };
    const result = materializeIntent(draft, catalog);
    expect(result.intent.musical.bpm).toBe(120);
    expect(result.intent.musical.energy).toBe(8);
  });

  it("detects multiple primary styles", () => {
    const catalog: PresetCatalog = { getPreset: presetVal(128, "happy") };
    const draft: SongIntentDraft = {
      selectedStyles: [
        { genreId: "edm", presetId: "a", role: "primary", strength: 3 },
        { genreId: "edm", presetId: "b", role: "primary", strength: 3 },
      ],
      userValues: {},
    };
    const result = materializeIntent(draft, catalog);
    expect(result.warnings.length).toBeGreaterThanOrEqual(1);
    expect(result.warnings[0]!.message).toContain("Multiple primary");
  });

  it("records provenance for preset values", () => {
    const catalog: PresetCatalog = { getPreset: presetVal(85, "smooth") };
    const draft: SongIntentDraft = {
      selectedStyles: [
        { genreId: "jazz", presetId: "cool", role: "primary", strength: 3 },
      ],
      userValues: {},
    };
    const result = materializeIntent(draft, catalog);
    expect(result.provenance["/musical/bpm"]).toHaveLength(1);
    expect(result.provenance["/musical/bpm"]![0]).toMatchObject({
      kind: "preset",
      id: "cool",
    });
    expect(result.provenance["/musical/energy"]).toBeDefined();
  });

  it("records provenance for user value override", () => {
    const catalog: PresetCatalog = { getPreset: presetVal(128, "warm") };
    const draft: SongIntentDraft = {
      selectedStyles: [
        { genreId: "edm", presetId: "prog", role: "primary", strength: 3 },
      ],
      userValues: {
        musical: { bpm: 100, characteristics: [], descriptors: [] },
      },
    };
    const result = materializeIntent(draft, catalog);
    expect(result.provenance["/musical/bpm"]).toHaveLength(2); // preset + user
    expect(result.provenance["/musical/bpm"]![1]).toMatchObject({
      kind: "user",
    });
  });

  it("carries style influences into the intent", () => {
    const draft: SongIntentDraft = {
      selectedStyles: [
        { genreId: "edm", presetId: "prog", role: "primary", strength: 3 },
        { genreId: "edm", presetId: "deep", role: "influence", strength: 2 },
      ],
      userValues: {},
    };
    const result = materializeIntent(draft, emptyCatalog);
    expect(result.intent.styles).toHaveLength(2);
    expect(result.intent.styles[1]?.role).toBe("influence");
  });
});

describe("flattenIntentToInputs", () => {
  it("round-trips with defaulted non-empty intent", () => {
    const draft: SongIntentDraft = {
      selectedStyles: [
        { genreId: "edm", presetId: "x", role: "primary", strength: 3 },
      ],
      userValues: {},
      userFlat: {
        bpm: 128,
        mood: "dark",
        energy: 7,
        lyricsMode: "full_lyrics",
        sections: [
          {
            id: "s1",
            name: "Verse",
            bars: 8,
            fn: "introduce",
            deltas: [],
            tags: [],
          },
        ],
      },
    };
    const catalog: PresetCatalog = { getPreset: presetVal(90, "bright") };
    const result = materializeIntent(draft, catalog);
    const flat = flattenIntentToInputs(result.intent);
    expect(flat.bpm).toBe(128);
    expect(flat.mood).toBe("dark");
    expect(flat.energy).toBe(7);
    expect(flat.sections).toBeDefined();
    expect(Array.isArray(flat.sections)).toBe(true);
  });
});
