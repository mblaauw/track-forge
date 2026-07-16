import { z } from "zod";
import {
  type SongStructureSection,
  type FormFieldDescriptor,
  resolveArrangement,
  buildStyleClauses,
  instrumentalNegativeTags,
} from "@track-forge/genre-core";

export const DnbInputSchema = z.object({
  subgenre: z.string().min(1, "Select a subgenre"),
  bpm: z.number().int().min(160).max(180),
  key: z.string(),
  scale: z.enum(["major", "minor"]),
  mood: z.string(),
  energy: z.number().int().min(1).max(10),
  complexity: z.number().int().min(1).max(10),
  lyricsMode: z.enum([
    "strict_instrumental",
    "guided_instrumental",
    "full_lyrics",
  ]),
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
  lyricsMode: z.enum([
    "strict_instrumental",
    "guided_instrumental",
    "full_lyrics",
  ]),
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

export const DNB_DEFAULT_SONG_STRUCTURE: SongStructureSection[] = [
  { section: "intro", bars: { base: 8, per_complexity: 0.3 }, tags: ["atmospheric", "filtered", "amen build"] },
  { section: "break", bars: { base: 8, per_complexity: 0.5 }, tags: ["stripped", "rolling hats", "sub"] },
  { section: "drop", bars: { base: 16, per_energy: 1.2 }, tags: ["full", "reese bass", "driving breaks"] },
  { section: "break", bars: { base: 8, per_complexity: 0.5 }, tags: ["stripped", "atmospheric", "pad swell"] },
  { section: "drop", bars: { base: 16, per_energy: 1.2 }, tags: ["full", "variation", "layered"] },
  { section: "outro", bars: { base: 8, per_complexity: 0.4 }, tags: ["filtered", "fading", "sub roll"] },
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
    { key: "genre", value: `Drum & Bass — ${inputs.subgenre.replace(/_/g, " ")}` },
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

export const DNB_FORM_FIELDS: FormFieldDescriptor[] = [
  {
    key: "subgenre",
    label: "Subgenre",
    type: "select",
    options: [],
  },
  {
    key: "bpm",
    label: "BPM",
    type: "number",
    constraints: { min: 160, max: 180 },
  },
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
