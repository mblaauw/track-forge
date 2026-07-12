import { describe, it, expect } from "vitest";
import { EDM_VALIDATORS } from "../src/validators.js";
import { EdmInputs, EdmBlueprint } from "../src/schema.js";

describe("EDM validators", () => {
  describe("input validator", () => {
    const validInput: EdmInputs = {
      family: "house",
      subgenre: "deep_house",
      bpm: 120,
      key: "auto",
      scale: "minor",
      mood: "warm",
      energy: 6,
      complexity: 5,
      lyricsMode: "guided_instrumental",
      customTags: [],
      reference: undefined,
    };

    it("accepts valid inputs", () => {
      const errors = EDM_VALIDATORS.input(validInput);
      expect(errors).toHaveLength(0);
    });

    it("rejects unknown subgenre", () => {
      const errors = EDM_VALIDATORS.input({ ...validInput, subgenre: "nonexistent_style" });
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].field).toBe("subgenre");
    });

    it("rejects subgenre not belonging to family", () => {
      const errors = EDM_VALIDATORS.input({ ...validInput, subgenre: "dubstep" });
      expect(errors.some((e) => e.field === "family")).toBe(true);
    });

    it("rejects BPM outside subgenre range", () => {
      const errors = EDM_VALIDATORS.input({ ...validInput, bpm: 999 });
      expect(errors.some((e) => e.field === "bpm")).toBe(true);
    });

    it("rejects energy out of bounds", () => {
      const tooLow = EDM_VALIDATORS.input({ ...validInput, energy: 0 });
      expect(tooLow.some((e) => e.field === "energy")).toBe(true);
      const tooHigh = EDM_VALIDATORS.input({ ...validInput, energy: 11 });
      expect(tooHigh.some((e) => e.field === "energy")).toBe(true);
    });
  });

  describe("blueprint validator", () => {
    const validBp: EdmBlueprint = {
      subgenre: "deep_house",
      bpm: 120,
      key: "auto",
      scale: "minor",
      mood: "warm",
      energy: 6,
      complexity: 5,
      lyricsMode: "guided_instrumental",
      arrangement: [{ section: "intro", bars: 8, tags: [] }],
      styleClauses: [{ key: "genre", value: "deep house", order: 1 }],
      tags: ["electronic"],
      negativeTags: [],
    };

    it("accepts valid blueprint", () => {
      const errors = EDM_VALIDATORS.blueprint(validBp as unknown as Record<string, unknown>);
      expect(errors).toHaveLength(0);
    });

    it("rejects missing subgenre", () => {
      const errors = EDM_VALIDATORS.blueprint({ ...validBp, subgenre: "" } as unknown as Record<string, unknown>);
      expect(errors.some((e) => e.field === "subgenre")).toBe(true);
    });

    it("rejects empty arrangement", () => {
      const errors = EDM_VALIDATORS.blueprint({ ...validBp, arrangement: [] } as unknown as Record<string, unknown>);
      expect(errors.some((e) => e.field === "arrangement")).toBe(true);
    });

    it("rejects missing styleClauses", () => {
      const errors = EDM_VALIDATORS.blueprint({ ...validBp, styleClauses: [] } as unknown as Record<string, unknown>);
      expect(errors.some((e) => e.field === "styleClauses")).toBe(true);
    });
  });
});
