import { describe, it, expect } from "vitest";
import type { ResolvedSongIntent } from "@track-forge/song-intent";
import {
  deriveRenderHints,
  summarizeVocals,
} from "../src/suno/render-hints.js";
import { renderSunoStyle } from "../src/pipeline/style-compiler.js";

type Sec = ResolvedSongIntent["arrangement"]["sections"][number];

function vocal(type: string, delivery = "Laid back") {
  return { type, delivery, energy: 3, adlibs: false, harmonies: false };
}

function section(name: string, bars: number, extra: Partial<Sec> = {}): Sec {
  return {
    id: `${name}-${bars}`,
    name,
    bars,
    fn: "establish",
    deltas: [],
    tags: [],
    ...extra,
  };
}

function resolved(
  sections: Sec[],
  mode: "full_lyrics" | "strict_instrumental" = "full_lyrics",
  extra: Partial<ResolvedSongIntent> = {},
): ResolvedSongIntent {
  return {
    schemaVersion: 1,
    identity: { title: "T" },
    styles: [],
    genreName: "EDM",
    presetLabels: ["Deep House"],
    bpm: 120,
    characteristics: [],
    descriptors: [],
    vocals: {
      mode,
      hasLeadVocal: mode === "full_lyrics",
      sectionOverrides: [],
    },
    lyrics: {
      shouldWrite: mode === "full_lyrics",
      themes: [],
      imageAnchors: [],
    },
    arrangement: { sections, arcs: [] },
    traits: [],
    conflicts: [],
    decisions: [],
    exclusions: [],
    references: [],
    ...extra,
  };
}

describe("deriveRenderHints", () => {
  it("computes duration from bars and BPM", () => {
    const hints = deriveRenderHints(
      resolved(
        [section("Intro", 8), section("Drop", 24)],
        "strict_instrumental",
      ),
    );
    // 32 bars × 4 beats at 120 BPM
    expect(hints.durationSec).toBe(64);
    expect(hints.vocalGender).toBeUndefined();
  });
});

describe("summarizeVocals", () => {
  it("picks the voice that sings the most bars", () => {
    const summary = summarizeVocals(
      resolved([
        section("Verse", 16, { vocal: vocal("Female lead", "Intimate") }),
        section("Chorus", 8, { vocal: vocal("Female lead", "Powerful") }),
        section("Bridge", 8, { vocal: vocal("Male lead") }),
      ]),
    );
    expect(summary).toEqual({
      label: "female lead",
      delivery: "intimate",
      gender: "f",
    });
  });

  it("does not read 'female' as male", () => {
    expect(
      summarizeVocals(
        resolved([section("Verse", 8, { vocal: vocal("Male lead") })]),
      ).gender,
    ).toBe("m");
    expect(
      summarizeVocals(
        resolved([section("Verse", 8, { vocal: vocal("Female lead") })]),
      ).gender,
    ).toBe("f");
  });

  it("gives no gender for a duet or choir", () => {
    expect(
      summarizeVocals(
        resolved([section("Chorus", 8, { vocal: vocal("Group·choir") })]),
      ),
    ).toMatchObject({ label: "group choir", gender: undefined });
  });

  it("gives no gender for a label naming both", () => {
    expect(
      summarizeVocals(
        resolved([
          section("Chorus", 8, { vocal: vocal("Male · female duet") }),
        ]),
      ),
    ).toMatchObject({ label: "male female duet", gender: undefined });
  });

  it("refuses to guess on an even split", () => {
    expect(
      summarizeVocals(
        resolved([
          section("Verse", 8, { vocal: vocal("Female lead") }),
          section("Chorus", 8, { vocal: vocal("Male lead") }),
        ]),
      ),
    ).toEqual({});
  });

  it("ignores vocals on sections that are not sung", () => {
    expect(
      summarizeVocals(
        resolved([
          section("Intro", 32, { vocal: vocal("Male lead") }),
          section("Verse", 8, { vocal: vocal("Female lead") }),
        ]),
      ).gender,
    ).toBe("f");
  });

  it("is empty for instrumental songs", () => {
    expect(
      summarizeVocals(
        resolved(
          [section("Verse", 8, { vocal: vocal("Female lead") })],
          "strict_instrumental",
        ),
      ),
    ).toEqual({});
  });
});

describe("renderSunoStyle — v6 behaviour", () => {
  it("describes the real arrangement for instrumental songs", () => {
    const { style } = renderSunoStyle(
      resolved(
        [section("Intro", 8), section("Groove", 16), section("Outro", 8)],
        "strict_instrumental",
        {
          arrangement: {
            sections: [
              section("Intro", 8),
              section("Groove", 16),
              section("Outro", 8),
            ],
            typicalSongStructure: ["intro", "verse", "chorus", "outro"],
            arcs: [],
          },
        },
      ),
    );
    expect(style).toContain("structure: intro → groove → outro");
    expect(style).not.toContain("verse");
  });

  it("leaves the structure to the lyrics for vocal songs", () => {
    const { style } = renderSunoStyle(
      resolved(
        [section("Verse", 8, { vocal: vocal("Female lead") })],
        "full_lyrics",
        {
          arrangement: {
            sections: [section("Verse", 8, { vocal: vocal("Female lead") })],
            typicalSongStructure: ["intro", "verse", "chorus"],
            arcs: [],
          },
        },
      ),
    );
    expect(style).not.toContain("structure:");
  });

  it("names the dominant voice and delivery", () => {
    const { style } = renderSunoStyle(
      resolved([
        section("Verse", 16, { vocal: vocal("Female lead", "Laid back") }),
      ]),
    );
    expect(style).toContain("female lead vocals with a laid back delivery");
  });

  it("never states a negative in the style prompt", () => {
    // v6 can add what a "no …" phrase names; exclusions travel in
    // negativeTags instead.
    const { style } = renderSunoStyle(
      resolved([section("Intro", 8)], "strict_instrumental", {
        exclusions: ["vocals", "autotune"],
      }),
    );
    expect(style).not.toMatch(/\bno\s+\w+/i);
    expect(style).not.toContain("autotune");
  });

  it("names peaks after what they are", () => {
    const { style } = renderSunoStyle(
      resolved(
        [
          section("Groove", 16, { fn: "peak" }),
          section("Groove 2", 16, { fn: "peak" }),
        ],
        "strict_instrumental",
      ),
    );
    expect(style).toContain("2 increasingly intense peaks");
  });
});
