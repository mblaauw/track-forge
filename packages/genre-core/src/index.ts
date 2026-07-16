import type { z } from "zod";
import type { StyleClause } from "@track-forge/contracts";

// ── Song structure (arrangement config) ───────────────────────────────

/**
 * Bar specification for a song structure section.
 * A plain number means a fixed bar count.
 * An object means "base + round(energy * per_energy + complexity * per_complexity)".
 */
export type SongStructureBarSpec =
  number | { base: number; per_energy?: number; per_complexity?: number };

/** A single section in the song structure template */
export interface SongStructureSection {
  section: string;
  bars: SongStructureBarSpec;
  tags: string[];
}

/** A computed arrangement section (bars resolved to a concrete number) */
export interface ArrangementSection {
  section: string;
  bars: number;
  tags: string[];
}

/**
 * Compute a concrete bar count from a SongStructureBarSpec and input values.
 * Static numbers pass through; object specs are evaluated as:
 *   base + round(energy * per_energy + complexity * per_complexity)
 */
export { capitalize } from "./utils.js";

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
  blueprintSchema: z.ZodType<TBlueprintData, z.ZodTypeDef, Record<string, unknown>>;
  /** Default input values */
  defaults: TInputs;

  // ── Generation ──────────────────────────────────────────────────
  /** Named presets (loaded from YAML config at runtime) */
  presets?: GenrePreset[];
  /** LLM prompt fragments keyed by stage */
  promptFragments: Record<string, string>;
  /** Tag categories for the Style Console UI (loaded from YAML config at runtime) */
  tagCategories?: TagCategory[];
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

export interface TagCategory {
  id: string;
  name: string;
  color: string;
  suggestions: string[];
}

// ── Shared builders ─────────────────────────────────────────────────

export interface ResolveArrangementOptions {
  arrangementOverride?: { section: string; bars: number; tags?: string[] }[];
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
    }));
  }
  const template = opts.songStructure ?? opts.defaultStructure;
  return template.map((s) => ({
    section: s.section,
    bars: computeBars(s.bars, opts.inputs),
    tags: s.tags,
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
  blueprintSchema: z.ZodType<TBlueprintData, z.ZodTypeDef, Record<string, unknown>>;
  defaults: TInputs;
  promptFragments: Record<string, string>;
  compileBlueprint: (
    inputs: TInputs,
    options?: {
      arrangementOverride?: {
        section: string;
        bars: number;
        tags?: string[];
      }[];
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
