import { createGenreModule } from "@track-forge/genre-core";
import type { DnbInputs, DnbBlueprint } from "./schema.js";
import {
  DnbInputSchema,
  DnbBlueprintSchema,
  DNB_DEFAULTS,
  compileBlueprint,
} from "./schema.js";
import { createDnbRenderers } from "./renderers.js";
import { DNB_CRITICS } from "./critics.js";
import { DNB_VALIDATORS } from "./validators.js";

export const dnbModule = createGenreModule<DnbInputs, DnbBlueprint>({
  id: "dnb",
  name: "Drum & Bass",
  inputSchema: DnbInputSchema,
  blueprintSchema: DnbBlueprintSchema,
  defaults: DNB_DEFAULTS,
  promptFragments: {
    planning:
      "Describe a Drum & Bass track arrangement: {{subgenre}}, {{bpm}} BPM, {{key}} {{scale}}, {{mood}}, energy {{energy}}/10. Outline sections (intro, break, drop, outro) with energy arc and bass production notes.\n{{nlAdjustments}}",
    style:
      'Suno AI style for Drum & Bass — {{subgenre}} ({{bpm}}BPM, {{key}} {{scale}}, {{mood}}, energy {{energy}}/10).\n{{nlAdjustments}}\nReturn ONLY valid JSON:\n{"titleCandidates":["title1","title2"],"descriptiveStyle":"...","negativeTags":["..."],"bpm":174,"key":"Am","vocalDescription":"..."}',
    lyrics_instrumental:
      "Generate instrumental arrangement tags for a Drum & Bass track with sections: intro, break, drop, outro.\n{{nlAdjustments}}",
    lyrics_full:
      "Write lyrics for a Drum & Bass track. Include intro, verse, chorus, bridge structure fitting 174 BPM double-time feel.",
    excluded:
      "List styles and elements to exclude when generating a Drum & Bass track.",
    style_tag_suggestions:
      "Suggest style tags for Drum & Bass — {{subgenre}} ({{bpm}}BPM, {{key}} {{scale}}, {{mood}}, energy {{energy}}/10). Return 4 categories: genre (subgenre-specific), mood (mood keywords), inst (instruments/synths), prod (production techniques). 6-8 suggestions per category. Return as JSON with keys genre, mood, inst, prod, each an array of strings.",
  },
  compileBlueprint: compileBlueprint,
  renderers: createDnbRenderers(),
  critics: DNB_CRITICS,
  validators: DNB_VALIDATORS,
});
