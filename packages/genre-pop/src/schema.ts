import { z } from "zod";
import {
  type SongStructureSection,
  resolveArrangement,
  buildStyleClauses,
  instrumentalNegativeTags,
} from "@track-forge/genre-core";

export const PopInputSchema = z.object({
  subgenre: z.string(),
  bpm: z.number().int().min(60).max(180),
  key: z.string(),
  scale: z.enum(["major", "minor"]),
  mood: z.string(),
  energy: z.number().int().min(1).max(10),
  complexity: z.number().int().min(1).max(10),
  lyricsMode: z.enum(["full_lyrics", "hook", "instrumental"]),
  theme: z.string(),
  reference: z.string().optional(),
});

export type PopInputs = z.infer<typeof PopInputSchema>;

export const PopBlueprintSchema = z.object({
  subgenre: z.string(),
  bpm: z.number(),
  key: z.string(),
  scale: z.enum(["major", "minor"]),
  mood: z.string(),
  energy: z.number().int().min(1).max(10),
  complexity: z.number().int().min(1).max(10),
  lyricsMode: z.enum(["full_lyrics", "hook", "instrumental"]),
  arrangement: z.array(
    z.object({
      section: z.string(),
      bars: z.number().int().positive(),
      tags: z.array(z.string()),
    }),
  ),
  styleClauses: z.array(
    z.object({
      key: z.string(),
      value: z.string(),
      order: z.number().int(),
    }),
  ),
  tags: z.array(z.string()),
  negativeTags: z.array(z.string()),
});

export type PopBlueprint = z.infer<typeof PopBlueprintSchema>;

export const POP_DEFAULTS: PopInputs = {
  subgenre: "pop",
  bpm: 120,
  key: "C",
  scale: "major",
  mood: "upbeat",
  energy: 6,
  complexity: 5,
  lyricsMode: "full_lyrics",
  theme: "love",
  reference: undefined,
};

export const POP_DEFAULT_SONG_STRUCTURE: SongStructureSection[] = [
  {
    section: "intro",
    bars: { base: 8, per_complexity: 0.5 },
    tags: ["instrumental", "pads"],
  },
  {
    section: "verse",
    bars: { base: 8, per_complexity: 0.5 },
    tags: ["stripped", "vocals"],
  },
  { section: "pre_chorus", bars: 8, tags: ["building", "layered"] },
  {
    section: "chorus",
    bars: { base: 16, per_energy: 0.8 },
    tags: ["full", "hook", "energetic"],
  },
  { section: "bridge", bars: 8, tags: ["stripped", "introspective"] },
  {
    section: "outro",
    bars: { base: 8, per_complexity: 0.5 },
    tags: ["fading", "reverb"],
  },
];

export function compileBlueprint(
  inputs: PopInputs,
  options?: {
    arrangementOverride?: { section: string; bars: number; tags?: string[] }[];
    songStructure?: SongStructureSection[];
  },
): PopBlueprint {
  const arrangement = resolveArrangement({
    arrangementOverride: options?.arrangementOverride,
    songStructure: options?.songStructure,
    inputs,
    defaultStructure: POP_DEFAULT_SONG_STRUCTURE,
  });
  const tags: string[] = [inputs.subgenre, "pop"];
  const negativeTags = instrumentalNegativeTags(inputs.lyricsMode);

  const styleClauses = buildStyleClauses([
    { key: "genre", value: inputs.subgenre },
    { key: "bpm", value: String(inputs.bpm) },
    { key: "key", value: inputs.key },
    { key: "scale", value: inputs.scale },
    { key: "mood", value: inputs.mood },
    { key: "energy", value: String(inputs.energy) },
    { key: "complexity", value: String(inputs.complexity) },
    { key: "theme", value: inputs.theme },
  ]);

  return PopBlueprintSchema.parse({
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
