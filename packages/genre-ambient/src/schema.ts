import { z } from "zod";
import {
  type ArrangementSection,
  type SongStructureSection,
  computeBars,
  type FormFieldDescriptor,
} from "@track-forge/genre-core";

export const AmbientInputSchema = z.object({
  subgenre: z.string().min(1, "Select a subgenre"),
  bpm: z.number().min(40).max(120),
  key: z.string(),
  scale: z.enum(["major", "minor"]),
  mood: z.string(),
  complexity: z.number().int().min(1).max(10),
  lyricsMode: z.enum([
    "strict_instrumental",
    "guided_instrumental",
    "full_lyrics",
  ]),
  soundscape: z.string(),
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

export const AmbientBlueprintSchema = z.object({
  subgenre: z.string(),
  bpm: z.number().int(),
  key: z.string(),
  scale: z.enum(["major", "minor"]),
  mood: z.string(),
  complexity: z.number().int().min(1).max(10),
  lyricsMode: z.enum([
    "strict_instrumental",
    "guided_instrumental",
    "full_lyrics",
  ]),
  soundscape: z.string(),
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

export type AmbientBlueprint = z.infer<typeof AmbientBlueprintSchema>;

export const AMBIENT_DEFAULT_SONG_STRUCTURE: SongStructureSection[] = [
  { section: "emerge", bars: { base: 12, per_complexity: 1.5 }, tags: ["spacious", "texture build", "slow entry"] },
  { section: "swell", bars: { base: 16, per_complexity: 2 }, tags: ["layered", "evolving", "deepening"] },
  { section: "drift", bars: { base: 16, per_complexity: 1.5 }, tags: ["floating", "wide", "textural"] },
  { section: "fade", bars: { base: 12, per_complexity: 1.5 }, tags: ["dissolving", "sparse", "receding"] },
];

export function compileBlueprint(
  inputs: AmbientInputs,
  options?: {
    arrangementOverride?: { section: string; bars: number; tags?: string[] }[];
    songStructure?: SongStructureSection[];
  },
): AmbientBlueprint {
  let arrangement: ArrangementSection[];
  if (options?.arrangementOverride) {
    arrangement = options.arrangementOverride.map((s) => ({
      section: s.section,
      bars: s.bars,
      tags: s.tags ?? [],
    }));
  } else {
    const template = options?.songStructure ?? AMBIENT_DEFAULT_SONG_STRUCTURE;
    arrangement = template.map((s) => ({
      section: s.section,
      bars: computeBars(s.bars, inputs),
      tags: s.tags,
    }));
  }
  const tags = ["ambient", inputs.soundscape];
  const negativeTags: string[] = [
    "aggressive",
    "rhythmic",
    "percussive",
    "driving",
    "beat-driven",
  ];
  if (inputs.lyricsMode !== "full_lyrics")
    negativeTags.push("vocals", "singing", "lyrics", "voice");

  const styleClauses = [
    { key: "genre", value: "ambient", order: 0 },
    { key: "subgenre", value: inputs.subgenre.replace(/_/g, " "), order: 1 },
    { key: "bpm", value: String(inputs.bpm), order: 2 },
    { key: "mood", value: inputs.mood, order: 3 },
    { key: "soundscape", value: inputs.soundscape, order: 4 },
    { key: "complexity", value: String(inputs.complexity), order: 5 },
  ];

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

export const AMBIENT_FORM_FIELDS: FormFieldDescriptor[] = [
  { key: "subgenre", label: "Subgenre", type: "text" },
  {
    key: "bpm",
    label: "BPM",
    type: "number",
    constraints: { min: 40, max: 120 },
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
      { label: "Strict Instrumental", value: "strict_instrumental" },
      { label: "Guided Instrumental", value: "guided_instrumental" },
      { label: "Full Lyrics", value: "full_lyrics" },
    ],
  },
  { key: "soundscape", label: "Soundscape", type: "text" },
];
