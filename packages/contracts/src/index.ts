import { z } from "zod";

// ── Generation pipeline ──────────────────────────────────────────────

export const GenerationStage = {
  RefInterpretation: "ref_interpretation",
  Planning: "planning",
  StyleWriting: "style_writing",
  LyricsWriting: "lyrics_writing",
  Compilation: "compilation",
  Review: "review",
  Revision: "revision",
  Verification: "verification",
  Versioning: "versioning",
} as const;
export type GenerationStage = (typeof GenerationStage)[keyof typeof GenerationStage];

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
export type ProjectId = string & { readonly __brand: "ProjectId" };
export type DraftId = string & { readonly __brand: "DraftId" };
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
export type SunoArtifactType = (typeof SunoArtifactType)[keyof typeof SunoArtifactType];

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

// ── Writer stage results ────────────────────────────────────────

export interface StyleWriterResult {
  titleCandidates: string[];
  descriptiveStyle: string;
  negativeTags: string[];
  bpm: number | null;
  key: string | null;
  vocalDescription: string;
}

export interface LyricsWriterResult {
  document: LyricsDocument;
}

export type LyricsFormat = "strict_instrumental" | "guided_instrumental" | "full_lyrics";

export const SunoInstrumentalMode = {
  Strict: "strict",
  Guided: "guided",
  FullLyrics: "full_lyrics",
} as const;
export type SunoInstrumentalMode = (typeof SunoInstrumentalMode)[keyof typeof SunoInstrumentalMode];

// ── Control descriptors (structured NL adjustments) ───────────────────

export type ControlOperator = "set" | "adjust" | "remove" | "add";

export interface ControlDescriptor {
  parameter: string;
  operator: ControlOperator;
  value: string | number | boolean | string[];
  confidence: number;
}

// ── Content Locking ───────────────────────────────────────────────────

export const LockType = {
  ArtifactLock: "artifact_lock",
  SectionLock: "section_lock",
  TextAnchor: "text_anchor",
} as const;
export type LockType = (typeof LockType)[keyof typeof LockType];

export interface ContentLock {
  type: LockType;
  id: string;
  description: string;
}

export interface ArtifactLock extends ContentLock {
  type: "artifact_lock";
  artifactType: SunoArtifactType;
}

export interface SectionLock extends ContentLock {
  type: "section_lock";
  artifactType: SunoArtifactType;
  sectionIndex: number;
}

export interface TextAnchor extends ContentLock {
  type: "text_anchor";
  artifactType: SunoArtifactType;
  anchorText: string;
  anchorIndex?: number;
  lockedValue: string;
}

// ── Project & Draft ──────────────────────────────────────────────────

export interface Project {
  id: ProjectId;
  name: string;
  description: string | null;
  genreId: GenreId | null;
  createdAt: string;
  updatedAt: string;
}

export interface Draft {
  id: DraftId;
  projectId: ProjectId;
  genreId: GenreId;
  presetId: PresetId;
  inputs: string | null;
  reference: string | null;
  nlAdjustments: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Job & Version ────────────────────────────────────────────────────

export interface Job {
  id: JobId;
  projectId: ProjectId | null;
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
  createdAt: string;
  updatedAt: string;
}

export interface Version {
  id: VersionId;
  jobId: JobId;
  status: VersionStatus;
  /** Ordinal version number (1-based) */
  number: number;
  /** Compiled artifacts ready for Suno */
  artifacts: SunoArtifact[];
  /** Pipeline stage that created this version */
  stage: GenerationStage | null;
  /** Parent version ID for branch/rollback tracking */
  parentVersionId: VersionId | null;
  /** Immutable after finalisation */
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

// ── Structured critic finding ────────────────────────────────────────

export interface CriticFindingRecord {
  id: string;
  jobId: JobId;
  stage: GenerationStage;
  severity: CriticSeverity;
  field: string;
  message: string;
  patchType: PatchType | null;
  suggestedValue: string | null;
  applied: boolean;
  createdAt: string;
}

// ── Structured adjustment ────────────────────────────────────────────

export interface AdjustmentRecord {
  id: string;
  jobId: JobId;
  instruction: string;
  targetStage: GenerationStage | null;
  applied: boolean;
  resultHash: string | null;
  createdAt: string;
  appliedAt: string | null;
}

// ── Suno track ───────────────────────────────────────────────────────

export interface SunoTrack {
  id: string;
  generationId: string;
  index: number;
  audioUrl: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
  duration: number | null;
  title: string | null;
  createdAt: string;
}

// ── Import/Export ────────────────────────────────────────────────────

export interface ProjectExport {
  project: Project;
  jobs: JobExport[];
}

export interface JobExport {
  job: Job;
  versions: Version[];
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

// ── Config schema (server-side only, gitignored) ─────────────────────

export const ConfigSchema = z.object({
  /** Suno API base URL */
  sunoBaseUrl: z.string().url().default("https://api.sunomusic.com/v1"),
  /** Suno auth token */
  sunoAuthToken: z.string().optional(),
  /** Public base URL for callback endpoints */
  publicBaseUrl: z.string().url().optional(),
  /** DB path (absolute or relative to CWD) */
  dbPath: z.string().default("./data/track-forge.db"),
  /** Log level */
  logLevel: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),
  /** Port for HTTP server */
  port: z.number().int().positive().default(3000),
  /** Host to bind (127.0.0.1 for dev safety, 0.0.0.0 for production) */
  host: z.string().default("127.0.0.1"),
  /** Path to built web GUI (set in production for static serving) */
  staticDir: z.string().optional(),
  /** LLM provider config */
  llmProvider: z.enum(["openai", "anthropic", "ollama"]).default("openai"),
  llmApiKey: z.string().optional(),
  llmModel: z.string().default("gpt-4o"),
});

export type Config = z.infer<typeof ConfigSchema>;

// ── Critic types ─────────────────────────────────────────────────────

export const CriticSeverity = {
  Error: "error",
  Warning: "warning",
  Suggestion: "suggestion",
} as const;
export type CriticSeverity = (typeof CriticSeverity)[keyof typeof CriticSeverity];

export const AutoFixPolicy = {
  Required: "required",
  Preferred: "preferred",
  Skipped: "skipped",
} as const;
export type AutoFixPolicy = (typeof AutoFixPolicy)[keyof typeof AutoFixPolicy];

export interface CriticFinding {
  severity: CriticSeverity;
  field: string; // e.g. "style", "lyrics.section.verse"
  message: string;
  autoFixPolicy: AutoFixPolicy;
  /** Patch type for surgical revision */
  patchType?: PatchType;
  /** Suggested replacement value */
  suggestedValue?: string;
}

export const PatchType = {
  ReplaceStyleDescription: "replace_style_description",
  ReplaceNegativeTags: "replace_negative_tags",
  ReplaceLyricsSection: "replace_lyrics_section",
  ReplaceSelectedText: "replace_selected_text",
  InputPatch: "input_patch",
  MergeField: "merge_field",
  RemoveField: "remove_field",
  ReplaceSection: "replace_section",
  InsertSection: "insert_section",
  MergeSectionLines: "merge_section_lines",
  ChangeSectionBars: "change_section_bars",
  ChangeSectionTags: "change_section_tags",
} as const;
export type PatchType = (typeof PatchType)[keyof typeof PatchType];

export interface SurgicalPatch {
  type: PatchType;
  target: string; // section name / selector
  value: string;
  description: string;
}

// ── Reference Interpretation ───────────────────────────────────────────

export interface InterpretedReference {
  sourceHash: SourceHash;
  /** Primary genre detected */
  genre: string;
  /** Subgenre if identifiable */
  subgenre: string | null;
  /** Mood/tone description */
  mood: string;
  /** Tempo feel or BPM range */
  tempo: string;
  /** Key if identifiable */
  key: string | null;
  /** Section structure detected (verse, chorus, etc.) */
  structure: string[];
  /** Instruments or sound sources heard */
  instrumentation: string[];
  /** Production characteristics */
  production: string[];
  /** Lyrical themes and subject matter */
  lyricalThemes: string[];
  /** Rhyme scheme pattern if discernible */
  rhymeScheme: string | null;
  /** Vocal style observations */
  vocalStyle: string | null;
  /** Suggested tags for Suno style prompt */
  suggestedTags: string[];
  /** Tags to explicitly avoid */
  negativeTags: string[];
  /** Full analysis text for prompt context */
  rawAnalysis: string;
}

// ── Style compiler types ─────────────────────────────────────────────

export interface StyleClause {
  key: string;
  value: string;
  /** Fixed ordering ordinal */
  order: number;
}

export interface CompiledStyle {
  description: string;
  tags: string[];
  negativeTags: string[];
  /** Ordered clauses used to build description */
  clauses: StyleClause[];
}
