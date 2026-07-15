import type { GenreValidators } from "@track-forge/genre-core";
import type { EdmInputs, EdmBlueprint } from "./schema.js";
import { getSubgenre } from "./taxonomy.js";

export const EDM_VALIDATORS: GenreValidators<EdmInputs> = {
  input: (inputs) => {
    const errors: { field: string; message: string }[] = [];

    // Validate subgenre exists
    const entry = getSubgenre(inputs.subgenre);
    if (!entry) {
      errors.push({
        field: "subgenre",
        message: `Unknown subgenre: ${inputs.subgenre}`,
      });
    } else if (entry.family !== inputs.family) {
      errors.push({
        field: "family",
        message: `Subgenre "${inputs.subgenre}" does not belong to family "${inputs.family}"`,
      });
    }

    // Validate BPM is in range for subgenre
    if (
      entry &&
      (inputs.bpm < entry.bpmRange[0] || inputs.bpm > entry.bpmRange[1])
    ) {
      errors.push({
        field: "bpm",
        message: `BPM ${inputs.bpm} outside recommended range ${entry.bpmRange[0]}-${entry.bpmRange[1]} for ${entry.label}`,
      });
    }

    // Validate energy/complexity bounds
    if (inputs.energy < 1 || inputs.energy > 10) {
      errors.push({
        field: "energy",
        message: "Energy must be between 1 and 10",
      });
    }
    if (inputs.complexity < 1 || inputs.complexity > 10) {
      errors.push({
        field: "complexity",
        message: "Complexity must be between 1 and 10",
      });
    }

    return errors;
  },

  blueprint: (data) => {
    const errors: { field: string; message: string }[] = [];
    const bp = data as EdmBlueprint;

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
    if (bp.bpm < 60 || bp.bpm > 220) {
      errors.push({ field: "bpm", message: `BPM ${bp.bpm} out of range` });
    }
    if (bp.energy < 1 || bp.energy > 10) {
      errors.push({ field: "energy", message: "Energy must be 1-10" });
    }

    return errors;
  },
};
