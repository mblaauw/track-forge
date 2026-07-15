import { z } from "zod";
import type { StyleClause } from "@track-forge/contracts";
import {
  type NarrativeArc,
  type RhymeStyle,
  type FlowPattern,
  type Delivery,
  type ProductionStyle,
  HIP_HOP_SUBGENRES,
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

export type HipHopInputs = z.input<typeof HipHopInputSchema>;

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
  songStructure: z.array(z.string()),
});

export type HipHopBlueprint = z.input<typeof HipHopBlueprintSchema>;

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

// ── Form Field Descriptors ────────────────────────────────────────────

import type { FormFieldDescriptor } from "@track-forge/genre-core";
import { getSubgenreEntryOrFallback } from "./taxonomy.js";

export const HIP_HOP_FORM_FIELDS: FormFieldDescriptor[] = [
  {
    key: "subgenre",
    label: "Subgenre",
    type: "select",
    options: HIP_HOP_SUBGENRES.map((s) => ({ label: s.label, value: s.id })),
  },
  {
    key: "bpm",
    label: "BPM",
    type: "number",
    constraints: { min: 50, max: 200 },
  },
  {
    key: "narrativeArc",
    label: "Narrative Arc",
    type: "select",
    options: [
      { label: "Storytelling", value: "storytelling" },
      { label: "Braggadocio", value: "braggadocio" },
      { label: "Conscious", value: "conscious" },
      { label: "Party", value: "party" },
      { label: "Introspective", value: "introspective" },
      { label: "Abstract", value: "abstract" },
    ],
  },
  {
    key: "rhymeStyle",
    label: "Rhyme Style",
    type: "select",
    options: [
      { label: "Multi-syllabic", value: "multi_syllabic" },
      { label: "End Rhyme", value: "end_rhyme" },
      { label: "Internal Rhyme", value: "internal" },
      { label: "Free Form", value: "free_form" },
      { label: "Slant Rhyme", value: "slant_rhyme" },
    ],
  },
  {
    key: "flowPattern",
    label: "Flow Pattern",
    type: "select",
    options: [
      { label: "Laid-back", value: "laid_back" },
      { label: "Aggressive", value: "aggressive" },
      { label: "Syncopated", value: "syncopated" },
      { label: "Double Time", value: "double_time" },
      { label: "Melodic", value: "melodic" },
      { label: "Mumble", value: "mumble" },
    ],
  },
  {
    key: "delivery",
    label: "Delivery",
    type: "select",
    options: [
      { label: "Calm", value: "calm" },
      { label: "Intense", value: "intense" },
      { label: "Conversational", value: "conversational" },
      { label: "Hype", value: "hype" },
      { label: "Whispered", value: "whispered" },
    ],
  },
  {
    key: "productionStyle",
    label: "Production Style",
    type: "select",
    options: [
      { label: "Lo-fi", value: "lo_fi" },
      { label: "Polished", value: "polished" },
      { label: "Vintage", value: "vintage" },
      { label: "Experimental", value: "experimental" },
      { label: "Minimal", value: "minimal" },
      { label: "Orchestral", value: "orchestral" },
      { label: "Electronic", value: "electronic" },
      { label: "Live Instruments", value: "live_instruments" },
    ],
  },
  {
    key: "energy",
    label: "Energy",
    type: "number",
    constraints: { min: 1, max: 10 },
  },
  {
    key: "complexity",
    label: "Lyrical Complexity",
    type: "number",
    constraints: { min: 1, max: 10 },
  },
  {
    key: "lyricsMode",
    label: "Lyrics Mode",
    type: "select",
    options: [
      { label: "Instrumental", value: "instrumental" },
      { label: "Full Lyrics", value: "full_lyrics" },
    ],
  },
  { key: "mood", label: "Mood / Vibe", type: "text" },
  { key: "key", label: "Key", type: "text" },
  { key: "reference", label: "Reference Tracks", type: "text" },
  { key: "customTags", label: "Custom Tags", type: "text" },
];
