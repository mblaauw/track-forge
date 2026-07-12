import type { GenreValidators, ValidationError } from "@track-forge/genre-core";
import type { HipHopInputs, HipHopBlueprint } from "./schema.js";
import { getSubgenre, HIP_HOP_SUBGENRES } from "./taxonomy.js";

export const hipHopValidators: GenreValidators<HipHopInputs> = {
  input(inputs: HipHopInputs): ValidationError[] {
    const errors: ValidationError[] = [];

    // Validate subgenre exists
    const subgenre = getSubgenre(inputs.subgenre);
    if (!subgenre) {
      errors.push({
        field: "subgenre",
        message: `Invalid subgenre "${inputs.subgenre}". Valid options: ${HIP_HOP_SUBGENRES.map((s) => s.id).join(", ")}`,
      });
      return errors;
    }

    // Validate BPM in range
    const [bpmMin, bpmMax] = subgenre.bpmRange;
    if (inputs.bpm < bpmMin || inputs.bpm > bpmMax) {
      errors.push({
        field: "bpm",
        message: `BPM ${inputs.bpm} outside recommended range for ${subgenre.label}: ${bpmMin}-${bpmMax}`,
      });
    }

    // Validate energy
    if (inputs.energy != null && (inputs.energy < 1 || inputs.energy > 10)) {
      errors.push({
        field: "energy",
        message: `Energy must be between 1 and 10, got ${inputs.energy}`,
      });
    }

    // Validate complexity
    if (inputs.complexity != null && (inputs.complexity < 1 || inputs.complexity > 10)) {
      errors.push({
        field: "complexity",
        message: `Complexity must be between 1 and 10, got ${inputs.complexity}`,
      });
    }

    return errors;
  },

  blueprint(data: unknown): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!data || typeof data !== "object") {
      errors.push({ field: "blueprint", message: "Blueprint must be an object" });
      return errors;
    }

    const bp = data as Record<string, unknown>;

    if (!bp.subgenre || typeof bp.subgenre !== "string") {
      errors.push({ field: "blueprint.subgenre", message: "Subgenre is required" });
    }

    if (!bp.bpm || typeof bp.bpm !== "number") {
      errors.push({ field: "blueprint.bpm", message: "BPM is required" });
    }

    if (!bp.tags || !Array.isArray(bp.tags)) {
      errors.push({ field: "blueprint.tags", message: "Tags array required" });
    }

    if (!bp.songStructure || !Array.isArray(bp.songStructure) || bp.songStructure.length === 0) {
      errors.push({ field: "blueprint.songStructure", message: "Song structure required" });
    }

    if (!bp.styleClauses || !Array.isArray(bp.styleClauses)) {
      errors.push({ field: "blueprint.styleClauses", message: "Style clauses required" });
    }

    return errors;
  },
};
