import type { GenreValidators } from "@track-forge/genre-core";
import type { PopInputs, PopBlueprint } from "./schema.js";

export const POP_VALIDATORS: GenreValidators<PopInputs> = {
  input: (inputs) => {
    const errors: { field: string; message: string }[] = [];

    if (inputs.bpm < 60 || inputs.bpm > 180) {
      errors.push({ field: "bpm", message: "BPM must be between 60 and 180 for Pop" });
    }
    if (inputs.energy < 1 || inputs.energy > 10) {
      errors.push({ field: "energy", message: "Energy must be between 1 and 10" });
    }
    if (inputs.complexity < 1 || inputs.complexity > 10) {
      errors.push({ field: "complexity", message: "Complexity must be between 1 and 10" });
    }

    return errors;
  },

  blueprint: (data) => {
    const errors: { field: string; message: string }[] = [];
    const bp = data as PopBlueprint;

    if (!bp.subgenre) {
      errors.push({ field: "subgenre", message: "Blueprint missing subgenre" });
    }
    if (!bp.arrangement || bp.arrangement.length === 0) {
      errors.push({ field: "arrangement", message: "Blueprint must have at least one arrangement section" });
    }
    if (!bp.styleClauses || bp.styleClauses.length === 0) {
      errors.push({ field: "styleClauses", message: "Blueprint must have style clauses" });
    }
    if (bp.bpm < 60 || bp.bpm > 180) {
      errors.push({ field: "bpm", message: `BPM ${bp.bpm} out of range for Pop` });
    }
    if (bp.energy < 1 || bp.energy > 10) {
      errors.push({ field: "energy", message: "Energy must be 1-10" });
    }

    return errors;
  },
};
