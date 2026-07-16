import { createGenreModule } from "@track-forge/genre-core";
import type { PopInputs, PopBlueprint } from "./schema.js";
import {
  PopInputSchema,
  PopBlueprintSchema,
  POP_DEFAULTS,
  compileBlueprint,
} from "./schema.js";
import { createPopRenderers } from "./renderers.js";
import { POP_CRITICS } from "./critics.js";
import { POP_VALIDATORS } from "./validators.js";

export const popModule = createGenreModule<PopInputs, PopBlueprint>({
  id: "pop",
  name: "Pop",
  inputSchema: PopInputSchema,
  blueprintSchema: PopBlueprintSchema,
  defaults: POP_DEFAULTS,
  promptFragments: {
    planning:
      "Describe a {{subgenre}} Pop track arrangement: {{bpm}} BPM, {{key}} {{scale}}, {{mood}}, energy {{energy}}/10. Outline sections (intro, verse, pre-chorus, chorus, bridge, outro) with energy arc and production notes.\n{{nlAdjustments}}",
    style:
      'Suno AI style for {{subgenre}} Pop ({{bpm}}BPM, {{key}} {{scale}}, {{mood}}, energy {{energy}}/10).\n{{nlAdjustments}}\nReturn ONLY valid JSON:\n{"titleCandidates":["title1","title2"],"descriptiveStyle":"...","negativeTags":["..."],"bpm":128,"key":"C","vocalDescription":"..."}',
    lyrics_full:
      "Write lyrics for a {{subgenre}} Pop track. Include verse, chorus, bridge structure with a strong, memorable hook. Theme: {{theme}}.\n{{nlAdjustments}}",
    lyrics_hook:
      "Generate a short, catchy hook for a {{subgenre}} Pop track. Theme: {{theme}}.\n{{nlAdjustments}}",
    excluded:
      "List styles and elements to exclude when generating a {{subgenre}} Pop track.",
    style_tag_suggestions:
      "Suggest style tags for {{subgenre}} Pop ({{bpm}}BPM, {{key}} {{scale}}, {{mood}}, energy {{energy}}/10). Return 4 categories: genre (subgenre-specific), mood (mood keywords), inst (instruments/synths), prod (production techniques). 6-8 suggestions per category. Return as JSON with keys genre, mood, inst, prod, each an array of strings.",
  },
  compileBlueprint: compileBlueprint,
  renderers: createPopRenderers(),
  critics: POP_CRITICS,
  validators: POP_VALIDATORS,
});
