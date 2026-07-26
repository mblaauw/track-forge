import { describe, it, expect } from "vitest";
import {
  migrateLegacyJob,
  SongIntentV1Schema,
  hashIntent,
} from "../src/index.js";

describe("migrateLegacyJob: tags shape detection", () => {
  it("tags as descriptor objects → maps to musical.descriptors, not exclusions", () => {
    const inputs = JSON.stringify({
      tags: [
        { label: "warm bass", cat: "sound", weight: 3 },
        { label: "ambient pads", cat: "atmosphere", weight: 2 },
      ],
      bpm: 128,
    });
    const { intent, hash } = migrateLegacyJob({
      genreId: "edm",
      presetId: "dance_pop_catchy",
      inputs,
    });

    // Validates against strict schema
    const parsed = SongIntentV1Schema.parse(intent);
    expect(hashIntent(parsed)).toBe(hash);

    // Descriptors are populated
    expect(parsed.musical.descriptors).toHaveLength(2);
    expect(parsed.musical.descriptors[0]).toMatchObject({
      label: "warm bass",
      cat: "sound",
      weight: 3,
    });

    // No "[object Object]" in exclusions
    expect(parsed.exclusions).toEqual([]);
    expect(parsed.exclusions.every((e) => !e.includes("[object Object]"))).toBe(
      true,
    );
  });

  it("tags as exclusion strings → maps to exclusions", () => {
    const inputs = JSON.stringify({
      tags: ["guitar", "acoustic", "vocals"],
      bpm: 128,
    });
    const { intent, hash } = migrateLegacyJob({
      genreId: "hiphop",
      presetId: "boom_bap_classic",
      inputs,
    });

    const parsed = SongIntentV1Schema.parse(intent);
    expect(hashIntent(parsed)).toBe(hash);

    // Exclusions come from tags
    expect(parsed.exclusions).toHaveLength(3);
    expect(parsed.exclusions).toContain("guitar");
    expect(parsed.exclusions).toContain("vocals");

    // No descriptors from this path
    expect(parsed.musical.descriptors).toEqual([]);
  });

  it("excludedStyles takes priority over tags", () => {
    const inputs = JSON.stringify({
      excludedStyles: "guitar, piano",
      tags: ["drums", "bass"],
      bpm: 128,
    });
    const { intent, hash } = migrateLegacyJob({
      genreId: "edm",
      presetId: "instrumental_cinematic",
      inputs,
    });

    const parsed = SongIntentV1Schema.parse(intent);
    expect(hashIntent(parsed)).toBe(hash);

    // excludedStyles wins
    expect(parsed.exclusions).toEqual(["guitar", "piano"]);
    expect(parsed.exclusions).not.toContain("drums");
  });

  it("tags as empty array → no descriptors, no exclusions", () => {
    const inputs = JSON.stringify({
      tags: [],
      bpm: 128,
    });
    const { intent, hash } = migrateLegacyJob({
      genreId: "edm",
      presetId: "dance_pop_catchy",
      inputs,
    });

    const parsed = SongIntentV1Schema.parse(intent);
    expect(hashIntent(parsed)).toBe(hash);
    expect(parsed.musical.descriptors).toEqual([]);
    expect(parsed.exclusions).toEqual([]);
  });

  it("tags as mixed content (descriptor objs + strings) → treats as descriptors", () => {
    // The first-item heuristic detects descriptors; ensure mixed doesn't corrupt
    const inputs = JSON.stringify({
      tags: [{ label: "deep bass", cat: "sound", weight: 3 }, "some_other"],
      bpm: 128,
    });
    const { intent } = migrateLegacyJob({
      genreId: "edm",
      presetId: "dance_pop_catchy",
      inputs,
    });

    // First-item check sees an object → treated as descriptors
    // The string items fail mapDescriptor and are filtered out
    expect(intent.musical.descriptors).toHaveLength(1);
    expect(intent.musical.descriptors[0]).toMatchObject({
      label: "deep bass",
      cat: "sound",
      weight: 3,
    });
    // Exclusions remain empty since descriptor path was chosen
    expect(intent.exclusions).toEqual([]);
  });

  it("legacy descriptors field is still preferred for structured descriptors", () => {
    const inputs = JSON.stringify({
      descriptors: [{ label: "warm bass", cat: "sound", weight: 3 }],
      tags: [{ label: "bright highs", cat: "sound", weight: 2 }],
      bpm: 128,
    });
    const { intent } = migrateLegacyJob({
      genreId: "edm",
      presetId: "dance_pop_catchy",
      inputs,
    });

    // `descriptors` field takes priority (applied in applyMusical)
    // `tags` as descriptors only fills in if musical.descriptors is empty
    expect(intent.musical.descriptors).toHaveLength(1);
    expect(intent.musical.descriptors[0].label).toBe("warm bass");
  });
});
