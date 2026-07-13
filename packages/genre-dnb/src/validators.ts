import type { GenreValidators } from "@track-forge/genre-core";
import type { DnbInputs, DnbBlueprint } from "./schema.js";

export const DNB_VALIDATORS: GenreValidators<DnbInputs> = {
  input: (inputs) => {
    const errors: { field: string; message: string }[] = [];

    if (inputs.bpm < 160 || inputs.bpm > 180) {
      errors.push({ field: "bpm", message: `BPM ${inputs.bpm} outside D&B range 160-180` });
    }

    if (inputs.energy < 1 || inputs.energy > 10) {
      errors.push({ field: "energy", message: "Energy must be 1-10" });
    }

    if (inputs.complexity < 1 || inputs.complexity > 10) {
      errors.push({ field: "complexity", message: "Complexity must be 1-10" });
    }

    return errors;
  },

  blueprint: (data) => {
    const errors: { field: string; message: string }[] = [];
    const bp = data as DnbBlueprint;

    if (!bp.subgenre) {
      errors.push({ field: "subgenre", message: "Blueprint missing subgenre" });
    }
    if (!bp.arrangement || bp.arrangement.length === 0) {
      errors.push({ field: "arrangement", message: "Blueprint must have at least one arrangement section" });
    }
    if (!bp.styleClauses || bp.styleClauses.length === 0) {
      errors.push({ field: "styleClauses", message: "Blueprint must have style clauses" });
    }
    if (bp.bpm < 160 || bp.bpm > 180) {
      errors.push({ field: "bpm", message: `BPM ${bp.bpm} out of D&B range` });
    }
    if (bp.energy < 1 || bp.energy > 10) {
      errors.push({ field: "energy", message: "Energy must be 1-10" });
    }

    return errors;
  },
};
