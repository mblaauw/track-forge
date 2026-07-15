import type { GenreValidators } from "@track-forge/genre-core";
import type { AmbientInputs, AmbientBlueprint } from "./schema.js";

export const AMBIENT_VALIDATORS: GenreValidators<AmbientInputs> = {
  input: (inputs) => {
    const errors: { field: string; message: string }[] = [];

    if (!inputs.subgenre) {
      errors.push({ field: "subgenre", message: "Subgenre is required" });
    }
    if (inputs.bpm < 40 || inputs.bpm > 120) {
      errors.push({
        field: "bpm",
        message: "BPM must be between 40 and 120 for ambient",
      });
    }
    if (inputs.complexity < 1 || inputs.complexity > 10) {
      errors.push({
        field: "complexity",
        message: "Complexity must be between 1 and 10",
      });
    }
    if (!inputs.soundscape) {
      errors.push({
        field: "soundscape",
        message: "Soundscape description is required",
      });
    }

    return errors;
  },

  blueprint: (data) => {
    const errors: { field: string; message: string }[] = [];
    const bp = data as AmbientBlueprint;

    if (!bp.subgenre) {
      errors.push({ field: "subgenre", message: "Blueprint missing subgenre" });
    }
    if (!bp.arrangement || bp.arrangement.length === 0) {
      errors.push({
        field: "arrangement",
        message: "Blueprint must have at least one arrangement section",
      });
    }
    if (!bp.styleClauses || bp.styleClauses.length === 0) {
      errors.push({
        field: "styleClauses",
        message: "Blueprint must have style clauses",
      });
    }
    if (bp.bpm < 40 || bp.bpm > 120) {
      errors.push({
        field: "bpm",
        message: `BPM ${bp.bpm} out of ambient range`,
      });
    }

    return errors;
  },
};
