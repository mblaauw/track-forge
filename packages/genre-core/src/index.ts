import { z } from "zod";
import type { StyleClause } from "@track-forge/contracts";

// ── Song structure (arrangement config) ───────────────────────────────

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

/**
 * Bar specification for a song structure section.
 * A plain number means a fixed bar count.
 * An object means "base + round(energy * per_energy + complexity * per_complexity)".
 */
export type SongStructureBarSpec =
  number | { base: number; per_energy?: number; per_complexity?: number };

/** A single section in the song structure template (from YAML / genre config) */
export interface SongStructureSection {
  section: string;
  bars: SongStructureBarSpec;
  tags: string[];
  /** Function verb (optional in template — assigned by compileBlueprint) */
  fn?: SectionFunction;
  /** Local delta terms (optional in template) */
  deltas?: string[];
}

/** A computed arrangement section (bars resolved to a concrete number) */
export interface ArrangementSection {
  section: string;
  bars: number;
  tags: string[];
  /** Exactly one function verb */
  fn: SectionFunction;
  /** Local-only deltas (never global sonic traits) */
  deltas: string[];
  /** Per-section vocal delivery (vocal sections only) */
  vocal?: Vocal;
}

/**
 * Compute a concrete bar count from a SongStructureBarSpec and input values.
 * Static numbers pass through; object specs are evaluated as:
 *   base + round(energy * per_energy + complexity * per_complexity)
 */
export { capitalize, encodeKey, decodeKeyValue } from "./utils.js";

export function computeBars(
  spec: SongStructureBarSpec,
  inputs: { energy?: number; complexity?: number },
): number {
  if (typeof spec === "number") return spec;
  let total = spec.base;
  if (spec.per_energy && inputs.energy != null)
    total += inputs.energy * spec.per_energy;
  if (spec.per_complexity && inputs.complexity != null)
    total += inputs.complexity * spec.per_complexity;
  return Math.round(total);
}

// ── Genre module contract ────────────────────────────────────────────

/**
 * Pure-domain genre module definition.
 * TInputs = user-facing input model (Zod schema output).
 * TBlueprintData = internal blueprint model used during generation.
 */
export interface GenreModule<
  TInputs extends Record<string, unknown> = Record<string, unknown>,
  TBlueprintData extends Record<string, unknown> = Record<string, unknown>,
> {
  /** Unique genre identifier (e.g. "edm", "hiphop") */
  id: string;
  /** Human-readable label */
  name: string;

  // ── Schema & Defaults ───────────────────────────────────────────
  /** Input validation schema */
  inputSchema: z.ZodType<TInputs, z.ZodTypeDef, Record<string, unknown>>;
  /** Internal blueprint schema */
  blueprintSchema: z.ZodType<
    TBlueprintData,
    z.ZodTypeDef,
    Record<string, unknown>
  >;
  /** Default input values */
  defaults: TInputs;

  // ── Generation ──────────────────────────────────────────────────
  /** Named presets (loaded from YAML config at runtime) */
  presets?: GenrePreset[];
  /** LLM prompt fragments keyed by stage */
  promptFragments: Record<string, string>;
  /** Tag categories for the Style Console UI (loaded from YAML config at runtime) */
  tagCategories?: TagCategory[];
  /** Descriptor config: category pools, defaults, preset seeds (interim TS; Subissue 7 → YAML) */
  descriptorConfig?: GenreDescriptorConfig;
  /** Song structure template (loaded from YAML config at runtime) */
  songStructure?: SongStructureSection[];
  /** Taxonomy data (loaded from YAML config at runtime) */
  taxonomy?: unknown;
  /** Compile user inputs into full blueprint shape */
  compileBlueprint(
    inputs: TInputs,
    options?: {
      arrangementOverride?: {
        section: string;
        bars: number;
        tags?: string[];
      }[];
      songStructure?: SongStructureSection[];
    },
  ): TBlueprintData;
  /** Renderers produce Suno-ready artifacts from blueprint */
  renderers: GenreRenderers<TBlueprintData>;
  /** Critic function table */
  critics: GenreCritics;
  /** Validators run post-merge */
  validators: GenreValidators<TInputs>;
}

// ── Sub-types ────────────────────────────────────────────────────────

export interface GenrePreset {
  id: string;
  name: string;
  description: string;
  /** Partial input values */
  values: Record<string, unknown>;
}

export interface GenreRenderers<TBlueprintData> {
  /** Produce Title artifact */
  title(data: TBlueprintData): string;
  /** Produce Style description artifact */
  style(data: TBlueprintData): string;
  /** Produce Excluded Styles artifact */
  excludedStyles(data: TBlueprintData): string;
  /** Produce Lyrics/Structure artifact */
  lyrics(data: TBlueprintData): string;
}

export interface GenreCritics {
  /** Fast panel critic — runs single prompt for all checks */
  fast?: CriticDefinition;
  /** Full parallel critics — one per focus area */
  full?: CriticDefinition[];
}

export interface CriticDefinition {
  id: string;
  promptTemplate: string;
}

export interface GenreValidators<TInputs> {
  /** Validate merged inputs (after preset apply) */
  input(inputs: TInputs): ValidationError[];
  /** Validate blueprint before compilation */
  blueprint(data: unknown): ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
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

export interface GenreDescriptorConfig {
  /** 5-category suggestion pools */
  categories: DescriptorCategoryPool[];
  /** Genre-level descriptor defaults */
  defaults: DescriptorDef[];
  /** Per-preset descriptor seeds (overrides + additions to genre defaults) */
  presetSeeds: Record<string, DescriptorDef[]>;
}

export interface TagCategory {
  id: string;
  name: string;
  color: string;
  suggestions: string[];
}

// ── Shared builders ─────────────────────────────────────────────────

export interface ResolveArrangementOptions {
  arrangementOverride?: ArrangementSection[];
  songStructure?: SongStructureSection[];
  inputs: { energy?: number; complexity?: number };
  defaultStructure: SongStructureSection[];
}

export function resolveArrangement(
  opts: ResolveArrangementOptions,
): ArrangementSection[] {
  if (opts.arrangementOverride) {
    return opts.arrangementOverride.map((s) => ({
      section: s.section,
      bars: s.bars,
      tags: s.tags ?? [],
      fn: s.fn ?? "establish",
      deltas: s.deltas ?? [],
      vocal: s.vocal,
    }));
  }
  const template = opts.songStructure ?? opts.defaultStructure;
  return template.map((s) => ({
    section: s.section,
    bars: computeBars(s.bars, opts.inputs),
    tags: s.tags,
    fn: s.fn ?? "establish",
    deltas: s.deltas ?? [],
  }));
}

export function buildStyleClauses(
  clauses: { key: string; value: string; order?: number }[],
): StyleClause[] {
  return clauses.map((c, i) => ({
    key: c.key,
    value: c.value,
    order: c.order ?? i,
  }));
}

// ── Module factory ────────────────────────────────────────────────────

/**
 * Create a GenreModule with minimal boilerplate.
 * Omitted fields (form, adjustmentVocabulary, tagPolicy, migrations) are dropped
 * from the interface — they were never consumed at runtime.
 */
export function createGenreModule<
  TInputs extends Record<string, unknown>,
  TBlueprintData extends Record<string, unknown>,
>(config: {
  id: string;
  name: string;
  inputSchema: z.ZodType<TInputs, z.ZodTypeDef, Record<string, unknown>>;
  blueprintSchema: z.ZodType<
    TBlueprintData,
    z.ZodTypeDef,
    Record<string, unknown>
  >;
  defaults: TInputs;
  promptFragments: Record<string, string>;
  compileBlueprint: (
    inputs: TInputs,
    options?: {
      arrangementOverride?: ArrangementSection[];
      songStructure?: SongStructureSection[];
    },
  ) => TBlueprintData;
  renderers: GenreRenderers<TBlueprintData>;
  critics: GenreCritics;
  validators: GenreValidators<TInputs>;
}): GenreModule<TInputs, TBlueprintData> {
  return {
    id: config.id,
    name: config.name,
    inputSchema: config.inputSchema,
    blueprintSchema: config.blueprintSchema,
    defaults: config.defaults,
    promptFragments: config.promptFragments,
    compileBlueprint: config.compileBlueprint,
    renderers: config.renderers,
    critics: config.critics,
    validators: config.validators,
  };
}

export function instrumentalNegativeTags(lyricsMode: string): string[] {
  if (lyricsMode === "full_lyrics") return [];
  return ["vocals", "singing", "lyrics", "voice"];
}

// ── Shared Zod schema factories ─────────────────────────────────────────

const DEFAULT_LYRICS_MODE = z.enum([
  "strict_instrumental",
  "guided_instrumental",
  "full_lyrics",
]);

interface BaseInputOpts {
  bpmMin?: number;
  bpmMax?: number;
  lyricsMode?: z.ZodType<string, any, any>;
  extra?: Record<string, z.ZodTypeAny>;
}

interface BaseBlueprintOpts {
  bpmMin?: number;
  bpmMax?: number;
  lyricsMode?: z.ZodType<string, any, any>;
  extra?: Record<string, z.ZodTypeAny>;
}

/**
 * Build a base input schema with shared fields (bpm, key, scale, mood,
 * complexity, lyricsMode) merged with genre-specific extras.
 */
export function createBaseInputSchema(opts?: BaseInputOpts): z.ZodObject<any> {
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
    lyricsMode: opts?.lyricsMode ?? DEFAULT_LYRICS_MODE,
  });
  if (opts?.extra) {
    for (const [k, v] of Object.entries(opts.extra)) {
      schema = schema.extend({ [k]: v as any });
    }
  }
  return schema;
}

/**
 * Build a base blueprint schema with shared input fields, arrangement,
 * styleClauses, tags, and negativeTags merged with genre-specific extras.
 */
export function createBaseBlueprintSchema(opts?: BaseBlueprintOpts): any {
  let schema: any = z.object({
    bpm: z.number().int(),
    key: z.string(),
    scale: z.enum(["major", "minor"]),
    mood: z.string(),
    complexity: z.number().int().min(1).max(10),
    lyricsMode: opts?.lyricsMode ?? DEFAULT_LYRICS_MODE,
    arrangement: z.array(
      z.object({
        section: z.string(),
        bars: z.number().int().positive(),
        tags: z.array(z.string()),
        fn: z
          .enum([
            "establish",
            "introduce",
            "escalate",
            "contrast",
            "remove",
            "peak",
            "resolve",
          ])
          .default("establish"),
        deltas: z.array(z.string()).default([]),
        vocal: z
          .object({
            type: z.string(),
            delivery: z.string(),
            energy: z.number().int().min(1).max(5),
            adlibs: z.boolean(),
            harmonies: z.boolean(),
          })
          .optional(),
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
  if (opts?.extra) {
    for (const [k, v] of Object.entries(opts.extra)) {
      schema = schema.extend({ [k]: v as any });
    }
  }
  return schema;
}
