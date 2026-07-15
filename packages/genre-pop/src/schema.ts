import { z } from "zod";
import {
  type ArrangementSection,
  type SongStructureSection,
  computeBars,
  type FormFieldDescriptor,
} from "@track-forge/genre-core";

export const PopInputSchema = z.object({
  subgenre: z.string(),
  bpm: z.number().min(60).max(180),
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
  { section: "intro", bars: { base: 8, per_complexity: 0.5 }, tags: ["instrumental", "pads"] },
  { section: "verse", bars: { base: 8, per_complexity: 0.5 }, tags: ["stripped", "vocals"] },
  { section: "pre_chorus", bars: 8, tags: ["building", "layered"] },
  { section: "chorus", bars: { base: 16, per_energy: 0.8 }, tags: ["full", "hook", "energetic"] },
  { section: "bridge", bars: 8, tags: ["stripped", "introspective"] },
  { section: "outro", bars: { base: 8, per_complexity: 0.5 }, tags: ["fading", "reverb"] },
];

export function compileBlueprint(
  inputs: PopInputs,
  options?: {
    arrangementOverride?: { section: string; bars: number; tags?: string[] }[];
    songStructure?: SongStructureSection[];
  },
): PopBlueprint {
  let arrangement: ArrangementSection[];
  if (options?.arrangementOverride) {
    arrangement = options.arrangementOverride.map((s) => ({
      section: s.section,
      bars: s.bars,
      tags: s.tags ?? [],
    }));
  } else {
    const template = options?.songStructure ?? POP_DEFAULT_SONG_STRUCTURE;
    arrangement = template.map((s) => ({
      section: s.section,
      bars: computeBars(s.bars, inputs),
      tags: s.tags,
    }));
  }
  const tags: string[] = [inputs.subgenre, "pop"];
  const negativeTags: string[] = [];
  if (inputs.lyricsMode === "instrumental")
    negativeTags.push("vocals", "singing", "lyrics", "voice");

  const styleClauses = [
    { key: "genre", value: inputs.subgenre, order: 0 },
    { key: "bpm", value: String(inputs.bpm), order: 1 },
    { key: "key", value: inputs.key, order: 2 },
    { key: "scale", value: inputs.scale, order: 3 },
    { key: "mood", value: inputs.mood, order: 4 },
    { key: "energy", value: String(inputs.energy), order: 5 },
    { key: "complexity", value: String(inputs.complexity), order: 6 },
    { key: "theme", value: inputs.theme, order: 7 },
  ];

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

export const POP_FORM_FIELDS: FormFieldDescriptor[] = [
  { key: "subgenre", label: "Subgenre", type: "text" },
  {
    key: "bpm",
    label: "BPM",
    type: "number",
    constraints: { min: 60, max: 180 },
  },
  { key: "key", label: "Key", type: "text" },
  {
    key: "scale",
    label: "Scale",
    type: "select",
    options: [
      { label: "Major", value: "major" },
      { label: "Minor", value: "minor" },
    ],
  },
  { key: "mood", label: "Mood", type: "text" },
  {
    key: "energy",
    label: "Energy",
    type: "number",
    constraints: { min: 1, max: 10 },
  },
  {
    key: "complexity",
    label: "Complexity",
    type: "number",
    constraints: { min: 1, max: 10 },
  },
  {
    key: "lyricsMode",
    label: "Lyrics Mode",
    type: "select",
    options: [
      { label: "Full Lyrics", value: "full_lyrics" },
      { label: "Hook Only", value: "hook" },
      { label: "Instrumental", value: "instrumental" },
    ],
  },
  { key: "theme", label: "Theme", type: "text" },
  { key: "reference", label: "Reference Tracks", type: "text" },
];
