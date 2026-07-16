import { z } from "zod";
import { EdmFamily } from "./taxonomy.js";
import {
  type SongStructureSection,
  resolveArrangement,
  buildStyleClauses,
  instrumentalNegativeTags,
} from "@track-forge/genre-core";

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

/** EDM song structure fallback used when no YAML config is loaded */
export const EDM_DEFAULT_SONG_STRUCTURE: SongStructureSection[] = [
  {
    section: "intro",
    bars: { base: 8, per_complexity: 0.5 },
    tags: ["filtered", "atmospheric"],
  },
  {
    section: "build",
    bars: 8,
    tags: ["layered", "rising", "percussion build"],
  },
  {
    section: "drop",
    bars: { base: 16, per_energy: 1.2 },
    tags: ["full", "driving"],
  },
  {
    section: "breakdown",
    bars: { base: 8, per_complexity: 0.8 },
    tags: ["stripped", "atmospheric"],
  },
  { section: "build_2", bars: 8, tags: ["layered", "rising", "tension"] },
  {
    section: "drop_2",
    bars: { base: 16, per_energy: 1.2 },
    tags: ["full", "variation"],
  },
  { section: "bridge", bars: 8, tags: ["transition"] },
  {
    section: "outro",
    bars: { base: 8, per_complexity: 0.5 },
    tags: ["filtered", "fading"],
  },
];

/** Compile user inputs into full blueprint shape */
export function compileBlueprint(
  inputs: EdmInputs,
  options?: {
    arrangementOverride?: { section: string; bars: number; tags?: string[] }[];
    songStructure?: SongStructureSection[];
  },
): EdmBlueprint {
  const arrangement = resolveArrangement({
    arrangementOverride: options?.arrangementOverride,
    songStructure: options?.songStructure,
    inputs,
    defaultStructure: EDM_DEFAULT_SONG_STRUCTURE,
  });
  const tags = [...inputs.customTags, "electronic"];
  const negativeTags = instrumentalNegativeTags(inputs.lyricsMode);

  const styleClauses = buildStyleClauses([
    { key: "genre", value: inputs.subgenre.replace(/_/g, " ") },
    { key: "bpm", value: String(inputs.bpm) },
    { key: "mood", value: inputs.mood },
    { key: "energy", value: String(inputs.energy) },
    { key: "complexity", value: String(inputs.complexity) },
  ]);

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
