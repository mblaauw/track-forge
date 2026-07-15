import { z } from "zod";
import { EdmFamily } from "./taxonomy.js";

// ── Input schema — user-facing form fields ────────────────────────────

export const EdmInputSchema = z.object({
  /** Genre family */
  family: z.enum(EdmFamily),
  /** Subgenre key (validated against taxonomy at runtime) */
  subgenre: z.string().min(1, "Select a subgenre"),
  /** Tempo in BPM */
  bpm: z.number().int().min(60).max(220),
  /** Musical key */
  key: z.string(),
  /** Scale mode */
  scale: z.enum(["major", "minor"]),
  /** Mood / vibe description */
  mood: z.string(),
  /** Energy level 1-10 */
  energy: z.number().int().min(1).max(10),
  /** Complexity level 1-10 */
  complexity: z.number().int().min(1).max(10),
  /** Lyrics mode */
  lyricsMode: z.enum([
    "guided_instrumental",
    "strict_instrumental",
    "full_lyrics",
  ]),
  /** Custom tags to include */
  customTags: z.array(z.string()),
  /** Reference tracks or materials */
  reference: z.string().optional(),
});

export type EdmInputs = z.infer<typeof EdmInputSchema>;

// ── Defaults ──────────────────────────────────────────────────────────

export const EDM_DEFAULTS: EdmInputs = {
  family: "house",
  subgenre: "deep_house",
  bpm: 120,
  key: "auto",
  scale: "minor",
  mood: "energetic",
  energy: 7,
  complexity: 5,
  lyricsMode: "guided_instrumental",
  customTags: [],
  reference: undefined,
};

// ── Blueprint schema — internal generation model ──────────────────────

export const EdmBlueprintSchema = z.object({
  /** Subgenre identifier */
  subgenre: z.string(),
  /** Resolved BPM */
  bpm: z.number().int(),
  /** Musical key */
  key: z.string(),
  /** Scale mode */
  scale: z.enum(["major", "minor"]),
  /** Descriptive mood */
  mood: z.string(),
  /** Energy (1-10) */
  energy: z.number().int().min(1).max(10),
  /** Complexity (1-10) */
  complexity: z.number().int().min(1).max(10),
  /** Lyrics mode (subsumes vocal treatment) */
  lyricsMode: z.enum([
    "guided_instrumental",
    "strict_instrumental",
    "full_lyrics",
  ]),
  /** Ordered arrangement sections */
  arrangement: z.array(
    z.object({
      section: z.string(),
      bars: z.number().int().positive(),
      tags: z.array(z.string()),
    }),
  ),
  /** Style description clauses (compiler input) */
  styleClauses: z.array(
    z.object({
      key: z.string(),
      value: z.string(),
      order: z.number().int(),
    }),
  ),
  /** Tags for Suno style field */
  tags: z.array(z.string()),
  /** Negative tags */
  negativeTags: z.array(z.string()),
});

export type EdmBlueprint = z.infer<typeof EdmBlueprintSchema>;

// ── Default arrangement builder ───────────────────────────────────────

export interface ArrangementSection {
  section: string;
  bars: number;
  tags: string[];
}

/** Compile user inputs into full blueprint shape */
export function compileBlueprint(
  inputs: EdmInputs,
  options?: {
    arrangementOverride?: { section: string; bars: number; tags?: string[] }[];
  },
): EdmBlueprint {
  const arrangement =
    options?.arrangementOverride ??
    buildDefaultArrangement(inputs.energy, inputs.complexity);
  const tags = [...inputs.customTags, "electronic"];
  const negativeTags: string[] = [];
  if (inputs.lyricsMode !== "full_lyrics")
    negativeTags.push("vocals", "singing", "lyrics", "voice");

  const styleClauses = [
    { key: "genre", value: inputs.subgenre.replace(/_/g, " "), order: 0 },
    { key: "bpm", value: String(inputs.bpm), order: 1 },
    { key: "mood", value: inputs.mood, order: 2 },
    { key: "energy", value: String(inputs.energy), order: 3 },
    { key: "complexity", value: String(inputs.complexity), order: 4 },
  ];

  return EdmBlueprintSchema.parse({
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

/** Build standard EDM arrangement based on subgenre characteristics */
export function buildDefaultArrangement(
  energy: number,
  complexity: number,
): ArrangementSection[] {
  const baseBars = 8 + Math.round(complexity * 0.5);
  const dropBars = 16 + Math.round(energy * 1.2);
  const breakdownBars = 8 + Math.round(complexity * 0.8);

  return [
    { section: "intro", bars: baseBars, tags: ["filtered", "atmospheric"] },
    {
      section: "build",
      bars: 8,
      tags: ["layered", "rising", "percussion build"],
    },
    { section: "drop", bars: dropBars, tags: ["full", "driving"] },
    {
      section: "breakdown",
      bars: breakdownBars,
      tags: ["stripped", "atmospheric"],
    },
    { section: "build_2", bars: 8, tags: ["layered", "rising", "tension"] },
    { section: "drop_2", bars: dropBars, tags: ["full", "variation"] },
    { section: "bridge", bars: 8, tags: ["transition"] },
    { section: "outro", bars: baseBars, tags: ["filtered", "fading"] },
  ];
}

// ── Form field descriptors ────────────────────────────────────────────

import type { FormFieldDescriptor } from "@track-forge/genre-core";

export const EDM_FORM_FIELDS: FormFieldDescriptor[] = [
  {
    key: "family",
    label: "Family",
    type: "select",
    options: [], // populated dynamically from taxonomy
  },
  {
    key: "subgenre",
    label: "Subgenre",
    type: "select",
    options: [], // populated dynamically based on family
  },
  {
    key: "bpm",
    label: "BPM",
    type: "number",
    constraints: { min: 60, max: 220 },
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
  { key: "customTags", label: "Custom Tags", type: "text" },
  { key: "reference", label: "Reference Tracks", type: "text" },
];
