import { z } from "zod";

const SectionFunctionEnum = z.enum([
  "establish",
  "introduce",
  "escalate",
  "contrast",
  "remove",
  "peak",
  "resolve",
]);

const DescriptorCategoryEnum = z.enum([
  "sound",
  "rhythm",
  "atmosphere",
  "production",
  "energy",
]);

const DescriptorWeightEnum = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
]);

const VocalSchema = z
  .object({
    type: z.string(),
    delivery: z.string(),
    energy: z.number(),
    adlibs: z.boolean(),
    harmonies: z.boolean(),
  })
  .strict();

const StyleInfluenceSchema = z
  .object({
    genreId: z.string().min(1),
    presetId: z.string().min(1),
    role: z.enum(["primary", "influence", "accent"]),
    strength: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    sectionIds: z.array(z.string()).optional(),
  })
  .strict();

const IntentDescriptorSchema = z
  .object({
    label: z.string().min(1),
    cat: DescriptorCategoryEnum,
    weight: DescriptorWeightEnum,
  })
  .strict();

const MusicalIntentSchema = z
  .object({
    bpm: z.number().int().min(40).max(220).optional(),
    tempoFeel: z.string().optional(),
    perceivedBpm: z.number().int().positive().optional(),
    mood: z.string().optional(),
    energy: z.number().int().min(1).max(10).optional(),
    complexity: z.number().int().min(1).max(10).optional(),
    characteristics: z.array(z.string()),
    descriptors: z.array(IntentDescriptorSchema),
    key: z.string().optional(),
    scale: z.enum(["major", "minor"]).optional(),
  })
  .strict();

const VocalSectionOverrideSchema = z
  .object({
    sectionId: z.string().min(1),
    vocal: VocalSchema,
  })
  .strict();

const VocalIntentSchema = z
  .object({
    mode: z.enum(["strict_instrumental", "full_lyrics"]),
    type: z.string().optional(),
    sections: z.array(VocalSectionOverrideSchema),
  })
  .strict();

const LyricAngleEnum = z.enum([
  "first_person",
  "story",
  "abstract",
  "anthemic",
]);

const LyricsIntentSchema = z
  .object({
    topic: z.string().optional(),
    themes: z.array(z.string()),
    angle: LyricAngleEnum.optional(),
    narrativeArc: z.string().optional(),
    rhymeStyle: z.string().optional(),
    flowPattern: z.string().optional(),
    vocalStyle: z.string().optional(),
    lineDensity: z.number().min(0.25).max(2).optional(),
    perspective: z.string().optional(),
    imageAnchors: z.array(z.string()),
  })
  .strict();

const ArrangementSectionIntentSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    bars: z.number().int().min(0),
    fn: SectionFunctionEnum,
    deltas: z.array(z.string()),
    tags: z.array(z.string()),
    vocal: VocalSchema.optional(),
  })
  .strict();

const ArrangementIntentSchema = z
  .object({
    source: z.enum(["default", "custom"]),
    sections: z.array(ArrangementSectionIntentSchema),
    typicalSongStructure: z.array(z.string()).optional(),
  })
  .strict();

const ReferenceIntentSchema = z
  .object({
    text: z.string(),
  })
  .strict();

// .strict() on the top-level object catches unknown fields so we don't
// silently miss new intent fields in migration.
export const SongIntentV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    identity: z.object({ title: z.string() }).strict(),
    styles: z.array(StyleInfluenceSchema),
    musical: MusicalIntentSchema,
    vocals: VocalIntentSchema,
    lyrics: LyricsIntentSchema,
    arrangement: ArrangementIntentSchema,
    exclusions: z.array(z.string()),
    references: z.array(ReferenceIntentSchema),
  })
  .strict();

export type SongIntentV1Parsed = z.infer<typeof SongIntentV1Schema>;
