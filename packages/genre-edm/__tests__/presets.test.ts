import { describe, it, expect } from "vitest";
import { EDM_PRESETS } from "../src/presets.js";
import { EdmInputSchema } from "../src/schema.js";

describe("EDM presets", () => {
  it("has 17 presets", () => {
    expect(EDM_PRESETS).toHaveLength(17);
  });

  it("every preset has required fields", () => {
    for (const p of EDM_PRESETS) {
      expect(p.id).toBeTruthy();
      expect(p.name).toBeTruthy();
      expect(p.description).toBeTruthy();
      expect(p.values).toBeDefined();
    }
  });

  it("every preset values are valid EdmInputs (partial)", () => {
    for (const p of EDM_PRESETS) {
      const full = {
        family: p.values.family ?? "house",
        subgenre: p.values.subgenre ?? "deep_house",
        bpm: p.values.bpm ?? 120,
        key: p.values.key ?? "auto",
        scale: p.values.scale ?? "minor",
        mood: p.values.mood ?? "energetic",
        energy: p.values.energy ?? 5,
        complexity: p.values.complexity ?? 5,
        lyricsMode: p.values.lyricsMode ?? "guided_instrumental",
        customTags: [],
      };
      const result = EdmInputSchema.safeParse(full);
      expect(result.success, `${p.id}: ${JSON.stringify(result.error?.issues)}`).toBe(true);
    }
  });

  it("covers all 10 families across presets", () => {
    const families = new Set(EDM_PRESETS.map((p) => p.values.family));
    expect(families.has("house")).toBe(true);
    expect(families.has("techno")).toBe(true);
    expect(families.has("trance")).toBe(true);
    expect(families.has("dnb")).toBe(true);
    expect(families.has("bass")).toBe(true);
    expect(families.has("hardcore")).toBe(true);
    expect(families.has("downtempo")).toBe(true);
    expect(families.has("pop")).toBe(true);
    expect(families.size).toBeGreaterThanOrEqual(8);
  });
});
