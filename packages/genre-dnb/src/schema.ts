import { z } from "zod";
import {
  type SongStructureSection,
  resolveArrangement,
  buildStyleClauses,
  instrumentalNegativeTags,
  createBaseInputSchema,
  createBaseBlueprintSchema,
} from "@track-forge/genre-core";

export const DnbInputSchema = createBaseInputSchema({
  bpmMin: 160,
  bpmMax: 180,
  extra: {
    subgenre: z.string().min(1, "Select a subgenre"),
    energy: z.number().int().min(1).max(10),
    reference: z.string().optional(),
  },
});

export type DnbInputs = z.infer<typeof DnbInputSchema>;

export const DNB_DEFAULTS: DnbInputs = {
  subgenre: "liquid_funk",
  bpm: 174,
  key: "A",
  scale: "minor",
  mood: "energetic",
  energy: 7,
  complexity: 6,
  lyricsMode: "full_lyrics",
  reference: undefined,
};

export const DnbBlueprintSchema = createBaseBlueprintSchema({
  extra: {
    subgenre: z.string(),
    energy: z.number().int().min(1).max(10),
  },
});

export type DnbBlueprint = z.infer<typeof DnbBlueprintSchema>;

export const DNB_DEFAULT_SONG_STRUCTURE: SongStructureSection[] = [
  {
    section: "intro",
    bars: { base: 8, per_complexity: 0.3 },
    tags: ["atmospheric", "filtered", "amen build"],
  },
  {
    section: "break",
    bars: { base: 8, per_complexity: 0.5 },
    tags: ["stripped", "rolling hats", "sub"],
  },
  {
    section: "drop",
    bars: { base: 16, per_energy: 1.2 },
    tags: ["full", "reese bass", "driving breaks"],
  },
  {
    section: "break",
    bars: { base: 8, per_complexity: 0.5 },
    tags: ["stripped", "atmospheric", "pad swell"],
  },
  {
    section: "drop",
    bars: { base: 16, per_energy: 1.2 },
    tags: ["full", "variation", "layered"],
  },
  {
    section: "outro",
    bars: { base: 8, per_complexity: 0.4 },
    tags: ["filtered", "fading", "sub roll"],
  },
];

export function compileBlueprint(
  inputs: DnbInputs,
  options?: {
    arrangementOverride?: { section: string; bars: number; tags?: string[] }[];
    songStructure?: SongStructureSection[];
  },
): DnbBlueprint {
  const arrangement = resolveArrangement({
    arrangementOverride: options?.arrangementOverride,
    songStructure: options?.songStructure,
    inputs,
    defaultStructure: DNB_DEFAULT_SONG_STRUCTURE,
  });
  const tags = [
    inputs.subgenre.replace(/_/g, " "),
    "drum & bass",
    "electronic",
  ];
  const negativeTags = instrumentalNegativeTags(inputs.lyricsMode);

  const styleClauses = buildStyleClauses([
    {
      key: "genre",
      value: `Drum & Bass — ${inputs.subgenre.replace(/_/g, " ")}`,
    },
    { key: "bpm", value: String(inputs.bpm) },
    { key: "key", value: inputs.key },
    { key: "scale", value: inputs.scale },
    { key: "mood", value: inputs.mood },
    { key: "energy", value: String(inputs.energy) },
    { key: "complexity", value: String(inputs.complexity) },
  ]);

  return DnbBlueprintSchema.parse({
    subgenre: inputs.subgenre,
    bpm: inputs.bpm,
    key: inputs.key,
    scale: inputs.scale,
    mood: inputs.mood,
    energy: inputs.energy,
    complexity: inputs.complexity,
    lyricsMode: inputs.lyricsMode,
    arrangement,
    styleClauses,
    tags,
    negativeTags,
  });
}
