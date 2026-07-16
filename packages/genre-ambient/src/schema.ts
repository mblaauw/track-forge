import { z } from "zod";
import {
  type SongStructureSection,
  resolveArrangement,
  buildStyleClauses,
  instrumentalNegativeTags,
  createBaseInputSchema,
  createBaseBlueprintSchema,
} from "@track-forge/genre-core";

export const AmbientInputSchema = createBaseInputSchema({
  bpmMin: 40,
  bpmMax: 120,
  extra: {
    subgenre: z.string().min(1, "Select a subgenre"),
    soundscape: z.string(),
  },
});

export type AmbientInputs = z.infer<typeof AmbientInputSchema>;

export const AMBIENT_DEFAULTS: AmbientInputs = {
  subgenre: "ambient_drone",
  bpm: 65,
  key: "C",
  scale: "major",
  mood: "ethereal",
  complexity: 5,
  lyricsMode: "strict_instrumental",
  soundscape: "ethereal",
};

export const AmbientBlueprintSchema = createBaseBlueprintSchema({
  extra: {
    subgenre: z.string(),
    soundscape: z.string(),
  },
});

export type AmbientBlueprint = z.infer<typeof AmbientBlueprintSchema>;

export const AMBIENT_DEFAULT_SONG_STRUCTURE: SongStructureSection[] = [
  {
    section: "emerge",
    bars: { base: 12, per_complexity: 1.5 },
    tags: ["spacious", "texture build", "slow entry"],
  },
  {
    section: "swell",
    bars: { base: 16, per_complexity: 2 },
    tags: ["layered", "evolving", "deepening"],
  },
  {
    section: "drift",
    bars: { base: 16, per_complexity: 1.5 },
    tags: ["floating", "wide", "textural"],
  },
  {
    section: "fade",
    bars: { base: 12, per_complexity: 1.5 },
    tags: ["dissolving", "sparse", "receding"],
  },
];

export function compileBlueprint(
  inputs: AmbientInputs,
  options?: {
    arrangementOverride?: { section: string; bars: number; tags?: string[] }[];
    songStructure?: SongStructureSection[];
  },
): AmbientBlueprint {
  const arrangement = resolveArrangement({
    arrangementOverride: options?.arrangementOverride,
    songStructure: options?.songStructure,
    inputs,
    defaultStructure: AMBIENT_DEFAULT_SONG_STRUCTURE,
  });
  const tags = ["ambient", inputs.soundscape];
  const negativeTags = [
    ...instrumentalNegativeTags(inputs.lyricsMode),
    "aggressive",
    "rhythmic",
    "percussive",
    "driving",
    "beat-driven",
  ];

  const styleClauses = buildStyleClauses([
    { key: "genre", value: "ambient" },
    { key: "subgenre", value: inputs.subgenre.replace(/_/g, " ") },
    { key: "bpm", value: String(inputs.bpm) },
    { key: "mood", value: inputs.mood },
    { key: "soundscape", value: inputs.soundscape },
    { key: "complexity", value: String(inputs.complexity) },
  ]);

  return AmbientBlueprintSchema.parse({
    subgenre: inputs.subgenre,
    bpm: inputs.bpm,
    key: inputs.key,
    scale: inputs.scale,
    mood: inputs.mood,
    complexity: inputs.complexity,
    lyricsMode: inputs.lyricsMode,
    soundscape: inputs.soundscape,
    arrangement,
    styleClauses,
    tags,
    negativeTags,
  });
}
