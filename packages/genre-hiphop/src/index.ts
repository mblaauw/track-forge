import type { GenreModule } from "@track-forge/genre-core";
import type { HipHopInputs, HipHopBlueprint } from "./schema.js";
import {
  HipHopInputSchema,
  HipHopBlueprintSchema,
  HIP_HOP_DEFAULTS,
  HIP_HOP_FORM_FIELDS,
} from "./schema.js";
import { HIP_HOP_PRESETS } from "./presets.js";
import { createHipHopRenderers } from "./renderers.js";
import { HIP_HOP_FAST_CRITIC, HIP_HOP_FULL_CRITICS, HIP_HOP_ORIGINALITY_CRITIC } from "./critics.js";
import { hipHopValidators } from "./validators.js";
import { HIP_HOP_TAG_CATEGORIES } from "./tag-categories.js";

// ── Adjustment vocabulary ─────────────────────────────────────────────

const hipHopAdjustmentVocabulary = {
  styleTerms: [
    "add distortion on 808",
    "reduce hi-hat velocity",
    "more snare rolls",
    "add vinyl crackle",
    "pitch down samples",
    "layer synth pads",
    "add reverb to vocals",
    "emphasize kick pattern",
    "more sub bass",
    "add orchestral elements",
    "filter sweep intro",
    "double-time hi-hats",
    "add call-and-response hook",
  ],
  structureTerms: [
    "extend verse by 4 bars",
    "shorten intro",
    "add bridge section",
    "increase hook repetition",
    "add breakdown",
    "reorder sections",
    "add ad-lib section",
    "include spoken word outro",
  ],
  deliveryTerms: [
    "more aggressive delivery",
    "smoother vocal tone",
    "add ad-libs",
    "increase vocal presence",
    "add backing vocals",
    "double tracked verses",
    "auto-tune effect",
    "breathy delivery",
    "staccato phrasing",
    "melodic hook style",
  ],
};

// ── Tag Policy ────────────────────────────────────────────────────────

const hipHopTagPolicy = {
  mandatoryTags: ["hip hop", "rap"],
  forbiddenTags: [],
  canonicalMap: {
    "hiphop": "hip hop",
    "hip-hop": "hip hop",
    "rap music": "rap",
    "gangsta": "gangsta rap",
    "trap music": "trap",
    "old school": "old school hip hop",
    "eastcoast": "east coast",
    "westcoast": "west coast",
  },
};

// ── Prompt Fragments ──────────────────────────────────────────────────

const hipHopPromptFragments: Record<string, string> = {
  planning: `You are a Hip-Hop producer planning a track.
Subgenre: {{subgenre}} | BPM: {{bpm}} | Key: {{key}} {{scale}}
Narrative: {{narrativeArc}} | Flow: {{flowPattern}}
Create a production plan including arrangement, instrumentation, and vocal approach.
{{nlAdjustments}}`,

  style_writing: `Write a Hip-Hop style description for Suno AI.
Subgenre: {{subgenre}} | BPM: {{bpm}} | Key: {{key}} {{scale}}
Narrative: {{narrativeArc}} | Production: {{productionStyle}}
Energy: {{energy}}/10 | Complexity: {{complexity}}/10
{{nlAdjustments}}
Produce a concise, Suno-compatible style prompt.

Return your answer as valid JSON matching this schema:
{
  "titleCandidates": ["suggested title 1", "suggested title 2"],
  "descriptiveStyle": "the style description text",
  "negativeTags": ["tag_to_avoid"],
  "bpm": 140,
  "key": "C",
  "vocalDescription": "vocal style notes"
}`,

  lyrics_writing: `Write Hip-Hop lyrics for {{subgenre}}.
Narrative: {{narrativeArc}} | Flow: {{flowPattern}} | Delivery: {{delivery}}
Energy: {{energy}}/10 | Complexity: {{complexity}}/10
Song structure: {{songStructure}}
Write {{lyricsMode}} lyrics following the structure.

Return your answer as valid JSON matching this schema:
{
  "document": {
    "bpm": 140,
    "key": "Am",
    "genre": "Hip-Hop",
    "sections": [
      { "type": "verse", "lines": ["line 1", "line 2"], "bars": 8, "tags": [], "instrumental": false }
    ],
    "metadata": {}
  }
}`,

  review: `Review the generated Hip-Hop track for quality and coherence.
Verify subgenre conventions, lyrical complexity, and production style.`,

  style_tag_suggestions: `Suggest style tags for {{subgenre}} Hip-Hop ({{bpm}}BPM, {{key}} {{scale}}, {{mood}}, {{narrativeArc}}, {{productionStyle}}). Return 4 categories: genre (subgenre-specific), mood (mood keywords), inst (instruments/samples), prod (production techniques). 6-8 suggestions per category. Return as JSON with keys genre, mood, inst, prod, each an array of strings.`,
};

// ── Module Assembly ───────────────────────────────────────────────────

const defaultRenderers = createHipHopRenderers();

export const hipHopModule: GenreModule<HipHopInputs, HipHopBlueprint> = {
  id: "hiphop",
  name: "Hip-Hop",

  // Schema
  inputSchema: HipHopInputSchema,
  blueprintSchema: HipHopBlueprintSchema,

  // Defaults & Form
  defaults: HIP_HOP_DEFAULTS,
  form: HIP_HOP_FORM_FIELDS,

  // Generation
  adjustmentVocabulary: hipHopAdjustmentVocabulary,
  tagPolicy: hipHopTagPolicy,
  presets: HIP_HOP_PRESETS,
  tagCategories: HIP_HOP_TAG_CATEGORIES,
  promptFragments: hipHopPromptFragments,
  compileBlueprint: (inputs: HipHopInputs, options?: { arrangementOverride?: { section: string; bars: number }[] }) => HipHopBlueprintSchema.parse({
    subgenre: inputs.subgenre,
    bpm: inputs.bpm,
    key: inputs.key,
    scale: inputs.scale,
    mood: inputs.mood,
    narrativeArc: inputs.narrativeArc,
    rhymeStyle: inputs.rhymeStyle,
    flowPattern: inputs.flowPattern,
    delivery: inputs.delivery,
    productionStyle: inputs.productionStyle,
    energy: inputs.energy,
    complexity: inputs.complexity,
    lyricsMode: inputs.lyricsMode,
    vocalStyle: "",
    tags: inputs.customTags ? inputs.customTags.split(",").map((t: string) => t.trim()).filter(Boolean) : [],
    negativeTags: inputs.lyricsMode === "instrumental" ? ["vocals", "singing"] : [],
    styleClauses: [
      { key: "genre", value: inputs.subgenre.replace(/_/g, " "), order: 0 },
      { key: "bpm", value: String(inputs.bpm), order: 1 },
      { key: "mood", value: inputs.mood, order: 2 },
    ],
    songStructure: ["intro", "verse", "hook", "verse", "hook", "bridge", "hook", "outro"],
  }),
  renderers: {
    title: (data: HipHopBlueprint) => defaultRenderers.title(data),
    style: (data: HipHopBlueprint) => defaultRenderers.style(data),
    excludedStyles: (data: HipHopBlueprint) => defaultRenderers.excludedStyles(data),
    lyrics: (data: HipHopBlueprint) => defaultRenderers.lyrics(data),
  },
  critics: {
    fast: HIP_HOP_FAST_CRITIC,
    full: [
      ...HIP_HOP_FULL_CRITICS,
      // Originality critic only included conditionally (check in pipeline)
      HIP_HOP_ORIGINALITY_CRITIC,
    ],
  },
  validators: hipHopValidators,
  migrations: [],
};

export default hipHopModule;

// ── Re-exports ────────────────────────────────────────────────────────

export type { HipHopInputs, HipHopBlueprint } from "./schema.js";
export { HipHopInputSchema, HipHopBlueprintSchema, HIP_HOP_DEFAULTS, HIP_HOP_FORM_FIELDS } from "./schema.js";
export { HIP_HOP_PRESETS } from "./presets.js";
export { createHipHopRenderers } from "./renderers.js";
export { HIP_HOP_FAST_CRITIC, HIP_HOP_FULL_CRITICS, HIP_HOP_ORIGINALITY_CRITIC } from "./critics.js";
export { hipHopValidators } from "./validators.js";
export { HIP_HOP_SUBGENRES, getSubgenre, getDefaultPreset, getSubgenreOptions } from "./taxonomy.js";
export type {
  HipHopSubgenreEntry,
  NarrativeArc,
  RhymeStyle,
  FlowPattern,
  Delivery,
  ProductionStyle,
} from "./taxonomy.js";
