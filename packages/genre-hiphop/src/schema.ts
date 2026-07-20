import { z } from "zod";

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
      "slang_rhyme",
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
      "experimental",
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
    .enum(["strict_instrumental", "full_lyrics"] as const)
    .default("full_lyrics"),
  customTags: z.string().default(""),
  reference: z.string().default(""),
});

export type HipHopInputs = z.infer<typeof HipHopInputSchema>;

export const HIP_HOP_DEFAULTS: HipHopInputs = {
  subgenre: "boom_bap",
  bpm: 95,
  key: "C",
  scale: "minor",
  mood: "",
  narrativeArc: "braggadocio",
  rhymeStyle: "end_rhyme",
  flowPattern: "laid_back",
  delivery: "conversational",
  productionStyle: "polished",
  energy: 6,
  complexity: 5,
  lyricsMode: "full_lyrics",
  customTags: "",
  reference: "",
};
