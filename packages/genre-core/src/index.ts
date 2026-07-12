import type { z } from "zod";

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

  // ── Schema ──────────────────────────────────────────────────────
  /** Input validation schema */
  inputSchema: z.ZodType<TInputs>;
  /** Internal blueprint schema */
  blueprintSchema: z.ZodType<TBlueprintData>;

  // ── Defaults & Form ─────────────────────────────────────────────
  /** Default input values */
  defaults: TInputs;
  /** UI form field descriptors */
  form: FormFieldDescriptor[];

  // ── Generation ──────────────────────────────────────────────────
  /** Vocabulary for LLM adjustment prompts */
  adjustmentVocabulary: AdjustmentVocabulary;
  /** Tag compilation policy */
  tagPolicy: TagPolicy;
  /** Named presets */
  presets: GenrePreset[];
  /** LLM prompt fragments keyed by stage */
  promptFragments: Record<string, string>;
  /** Renderers produce Suno-ready artifacts from blueprint */
  renderers: GenreRenderers<TBlueprintData>;
  /** Critic function table */
  critics: GenreCritics;
  /** Validators run post-merge */
  validators: GenreValidators<TInputs>;
  /** Data migrations for version compat */
  migrations: GenreMigration[];
}

// ── Sub-types ────────────────────────────────────────────────────────

export interface FormFieldDescriptor {
  key: string;
  label: string;
  type: "text" | "select" | "multiselect" | "number" | "toggle";
  /** Options for select / multiselect */
  options?: { label: string; value: string }[];
  /** Zod refinement hints */
  constraints?: Record<string, unknown>;
}

export interface AdjustmentVocabulary {
  /** Terms that modify style */
  styleTerms: string[];
  /** Terms that modify structure */
  structureTerms: string[];
  /** Terms that modify delivery / performance */
  deliveryTerms: string[];
}

export interface TagPolicy {
  /** Tags always added to generated style */
  mandatoryTags: string[];
  /** Tags never included */
  forbiddenTags: string[];
  /** Tag rewrite map (user input → canonical) */
  canonicalMap: Record<string, string>;
}

export interface GenrePreset {
  id: string;
  name: string;
  description: string;
  /** Partial input values */
  values: Record<string, unknown>;
}

export interface GenreRenderers<TBlueprintData> {
  /** Produce Title artifact */
  title: (data: TBlueprintData) => string;
  /** Produce Style description artifact */
  style: (data: TBlueprintData) => string;
  /** Produce Excluded Styles artifact */
  excludedStyles: (data: TBlueprintData) => string;
  /** Produce Lyrics/Structure artifact */
  lyrics: (data: TBlueprintData) => string;
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
  input: (inputs: TInputs) => ValidationError[];
  /** Validate blueprint before compilation */
  blueprint: (data: unknown) => ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface GenreMigration {
  fromVersion: number;
  toVersion: number;
  migrate: (data: Record<string, unknown>) => Record<string, unknown>;
}

// ── UI Module ────────────────────────────────────────────────────────

export interface GenreUiModule {
  /** React/Preact component for genre-specific form */
  InputForm: unknown; // ComponentType
  /** Blueprint preview component */
  Preview: unknown;
}
