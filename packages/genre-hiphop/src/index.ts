import {
  type SongStructureSection,
  type ArrangementSection,
  resolveArrangement,
  buildStyleClauses,
  instrumentalNegativeTags,
  createGenreModule,
} from "@track-forge/genre-core";
import type { HipHopInputs, HipHopBlueprint } from "./schema.js";
import {
  HipHopInputSchema,
  HipHopBlueprintSchema,
  HIP_HOP_DEFAULTS,
} from "./schema.js";
import { createHipHopRenderers } from "./renderers.js";
import {
  HIP_HOP_FAST_CRITIC,
  HIP_HOP_FULL_CRITICS,
  HIP_HOP_ORIGINALITY_CRITIC,
} from "./critics.js";
import { hipHopValidators } from "./validators.js";
import { getSubgenreEntryOrFallback } from "./taxonomy.js";

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

export const HIP_HOP_DEFAULT_SONG_STRUCTURE: SongStructureSection[] = [
  { section: "intro", bars: 8, tags: [] },
  { section: "verse", bars: 16, tags: [] },
  { section: "hook", bars: 8, tags: [] },
  { section: "verse", bars: 16, tags: [] },
  { section: "hook", bars: 8, tags: [] },
  { section: "bridge", bars: 8, tags: [] },
  { section: "hook", bars: 8, tags: [] },
  { section: "outro", bars: 8, tags: [] },
];

export const hipHopModule = createGenreModule<HipHopInputs, HipHopBlueprint>({
  id: "hiphop",
  name: "Hip-Hop",
  inputSchema: HipHopInputSchema,
  blueprintSchema: HipHopBlueprintSchema,
  defaults: HIP_HOP_DEFAULTS,
  promptFragments: hipHopPromptFragments,
  compileBlueprint: (
    inputs: HipHopInputs,
    options?: {
      arrangementOverride?: ArrangementSection[];
      songStructure?: SongStructureSection[];
    },
  ) => {
    const arrangement = resolveArrangement({
      arrangementOverride: options?.arrangementOverride,
      songStructure: options?.songStructure,
      inputs,
      defaultStructure: HIP_HOP_DEFAULT_SONG_STRUCTURE,
    });
    const customTags = inputs.customTags
      ? inputs.customTags
          .split(",")
          .map((t: string) => t.trim())
          .filter(Boolean)
      : [];
    return HipHopBlueprintSchema.parse({
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
      vocalStyle: getSubgenreEntryOrFallback(inputs.subgenre).vocalStyle,
      tags: customTags,
      negativeTags: instrumentalNegativeTags(
        inputs.lyricsMode ?? "full_lyrics",
      ),
      styleClauses: buildStyleClauses([
        { key: "genre", value: inputs.subgenre.replace(/_/g, " ") },
        { key: "bpm", value: String(inputs.bpm) },
        { key: "mood", value: inputs.mood ?? "" },
      ]),
      arrangement,
    });
  },
  renderers: defaultRenderers,
  critics: {
    fast: HIP_HOP_FAST_CRITIC,
    full: [
      ...HIP_HOP_FULL_CRITICS,
      // Originality critic only included conditionally (check in pipeline)
      HIP_HOP_ORIGINALITY_CRITIC,
    ],
  },
  validators: hipHopValidators,
});
