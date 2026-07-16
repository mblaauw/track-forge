import { z } from "zod";
import {
  type SongStructureSection,
  resolveArrangement,
  buildStyleClauses,
  instrumentalNegativeTags,
} from "@track-forge/genre-core";
import {
  type NarrativeArc,
  type RhymeStyle,
  type FlowPattern,
  type Delivery,
  type ProductionStyle,
  HIP_HOP_SUBGENRES,
  getSubgenreEntryOrFallback,
} from "./taxonomy.js";

// ── Input Schema ──────────────────────────────────────────────────────

export const HipHopInputSchema = z.object({
  subgenre: z.string().min(1, "Subgenre is required"),
  bpm: z.number().int().min(50).max(200),
  key: z.string().default("C"),
  scale: z.enum(["major", "minor"] as const).default("minor"),
  mood: z.string().default(""),
  narrativeArc: z
    .enum([
      "storytelling",
      "braggadocio",
      "conscious",
      "party",
      "introspective",
      "abstract",
    ] as const)
    .default("braggadocio"),
  rhymeStyle: z
    .enum([
      "multi_syllabic",
      "end_rhyme",
      "internal",
      "free_form",
      "slant_rhyme",
    ] as const)
    .default("end_rhyme"),
  flowPattern: z
    .enum([
      "laid_back",
      "aggressive",
      "syncopated",
      "double_time",
      "melodic",
      "mumble",
    ] as const)
    .default("laid_back"),
  delivery: z
    .enum(["calm", "intense", "conversational", "hype", "whispered"] as const)
    .default("conversational"),
  productionStyle: z
    .enum([
      "lo_fi",
      "polished",
      "vintage",
      "experimental",
      "minimal",
      "orchestral",
      "electronic",
      "live_instruments",
    ] as const)
    .default("polished"),
  energy: z.number().int().min(1).max(10).default(6),
  complexity: z.number().int().min(1).max(10).default(5),
  lyricsMode: z
    .enum(["instrumental", "full_lyrics"] as const)
    .default("full_lyrics"),
  customTags: z.string().default(""),
  reference: z.string().default(""),
});

export type HipHopInputs = z.infer<typeof HipHopInputSchema>;

// ── Blueprint Schema ──────────────────────────────────────────────────

export const HipHopBlueprintSchema = z.object({
  subgenre: z.string().min(1),
  bpm: z.number().int().min(50).max(200),
  key: z.string(),
  scale: z.enum(["major", "minor"] as const),
  mood: z.string(),
  narrativeArc: z
    .enum([
      "storytelling",
      "braggadocio",
      "conscious",
      "party",
      "introspective",
      "abstract",
    ] as const)
    .default("braggadocio"),
  rhymeStyle: z
    .enum([
      "multi_syllabic",
      "end_rhyme",
      "internal",
      "free_form",
      "slant_rhyme",
    ] as const)
    .default("end_rhyme"),
  flowPattern: z
    .enum([
      "laid_back",
      "aggressive",
      "syncopated",
      "double_time",
      "melodic",
      "mumble",
    ] as const)
    .default("laid_back"),
  delivery: z
    .enum(["calm", "intense", "conversational", "hype", "whispered"] as const)
    .default("conversational"),
  productionStyle: z
    .enum([
      "lo_fi",
      "polished",
      "vintage",
      "experimental",
      "minimal",
      "orchestral",
      "electronic",
      "live_instruments",
    ] as const)
    .default("polished"),
  energy: z.number().int().min(1).max(10),
  complexity: z.number().int().min(1).max(10),
  lyricsMode: z.enum(["instrumental", "full_lyrics"]),
  vocalStyle: z.string(),
  tags: z.array(z.string()),
  negativeTags: z.array(z.string()),
  styleClauses: z.array(
    z.object({
      key: z.string(),
      value: z.string(),
      order: z.number(),
    }),
  ),
  arrangement: z.array(
    z.object({
      section: z.string(),
      bars: z.number().int().positive(),
      tags: z.array(z.string()),
    }),
  ),
});

export type HipHopBlueprint = z.infer<typeof HipHopBlueprintSchema>;

// ── Defaults ──────────────────────────────────────────────────────────

const defaultSubgenre = "boom_bap";

export function buildHipHopDefaults(
  overrides?: Partial<HipHopInputs>,
): HipHopInputs {
  const preset = getSubgenreEntryOrFallback(defaultSubgenre);
  return {
    subgenre: defaultSubgenre,
    bpm: preset.bpmDefault,
    key: "C",
    scale: "minor",
    mood: "",
    narrativeArc: preset.defaultNarrative,
    rhymeStyle: preset.commonRhymeStyles[0] ?? "end_rhyme",
    flowPattern: preset.defaultFlow,
    delivery: preset.defaultDelivery,
    productionStyle: preset.defaultProduction,
    energy: 6,
    complexity: 5,
    lyricsMode: "full_lyrics",
    customTags: "",
    reference: "",
    ...overrides,
  };
}

export const HIP_HOP_DEFAULTS: HipHopInputs = buildHipHopDefaults();
