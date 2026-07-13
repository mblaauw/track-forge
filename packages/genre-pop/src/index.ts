import type { GenreModule } from "@track-forge/genre-core";
import type { PopInputs, PopBlueprint } from "./schema.js";
import {
  PopInputSchema,
  PopBlueprintSchema,
  POP_DEFAULTS,
  compileBlueprint,
  POP_FORM_FIELDS,
} from "./schema.js";
import { POP_PRESETS } from "./presets.js";
import { POP_TAG_CATEGORIES } from "./tag-categories.js";
import { createPopRenderers } from "./renderers.js";
import { POP_CRITICS } from "./critics.js";
import { POP_VALIDATORS } from "./validators.js";

export const popModule: GenreModule<PopInputs, PopBlueprint> = {
  id: "pop",
  name: "Pop",
  inputSchema: PopInputSchema,
  blueprintSchema: PopBlueprintSchema,
  defaults: POP_DEFAULTS,
  form: POP_FORM_FIELDS,
  adjustmentVocabulary: {
    styleTerms: [
      "catchy",
      "polished",
      "bright",
      "dreamy",
      "upbeat",
      "emotional",
      "sweet",
      "hazy",
      "layered",
      "anthemic",
    ],
    structureTerms: [
      "extended intro",
      "double chorus",
      "early hook",
      "tag ending",
      "key change",
      "instrumental bridge",
      "acoustic break",
    ],
    deliveryTerms: [
      "tight harmonies",
      "breathy vocals",
      "belted chorus",
      "spoken word",
      "falsetto",
      "layered harmonies",
      "ad-libs",
    ],
  },
  tagPolicy: {
    mandatoryTags: ["pop"],
    forbiddenTags: ["death metal", "grunge", "noise"],
    canonicalMap: {
      "pop music": "pop",
      "pop song": "pop",
    },
  },
  presets: POP_PRESETS,
  tagCategories: POP_TAG_CATEGORIES,
  promptFragments: {
    planning:
      "Describe a {{subgenre}} Pop track arrangement: {{bpm}} BPM, {{key}} {{scale}}, {{mood}}, energy {{energy}}/10. Outline sections (intro, verse, pre-chorus, chorus, bridge, outro) with energy arc and production notes.\n{{nlAdjustments}}",
    style:
      "Suno AI style for {{subgenre}} Pop ({{bpm}}BPM, {{key}} {{scale}}, {{mood}}, energy {{energy}}/10).\n{{nlAdjustments}}\nReturn ONLY valid JSON:\n{\"titleCandidates\":[\"title1\",\"title2\"],\"descriptiveStyle\":\"...\",\"negativeTags\":[\"...\"],\"bpm\":128,\"key\":\"C\",\"vocalDescription\":\"...\"}",
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
  migrations: [],
};

export default popModule;

export { PopInputSchema, PopBlueprintSchema, POP_DEFAULTS, compileBlueprint as popCompileBlueprint } from "./schema.js";
export type { PopInputs, PopBlueprint } from "./schema.js";
export { POP_PRESETS } from "./presets.js";
export { POP_TAG_CATEGORIES } from "./tag-categories.js";
export { POP_CRITICS } from "./critics.js";
export { POP_VALIDATORS } from "./validators.js";
