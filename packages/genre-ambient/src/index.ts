import type { GenreModule } from "@track-forge/genre-core";
import type { AmbientInputs, AmbientBlueprint } from "./schema.js";
import {
  AmbientInputSchema,
  AmbientBlueprintSchema,
  AMBIENT_DEFAULTS,
  compileBlueprint,
} from "./schema.js";
import { AMBIENT_FORM_FIELDS } from "./schema.js";
import { AMBIENT_PRESETS } from "./presets.js";
import { createAmbientRenderers } from "./renderers.js";
import { AMBIENT_CRITICS } from "./critics.js";
import { AMBIENT_VALIDATORS } from "./validators.js";
import { AMBIENT_TAG_CATEGORIES } from "./tag-categories.js";

export {
  AmbientInputSchema,
  AmbientBlueprintSchema,
  AMBIENT_DEFAULTS,
  compileBlueprint as ambientCompileBlueprint,
} from "./schema.js";
export type { AmbientInputs, AmbientBlueprint } from "./schema.js";
export { AMBIENT_PRESETS } from "./presets.js";
export { AMBIENT_CRITICS } from "./critics.js";
export { AMBIENT_VALIDATORS } from "./validators.js";
export { AMBIENT_TAG_CATEGORIES } from "./tag-categories.js";

export const ambientModule: GenreModule<AmbientInputs, AmbientBlueprint> = {
  id: "ambient",
  name: "Ambient",
  inputSchema: AmbientInputSchema,
  blueprintSchema: AmbientBlueprintSchema,
  defaults: AMBIENT_DEFAULTS,
  form: AMBIENT_FORM_FIELDS,
  adjustmentVocabulary: {
    styleTerms: [
      "ethereal",
      "spacious",
      "meditative",
      "dark",
      "warm",
      "evolving",
      "minimal",
      "textural",
      "floating",
      "hypnotic",
      "deep",
      "lush",
      "airy",
      "granular",
      "drone-like",
    ],
    structureTerms: [
      "slow emergence",
      "gradual swell",
      "extended drift",
      "long fade",
      "layered build",
      "textural shift",
      "sparse middle",
      "dissolving outro",
    ],
    deliveryTerms: [
      "gentle modulation",
      "slow filter sweeps",
      "wide stereo field",
      "subtle movement",
      "evolving texture",
      "delicate layering",
      "smooth transition",
    ],
  },
  tagPolicy: {
    mandatoryTags: ["ambient"],
    forbiddenTags: ["aggressive", "dance", "club", "rhythmic"],
    canonicalMap: {
      ambient: "ambient",
      drone: "ambient drone",
      atmospheric: "atmospheric",
      background: "ambient",
    },
  },
  presets: AMBIENT_PRESETS,
  tagCategories: AMBIENT_TAG_CATEGORIES,
  promptFragments: {
    planning:
      "Describe an ambient {{subgenre}} piece: {{bpm}} BPM, {{key}} {{scale}}, {{mood}}, {{soundscape}} soundscape, complexity {{complexity}}/10. Outline slow-evolving sections (emerge, swell, drift, fade) with textural notes and spatial production cues.\n{{nlAdjustments}}",
    style:
      'Suno AI style for ambient {{subgenre}} ({{bpm}}BPM, {{key}} {{scale}}, {{mood}}, {{soundscape}}).\n{{nlAdjustments}}\nReturn ONLY valid JSON:\n{"titleCandidates":["title1","title2"],"descriptiveStyle":"...","negativeTags":["..."],"bpm":65,"key":"C","vocalDescription":"instrumental"}',
    lyrics_instrumental:
      "Generate instrumental arrangement tags for an ambient {{subgenre}} piece with sections: emerge, swell, drift, fade.\n{{nlAdjustments}}",
    lyrics_full:
      "Write sparse, evocative lyrics for an ambient {{subgenre}} piece. Minimal words, atmospheric phrasing, space between lines.",
    excluded:
      "List styles and elements to exclude when generating an ambient {{subgenre}} piece.",
    style_tag_suggestions:
      "Suggest style tags for ambient {{subgenre}} ({{bpm}}BPM, {{key}} {{scale}}, {{mood}}, {{soundscape}}). Return 4 categories: genre (ambient subgenres), mood (mood keywords), inst (instruments/textures), prod (production techniques). 6-8 suggestions per category. Return as JSON with keys genre, mood, inst, prod, each an array of strings.",
  },
  compileBlueprint,
  renderers: createAmbientRenderers(),
  critics: AMBIENT_CRITICS,
  validators: AMBIENT_VALIDATORS,
  migrations: [],
};

export default ambientModule;
