import { describe, it, expect } from "vitest";
import type { LyricsDocument, SurgicalPatch } from "@track-forge/contracts";
import { applyLyricsPatch, isLyricsSectionPatch } from "../src/pipeline/lyrics-patcher.js";

const sampleDoc: LyricsDocument = {
  bpm: 140,
  key: "Am",
  genre: "Hip-Hop",
  sections: [
    { type: "verse", lines: ["line 1", "line 2"], bars: 8, tags: ["energetic"], instrumental: false },
    { type: "hook", lines: ["hook line"], bars: 4, tags: ["catchy"], instrumental: false },
    { type: "bridge", lines: ["bridge line"], bars: 6, tags: ["build"], instrumental: false },
  ],
  metadata: {},
};

const sampleJson = JSON.stringify(sampleDoc);

describe("isLyricsSectionPatch", () => {
  it("returns true for section patch types", () => {
    expect(isLyricsSectionPatch("replace_section" as any)).toBe(true);
    expect(isLyricsSectionPatch("insert_section" as any)).toBe(true);
    expect(isLyricsSectionPatch("merge_section_lines" as any)).toBe(true);
    expect(isLyricsSectionPatch("change_section_bars" as any)).toBe(true);
    expect(isLyricsSectionPatch("change_section_tags" as any)).toBe(true);
  });

  it("returns false for non-section patch types", () => {
    expect(isLyricsSectionPatch("replace_style_description" as any)).toBe(false);
    expect(isLyricsSectionPatch("merge_field" as any)).toBe(false);
    expect(isLyricsSectionPatch("remove_field" as any)).toBe(false);
  });
});

describe("applyLyricsPatch", () => {
  it("replaces a section by index", () => {
    const patch: SurgicalPatch = {
      type: "replace_section" as any,
      target: "lyrics",
      value: JSON.stringify({
        index: 1,
        section: { type: "verse", lines: ["new line"], bars: 12, tags: ["dark"], instrumental: false },
      }),
      description: "Replace hook with second verse",
    };
    const result = applyLyricsPatch(sampleJson, patch);
    const doc = JSON.parse(result) as LyricsDocument;
    expect(doc.sections).toHaveLength(3);
    expect(doc.sections[1]!.type).toBe("verse");
    expect(doc.sections[1]!.lines).toEqual(["new line"]);
    expect(doc.sections[1]!.bars).toBe(12);
  });

  it("inserts a section at position", () => {
    const patch: SurgicalPatch = {
      type: "insert_section" as any,
      target: "lyrics",
      value: JSON.stringify({
        index: 1,
        section: { type: "pre_chorus", lines: ["build up"], bars: 2, tags: [], instrumental: false },
      }),
      description: "Add pre-chorus",
    };
    const result = applyLyricsPatch(sampleJson, patch);
    const doc = JSON.parse(result) as LyricsDocument;
    expect(doc.sections).toHaveLength(4);
    expect(doc.sections[1]!.type).toBe("pre_chorus");
  });

  it("merges lines into a section", () => {
    const patch: SurgicalPatch = {
      type: "merge_section_lines" as any,
      target: "lyrics",
      value: JSON.stringify({ index: 0, lines: ["line 3", "line 4"] }),
      description: "Add more verse lines",
    };
    const result = applyLyricsPatch(sampleJson, patch);
    const doc = JSON.parse(result) as LyricsDocument;
    expect(doc.sections[0]!.lines).toEqual(["line 1", "line 2", "line 3", "line 4"]);
  });

  it("changes bar count", () => {
    const patch: SurgicalPatch = {
      type: "change_section_bars" as any,
      target: "lyrics",
      value: JSON.stringify({ index: 2, bars: 12 }),
      description: "Extend bridge",
    };
    const result = applyLyricsPatch(sampleJson, patch);
    const doc = JSON.parse(result) as LyricsDocument;
    expect(doc.sections[2]!.bars).toBe(12);
  });

  it("changes section tags", () => {
    const patch: SurgicalPatch = {
      type: "change_section_tags" as any,
      target: "lyrics",
      value: JSON.stringify({ index: 0, tags: ["introspective", "slow"] }),
      description: "Update verse tags",
    };
    const result = applyLyricsPatch(sampleJson, patch);
    const doc = JSON.parse(result) as LyricsDocument;
    expect(doc.sections[0]!.tags).toEqual(["introspective", "slow"]);
  });

  it("returns original for invalid JSON input", () => {
    const patch: SurgicalPatch = {
      type: "replace_section" as any,
      target: "lyrics",
      value: JSON.stringify({ index: 0, section: { type: "verse", lines: [], bars: 0, tags: [], instrumental: false } }),
      description: "",
    };
    const result = applyLyricsPatch("not-json", patch);
    expect(result).toBe("not-json");
  });

  it("returns original for out-of-range index", () => {
    const patch: SurgicalPatch = {
      type: "replace_section" as any,
      target: "lyrics",
      value: JSON.stringify({ index: 99, section: { type: "verse", lines: [], bars: 0, tags: [], instrumental: false } }),
      description: "",
    };
    const result = applyLyricsPatch(sampleJson, patch);
    expect(result).toBe(sampleJson);
  });

  it("ignores non-section patch types", () => {
    const patch: SurgicalPatch = {
      type: "merge_field" as any,
      target: "lyrics",
      value: "suffix",
      description: "",
    };
    const result = applyLyricsPatch(sampleJson, patch);
    expect(result).toBe(sampleJson);
  });
});
