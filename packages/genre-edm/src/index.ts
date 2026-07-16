/**
 * @track-forge/genre-edm — EDM genre module.
 *
 * 80+ subgenres across House, Techno, Trance, Breakbeat, D&B,
 * Bass, Hardcore, Electro, Downtempo and Pop families.
 */

import { createGenreModule } from "@track-forge/genre-core";
import type { EdmInputs, EdmBlueprint } from "./schema.js";
import {
  EdmInputSchema,
  EdmBlueprintSchema,
  EDM_DEFAULTS,
  compileBlueprint,
} from "./schema.js";
import { createEdmRenderers } from "./renderers.js";
import { EDM_CRITICS } from "./critics.js";
import { EDM_VALIDATORS } from "./validators.js";

export const edmModule = createGenreModule<EdmInputs, EdmBlueprint>({
  id: "edm",
  name: "EDM",
  inputSchema: EdmInputSchema,
  blueprintSchema: EdmBlueprintSchema,
  defaults: EDM_DEFAULTS,
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
});
