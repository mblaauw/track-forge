import { z } from "zod";
import type { FormFieldDescriptor } from "@track-forge/genre-core";

export const DnbInputSchema = z.object({
  subgenre: z.string().min(1, "Select a subgenre"),
  bpm: z.number().int().min(160).max(180),
  key: z.string(),
  scale: z.enum(["major", "minor"]),
  mood: z.string(),
  energy: z.number().int().min(1).max(10),
  complexity: z.number().int().min(1).max(10),
  lyricsMode: z.enum(["strict_instrumental", "guided_instrumental", "full_lyrics"]),
  reference: z.string().optional(),
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

export const DnbBlueprintSchema = z.object({
  subgenre: z.string(),
  bpm: z.number().int(),
  key: z.string(),
  scale: z.enum(["major", "minor"]),
  mood: z.string(),
  energy: z.number().int().min(1).max(10),
  complexity: z.number().int().min(1).max(10),
  lyricsMode: z.enum(["strict_instrumental", "guided_instrumental", "full_lyrics"]),
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

export type DnbBlueprint = z.infer<typeof DnbBlueprintSchema>;

export interface ArrangementSection {
  section: string;
  bars: number;
  tags: string[];
}

export function compileBlueprint(
  inputs: DnbInputs,
  options?: { arrangementOverride?: { section: string; bars: number; tags?: string[] }[] },
): DnbBlueprint {
  const arrangement = options?.arrangementOverride ?? buildDefaultArrangement(inputs.energy, inputs.complexity);
  const tags = [inputs.subgenre.replace(/_/g, " "), "drum & bass", "electronic"];
  const negativeTags: string[] = [];
  if (inputs.lyricsMode !== "full_lyrics") negativeTags.push("vocals", "singing", "lyrics", "voice");

  const styleClauses = [
    { key: "genre", value: `Drum & Bass — ${inputs.subgenre.replace(/_/g, " ")}`, order: 0 },
    { key: "bpm", value: String(inputs.bpm), order: 1 },
    { key: "key", value: inputs.key, order: 2 },
    { key: "scale", value: inputs.scale, order: 3 },
    { key: "mood", value: inputs.mood, order: 4 },
    { key: "energy", value: String(inputs.energy), order: 5 },
    { key: "complexity", value: String(inputs.complexity), order: 6 },
  ];

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

export function buildDefaultArrangement(
  energy: number,
  complexity: number,
): ArrangementSection[] {
  const introBars = 8 + Math.round(complexity * 0.3);
  const breakBars = 8 + Math.round(complexity * 0.5);
  const dropBars = 16 + Math.round(energy * 1.2);
  const outroBars = 8 + Math.round(complexity * 0.4);

  return [
    { section: "intro", bars: introBars, tags: ["atmospheric", "filtered", "amen build"] },
    { section: "break", bars: breakBars, tags: ["stripped", "rolling hats", "sub"] },
    { section: "drop", bars: dropBars, tags: ["full", "reese bass", "driving breaks"] },
    { section: "break", bars: breakBars, tags: ["stripped", "atmospheric", "pad swell"] },
    { section: "drop", bars: dropBars, tags: ["full", "variation", "layered"] },
    { section: "outro", bars: outroBars, tags: ["filtered", "fading", "sub roll"] },
  ];
}

export const DNB_FORM_FIELDS: FormFieldDescriptor[] = [
  {
    key: "subgenre",
    label: "Subgenre",
    type: "select",
    options: [],
  },
  { key: "bpm", label: "BPM", type: "number", constraints: { min: 160, max: 180 } },
  { key: "key", label: "Key", type: "text" },
  {
    key: "scale",
    label: "Scale",
    type: "select",
    options: [
      { label: "Minor", value: "minor" },
      { label: "Major", value: "major" },
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
      { label: "Guided Instrumental", value: "guided_instrumental" },
      { label: "Strict Instrumental", value: "strict_instrumental" },
      { label: "Full Lyrics", value: "full_lyrics" },
    ],
  },
  { key: "reference", label: "Reference Tracks", type: "text" },
];
