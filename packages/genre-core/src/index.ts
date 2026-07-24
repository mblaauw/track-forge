import { z } from "zod";

// ── Genre module contract ────────────────────────────────────────────

export interface GenreModule<
  TInputs extends Record<string, unknown> = Record<string, unknown>,
> {
  id: string;
  name: string;
  inputSchema: z.ZodType<TInputs, z.ZodTypeDef, Record<string, unknown>>;
  defaults: TInputs;
  /** Augmented at runtime with YAML config data */
  presets?: GenrePreset[];
  songStructure?: SongStructureSection[];
  /** Genre-specific songwriting conventions fed into the lyrics-writing prompt. */
  lyricsGuidance?: string;
}

// ── Sub-types ────────────────────────────────────────────────────────

export type SectionFunction =
  | "establish"
  | "introduce"
  | "escalate"
  | "contrast"
  | "remove"
  | "peak"
  | "resolve";

export interface Vocal {
  type: string;
  delivery: string;
  energy: number;
  adlibs: boolean;
  harmonies: boolean;
}

export type SongStructureBarSpec =
  number | { base: number; per_energy?: number; per_complexity?: number };

export interface SongStructureSection {
  section: string;
  bars: SongStructureBarSpec;
  tags: string[];
  fn?: SectionFunction;
  deltas?: string[];
}

export interface ArrangementSection {
  section: string;
  bars: number;
  tags: string[];
  fn: SectionFunction;
  deltas: string[];
  vocal?: Vocal;
}

/**
 * Single source of truth for "does this section carry vocals" — reused by
 * the web arrangement editor and the pipeline's compilation/lyrics stages.
 * Do not reimplement this heuristic elsewhere.
 */
export function isVocalSection(section: {
  name: string;
  deltas: string[];
}): boolean {
  const lowerDeltas = section.deltas.map((d) => d.toLowerCase());
  if (lowerDeltas.includes("instrumental")) return false;
  if (lowerDeltas.includes("vocal focus") || lowerDeltas.includes("catchy"))
    return true;
  return /verse|chorus|hook|pre-chorus|refrain|bridge|drop/i.test(section.name);
}

export interface GenrePreset {
  id: string;
  name: string;
  description: string;
  values: Record<string, unknown>;
}

export type DescriptorCategory =
  "sound" | "rhythm" | "atmosphere" | "production" | "energy";

export type DescriptorWeight = 1 | 2 | 3;

export interface DescriptorDef {
  label: string;
  cat: DescriptorCategory;
  weight: DescriptorWeight;
}

export interface DescriptorCategoryPool {
  cat: DescriptorCategory;
  label: string;
  hue: string;
  chips: string[];
}

// ── Module factory ────────────────────────────────────────────────────

export function createGenreModule<
  TInputs extends Record<string, unknown>,
>(config: {
  id: string;
  name: string;
  inputSchema: z.ZodType<TInputs, z.ZodTypeDef, Record<string, unknown>>;
  defaults: TInputs;
}): GenreModule<TInputs> {
  return {
    id: config.id,
    name: config.name,
    inputSchema: config.inputSchema,
    defaults: config.defaults,
  };
}

// ── Shared Zod schema factory ─────────────────────────────────────────

export function createBaseInputSchema(opts?: {
  bpmMin?: number;
  bpmMax?: number;
  lyricsMode?: z.ZodType<string, any, any>;
  extra?: Record<string, z.ZodTypeAny>;
}): z.ZodObject<any> {
  let schema: any = z.object({
    bpm: z
      .number()
      .int()
      .min(opts?.bpmMin ?? 40)
      .max(opts?.bpmMax ?? 220),
    key: z.string(),
    scale: z.enum(["major", "minor"]),
    mood: z.string(),
    complexity: z.number().int().min(1).max(10),
    lyricsMode:
      opts?.lyricsMode ?? z.enum(["strict_instrumental", "full_lyrics"]),
  });
  if (opts?.extra) {
    for (const [k, v] of Object.entries(opts.extra)) {
      schema = schema.extend({ [k]: v as any });
    }
  }
  return schema;
}
