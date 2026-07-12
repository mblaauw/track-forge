import { describe, it, expect } from "vitest";
import { HIP_HOP_PRESETS } from "../src/presets.js";
import { HipHopInputSchema } from "../src/schema.js";

describe("Hip-Hop presets", () => {
  it("has 21 presets", () => {
    expect(HIP_HOP_PRESETS).toHaveLength(21);
  });

  it("every preset has required fields", () => {
    for (const p of HIP_HOP_PRESETS) {
      expect(p.id).toBeTruthy();
      expect(p.name).toBeTruthy();
      expect(p.description).toBeTruthy();
      expect(p.values).toBeDefined();
    }
  });

  it("every preset values produce valid HipHopInputs", () => {
    for (const p of HIP_HOP_PRESETS) {
      const full = {
        subgenre: p.values.subgenre ?? "boom_bap",
        bpm: p.values.bpm ?? 90,
        key: p.values.key ?? "C",
        scale: p.values.scale ?? "minor",
        mood: p.values.mood ?? "",
        narrativeArc: p.values.narrativeArc ?? "braggadocio",
        rhymeStyle: p.values.rhymeStyle ?? "end_rhyme",
        flowPattern: p.values.flowPattern ?? "laid_back",
        delivery: p.values.delivery ?? "conversational",
        productionStyle: p.values.productionStyle ?? "polished",
        energy: p.values.energy ?? 6,
        complexity: p.values.complexity ?? 5,
        lyricsMode: p.values.lyricsMode ?? "full_lyrics",
        customTags: "",
        reference: "",
      };
      const result = HipHopInputSchema.safeParse(full);
      expect(result.success, `${p.id}: ${JSON.stringify(result.error?.issues)}`).toBe(true);
    }
  });
});
