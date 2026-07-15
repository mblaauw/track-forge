/**
 * @track-forge/genre-edm — EDM genre module.
 *
 * 80+ subgenres across House, Techno, Trance, Breakbeat, D&B,
 * Bass, Hardcore, Electro, Downtempo and Pop families.
 */

import type { GenreModule } from "@track-forge/genre-core";
import type { EdmInputs, EdmBlueprint } from "./schema.js";
import {
  EdmInputSchema,
  EdmBlueprintSchema,
  EDM_DEFAULTS,
  compileBlueprint,
} from "./schema.js";
import { EDM_FORM_FIELDS } from "./schema.js";
import { createEdmRenderers } from "./renderers.js";
import { EDM_CRITICS } from "./critics.js";
import { EDM_VALIDATORS } from "./validators.js";

// ── Re-exports ────────────────────────────────────────────────────────

export {
  EdmInputSchema,
  EdmBlueprintSchema,
  EDM_DEFAULTS,
  compileBlueprint as edmCompileBlueprint,
} from "./schema.js";
export type { EdmInputs, EdmBlueprint } from "./schema.js";
export { EDM_CRITICS } from "./critics.js";
export { EDM_VALIDATORS } from "./validators.js";
export {
  EDM_SUBGENRES,
  EdmFamily,
  getSubgenre,
  getSubgenresByFamily,
  getFamilyLabel,
  getAllFamilyOptions,
  getSubgenreOptions,
} from "./taxonomy.js";
export type {
  EdmSubgenreEntry,
  EdmFamily as EdmFamilyType,
} from "./taxonomy.js";

/**
 * EDM genre module — full GenreModule<EdmInputs, EdmBlueprint>
 */
export const edmModule: GenreModule<EdmInputs, EdmBlueprint> = {
  id: "edm",
  name: "EDM",
  inputSchema: EdmInputSchema,
  blueprintSchema: EdmBlueprintSchema,
  defaults: EDM_DEFAULTS,
  form: EDM_FORM_FIELDS,
  adjustmentVocabulary: {
    styleTerms: [
      "driving",
      "melodic",
      "dark",
      "warm",
      "atmospheric",
      "aggressive",
      "euphoric",
      "minimal",
      "groovy",
      "hypnotic",
      "rolling",
      "bouncy",
      "deep",
      "hard",
      "soulful",
      "techy",
      "psychedelic",
      "emotional",
      "layered",
      "filtered",
    ],
    structureTerms: [
      "long intro",
      "extended build",
      "early drop",
      "minimal breakdown",
      "extended outro",
      "double drop",
      "climactic bridge",
      "reverse drop",
    ],
    deliveryTerms: [
      "tight percussion",
      "loose groove",
      "syncopated",
      "four-on-the-floor",
      "half-time feel",
      "shuffling hats",
      "rolling bass",
    ],
  },
  tagPolicy: {
    mandatoryTags: ["electronic"],
    forbiddenTags: ["acoustic", "live band", "orchestral"],
    canonicalMap: {
      edm: "electronic",
      dance: "electronic",
      club: "electronic",
      "four to the floor": "four-on-the-floor",
      "4x4": "four-on-the-floor",
    },
  },
  promptFragments: {
    planning:
      "Describe a {{subgenre}} EDM track arrangement: {{bpm}} BPM, {{key}} {{scale}}, {{mood}}, energy {{energy}}/10. Outline sections (intro, build, drop, breakdown, outro) with energy arc and production notes.\n{{nlAdjustments}}",
    style:
      'Suno AI style for {{subgenre}} ({{bpm}}BPM, {{key}} {{scale}}, {{mood}}, energy {{energy}}/10).\n{{nlAdjustments}}\nReturn ONLY valid JSON:\n{"titleCandidates":["title1","title2"],"descriptiveStyle":"...","negativeTags":["..."],"bpm":128,"key":"Am","vocalDescription":"..."}',
    lyrics_instrumental:
      "Generate instrumental arrangement tags for a {{subgenre}} track with sections: intro, build, drop, breakdown, outro.\n{{nlAdjustments}}",
    lyrics_full:
      "Write lyrics for a {{subgenre}} dance track. Include verse, chorus, bridge structure with a strong hook.",
    excluded:
      "List styles and elements to exclude when generating a {{subgenre}} track.",
    style_tag_suggestions:
      "Suggest style tags for {{subgenre}} ({{bpm}}BPM, {{key}} {{scale}}, {{mood}}, energy {{energy}}/10). Return 4 categories: genre (subgenre-specific), mood (mood keywords), inst (instruments/synths), prod (production techniques). 6-8 suggestions per category. Return as JSON with keys genre, mood, inst, prod, each an array of strings.",
  },
  compileBlueprint: compileBlueprint,
  renderers: createEdmRenderers(),
  critics: EDM_CRITICS,
  validators: EDM_VALIDATORS,
  migrations: [],
};

export default edmModule;
