import { z } from "zod";

// ── Generation pipeline ──────────────────────────────────────────────

export const GenerationStage = {
  Compilation: "compilation",
  LyricsWriting: "lyrics_writing",
  Versioning: "versioning",
} as const;
export type GenerationStage =
  (typeof GenerationStage)[keyof typeof GenerationStage];

export const JobStatus = {
  Pending: "pending",
  InProgress: "in_progress",
  Completed: "completed",
  Failed: "failed",
  Cancelled: "cancelled",
} as const;
export type JobStatus = (typeof JobStatus)[keyof typeof JobStatus];

export const VersionStatus = {
  Draft: "draft",
  Final: "final",
} as const;
export type VersionStatus = (typeof VersionStatus)[keyof typeof VersionStatus];

// ── Core IDs ─────────────────────────────────────────────────────────

export type JobId = string & { readonly __brand: "JobId" };
export type VersionId = string & { readonly __brand: "VersionId" };
export type GenreId = string & { readonly __brand: "GenreId" };
export type PresetId = string & { readonly __brand: "PresetId" };
export type SourceHash = string & { readonly __brand: "SourceHash" };

// ── Suno artifact types ──────────────────────────────────────────────

export const SunoArtifactType = {
  Title: "title",
  Style: "style",
  ExcludedStyles: "excluded_styles",
  Lyrics: "lyrics",
} as const;
export type SunoArtifactType =
  (typeof SunoArtifactType)[keyof typeof SunoArtifactType];

export interface SunoArtifact {
  type: SunoArtifactType;
  value: string;
  versionId: VersionId;
}

// ── Lyrics & Structure Document Model ─────────────────────────────────

export const SectionType = {
  Intro: "intro",
  Verse: "verse",
  PreChorus: "pre_chorus",
  Chorus: "chorus",
  Hook: "hook",
  PostChorus: "post_chorus",
  Bridge: "bridge",
  Breakdown: "breakdown",
  Build: "build",
  Drop: "drop",
  Solo: "solo",
  Break: "break",
  Outro: "outro",
  Interlude: "interlude",
} as const;
export type SectionType = (typeof SectionType)[keyof typeof SectionType];

export interface LyricsSection {
  type: SectionType;
  label?: string;
  lines: string[];
  bars: number;
  tags: string[];
  instrumental: boolean;
}

export interface LyricsDocument {
  bpm?: number;
  key?: string;
  genre?: string;
  sections: LyricsSection[];
  metadata: Record<string, string>;
}

// ── Writer stage results ─────────────────────────────────────────────

export interface LyricsWriterResult {
  document: LyricsDocument;
}

export type LyricsFormat =
  "strict_instrumental" | "full_lyrics";

// ── Job & Version ────────────────────────────────────────────────────

export interface Job {
  id: JobId;
  projectId: string | null;
  name: string | null;
  genreId: GenreId;
  presetId: PresetId;
  status: JobStatus;
  currentStage: GenerationStage;
  reference: string | null;
  sourceHash: SourceHash | null;
  inputs: string | null;
  nlAdjustments: string | null;
  findings: string | null;
  compiledJson: string | null;
  stageData: string | null;
  stageAttempt: number;
  error: string | null;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Version {
  id: VersionId;
  jobId: JobId;
  status: VersionStatus;
  number: number;
  artifacts: SunoArtifact[];
  stage: GenerationStage | null;
  parentVersionId: VersionId | null;
  finalizedAt: string | null;
  createdAt: string;
}

// ── Job events ───────────────────────────────────────────────────────

export interface JobEvent {
  id: string;
  jobId: JobId;
  sequence: number;
  stage: GenerationStage | null;
  status: string;
  data: string | null;
  error: string | null;
  timestamp: string;
}

// ── Project (import/export only) ─────────────────────────────────────

export interface Project {
  id: string;
  name: string;
  description: string | null;
  genreId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectExport {
  project: Project;
  jobs: JobExport[];
}

export interface JobExport {
  job: Partial<Job> & { id: string; genreId: string; presetId: string };
  versions: (Partial<Version> & { id: string; number: number })[];
}

export interface ExportBundle {
  formatVersion: number;
  exportedAt: string;
  projects: ProjectExport[];
}

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: { index: number; message: string }[];
}

export const ImportBundleSchema = z.object({
  formatVersion: z.literal(1),
  exportedAt: z.string().optional(),
  projects: z.array(
    z.object({
      project: z.object({
        id: z.string(),
        name: z.string(),
        description: z.string().nullable().optional(),
        genreId: z.string().nullable().optional(),
        createdAt: z.string(),
        updatedAt: z.string(),
      }),
      jobs: z.array(
        z.object({
          job: z.object({
            id: z.string(),
            genreId: z.string(),
            presetId: z.string(),
            status: z.string().optional(),
            currentStage: z.string().optional(),
            name: z.string().nullable().optional(),
            reference: z.string().nullable().optional(),
            sourceHash: z.string().nullable().optional(),
            inputs: z.string().nullable().optional(),
            nlAdjustments: z.string().nullable().optional(),
            findings: z.string().nullable().optional(),
            compiledJson: z.string().nullable().optional(),
            stageData: z.string().nullable().optional(),
            stageAttempt: z.number().optional(),
            error: z.string().nullable().optional(),
            createdAt: z.string().optional(),
            updatedAt: z.string().optional(),
          }),
          versions: z.array(
            z.object({
              id: z.string(),
              jobId: z.string(),
              status: z.string().optional(),
              number: z.number(),
              artifacts: z.union([z.string(), z.array(z.unknown())]).optional(),
              stage: z.string().nullable().optional(),
              parentVersionId: z.string().nullable().optional(),
              finalizedAt: z.string().nullable().optional(),
              createdAt: z.string().optional(),
            }),
          ),
        }),
      ),
    }),
  ),
});

// ── Config schema ────────────────────────────────────────────────────

export const ConfigSchema = z.object({
  sunoBaseUrl: z.string().url().default("https://api.sunomusic.com"),
  sunoAuthToken: z.string().optional(),
  publicBaseUrl: z.string().url().optional(),
  dbPath: z.string().default("./data/track-forge.db"),
  logLevel: z
    .enum(["trace", "debug", "info", "warn", "error", "fatal"])
    .default("info"),
  port: z.number().int().positive().default(3000),
  host: z.string().default("127.0.0.1"),
  staticDir: z.string().optional(),
  llmProvider: z
    .enum(["openai", "anthropic", "ollama", "openai-compatible"])
    .default("openai"),
  llmApiKey: z.string().optional(),
  llmBaseUrl: z.string().optional(),
  llmModel: z.string().default("gpt-4o"),
});

export type Config = z.infer<typeof ConfigSchema>;

// ── Style compiler types ─────────────────────────────────────────────

export interface CompiledStyle {
  description: string;
  tags: string[];
  negativeTags: string[];
  clauses: { key: string; value: string; order: number }[];
}
