import { describe, it, expect } from "vitest";
import { hipHopValidators } from "../src/validators.js";
import { HipHopInputs, HipHopBlueprint } from "../src/schema.js";

describe("Hip-Hop validators", () => {
  describe("input validator", () => {
    const validInput: HipHopInputs = {
      subgenre: "boom_bap",
      bpm: 90,
      key: "C",
      scale: "minor",
      mood: "",
      narrativeArc: "braggadocio",
      rhymeStyle: "end_rhyme",
      flowPattern: "laid_back",
      delivery: "conversational",
      productionStyle: "polished",
      energy: 6,
      complexity: 5,
      lyricsMode: "full_lyrics",
      customTags: "",
      reference: "",
    };

    it("accepts valid inputs", () => {
      const errors = hipHopValidators.input(validInput);
      expect(errors).toHaveLength(0);
    });

    it("rejects unknown subgenre", () => {
      const errors = hipHopValidators.input({
        ...validInput,
        subgenre: "bogus_style",
      });
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].field).toBe("subgenre");
    });

    it("rejects BPM outside subgenre range", () => {
      const errors = hipHopValidators.input({ ...validInput, bpm: 999 });
      expect(errors.some((e) => e.field === "bpm")).toBe(true);
    });

    it("rejects energy out of bounds", () => {
      const tooLow = hipHopValidators.input({ ...validInput, energy: 0 });
      expect(tooLow.some((e) => e.field === "energy")).toBe(true);
      const tooHigh = hipHopValidators.input({ ...validInput, energy: 11 });
      expect(tooHigh.some((e) => e.field === "energy")).toBe(true);
    });
  });

  describe("blueprint validator", () => {
    const validBp: HipHopBlueprint = {
      subgenre: "boom_bap",
      bpm: 90,
      key: "C",
      scale: "minor",
      mood: "raw",
      narrativeArc: "braggadocio",
      rhymeStyle: "end_rhyme",
      flowPattern: "laid_back",
      delivery: "conversational",
      productionStyle: "polished",
      energy: 7,
      complexity: 6,
      lyricsMode: "full_lyrics",
      vocalStyle: "clear",
      tags: ["hip hop", "rap"],
      negativeTags: [],
      styleClauses: [{ key: "genre", value: "boom bap", order: 1 }],
      songStructure: ["intro", "verse", "chorus", "outro"],
    };

    it("accepts valid blueprint", () => {
      const errors = hipHopValidators.blueprint(validBp);
      expect(errors).toHaveLength(0);
    });

    it("rejects missing subgenre", () => {
      const errors = hipHopValidators.blueprint({ ...validBp, subgenre: "" });
      expect(errors.some((e) => e.field === "blueprint.subgenre")).toBe(true);
    });

    it("rejects missing tags array", () => {
      const errors = hipHopValidators.blueprint({
        ...validBp,
        tags: undefined,
      });
      expect(errors.some((e) => e.field === "blueprint.tags")).toBe(true);
    });

    it("rejects missing songStructure", () => {
      const errors = hipHopValidators.blueprint({
        ...validBp,
        songStructure: [],
      });
      expect(errors.some((e) => e.field === "blueprint.songStructure")).toBe(
        true,
      );
    });

    it("rejects non-object blueprint", () => {
      const errors = hipHopValidators.blueprint(null);
      expect(errors.some((e) => e.field === "blueprint")).toBe(true);
    });
  });
});
