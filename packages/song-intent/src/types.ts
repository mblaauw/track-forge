import type {
  DescriptorCategory,
  DescriptorWeight,
  SectionFunction,
  Vocal,
} from "@track-forge/genre-core";
import type { LyricsFormat } from "@track-forge/contracts";

// ── Style influences ──────────────────────────────────────────────────

export type StyleRole = "primary" | "influence" | "accent";
export type StyleStrength = 1 | 2 | 3;

export interface StyleInfluence {
  genreId: string;
  presetId: string;
  role: StyleRole;
  strength: StyleStrength;
  /** Restrict an influence to specific section ids; undefined = apply globally. */
  sectionIds?: string[];
}

// ── Musical identity ──────────────────────────────────────────────────

export interface IntentDescriptor {
  label: string;
  cat: DescriptorCategory;
  weight: DescriptorWeight;
}

export interface MusicalIntent {
  bpm?: number;
  tempoFeel?: string;
  perceivedBpm?: number;
  mood?: string;
  energy?: number;
  complexity?: number;
  characteristics: string[];
  descriptors: IntentDescriptor[];
  /** Optional harmonic hint — not required by any stage today. */
  key?: string;
  scale?: "major" | "minor";
}

// ── Vocals ───────────────────────────────────────────────────────────

export interface VocalSectionOverride {
  sectionId: string;
  vocal: Vocal;
}

export interface VocalIntent {
  mode: LyricsFormat;
  /** Preset vocal type id (e.g. "female_lead"), if any. */
  type?: string;
  /** Per-section vocal overrides keyed by section id. */
  sections: VocalSectionOverride[];
}

// ── Lyrics ────────────────────────────────────────────────────────────

export type LyricAngle = "first_person" | "story" | "abstract" | "anthemic";

export interface LyricsIntent {
  topic?: string;
  themes: string[];
  angle?: LyricAngle;
  /** Genre-specific narrative arc (e.g. "braggadocio"). */
  narrativeArc?: string;
  rhymeStyle?: string;
  flowPattern?: string;
  vocalStyle?: string;
  /** Lines-per-bar ratio (1 = 1 line/bar, 0.5 = 1 line/2 bars). */
  lineDensity?: number;
  perspective?: string;
  imageAnchors: string[];
}

// ── Arrangement ────────────────────────────────────────────────────────

export type ArrangeSource = "default" | "custom";

export interface ArrangementSectionIntent {
  /** Stable id used to map generated lines back onto this section. */
  id: string;
  /** Display name, e.g. "Verse", "Build 2". */
  name: string;
  bars: number;
  fn: SectionFunction;
  deltas: string[];
  tags: string[];
  vocal?: Vocal;
}

export interface ArrangementIntent {
  source: ArrangeSource;
  sections: ArrangementSectionIntent[];
  /** Optional genre-typical structure list (e.g. ["intro","build","drop"]). */
  typicalSongStructure?: string[];
}

// ── References & exclusions ───────────────────────────────────────────

export interface ReferenceIntent {
  text: string;
}

// ── Materialization ───────────────────────────────────────────────────

export interface IntentSource {
  kind: "default" | "preset" | "user" | "derived";
  /** Preset id when `kind === "preset"`. */
  id?: string;
  value: unknown;
}

export interface MaterializationWarning {
  message: string;
  path?: string;
  severity: "info" | "warning" | "error";
}

export interface MaterializedIntent {
  intent: SongIntentV1;
  /** Flat provenance per JSON path (e.g. `"/musical/energy"`). */
  provenance: Record<string, IntentSource[]>;
  warnings: MaterializationWarning[];
}

/**
 * Draft intent: the user's selections before any defaults or preset values
 * are applied. `userValues` are typed `Partial<SongIntentV1>` fields that
 * should override preset-derived values. `userFlat` is an alternative for
 * callers that carry flat Record<string,unknown> inputs (e.g. the create-job
 * route); these are applied AFTER `userValues` with the same "user" kind.
 */
export interface SongIntentDraft {
  selectedStyles: StyleInfluence[];
  userValues: Partial<SongIntentV1>;
  userFlat?: Record<string, unknown>;
}

/**
 * Catalog of preset data used during materialization. The caller (server
 * route) provides this from YAML config; the function stays pure.
 */
export interface PresetCatalog {
  getPreset(
    genreId: string,
    presetId: string,
  ):
    | {
        name: string;
        values: Record<string, unknown>;
      }
    | undefined;
}

// ── Resolved intent (post-resolver) ──────────────────────────────────

export interface ResolvedVocals {
  mode: LyricsFormat;
  hasLeadVocal: boolean;
  type?: string;
  sectionOverrides: VocalSectionOverride[];
}

export interface ResolvedLyrics {
  /** Whether the lyrics writer should actually write lyrics. */
  shouldWrite: boolean;
  topic?: string;
  themes: string[];
  angle?: LyricAngle;
  narrativeArc?: string;
  rhymeStyle?: string;
  flowPattern?: string;
  vocalStyle?: string;
  lineDensity?: number;
  perspective?: string;
  imageAnchors: string[];
}

export interface ResolvedSection {
  id: string;
  name: string;
  bars: number;
  fn: SectionFunction;
  deltas: string[];
  tags: string[];
  vocal?: Vocal;
}

export interface MoodArc {
  label: string;
  sections: string[];
  energy: number;
}

export interface ResolvedArrangement {
  sections: ResolvedSection[];
  typicalSongStructure?: string[];
  arcs: MoodArc[];
}

export interface ResolvedTrait {
  name: string;
  description: string;
  category: string;
}

export type ConflictSeverity = "warning" | "error";

export interface IntentConflict {
  message: string;
  path?: string;
  severity: ConflictSeverity;
}

export interface ResolutionDecision {
  message: string;
  path?: string;
}

export interface ResolvedSongIntent {
  schemaVersion: 1;
  identity: { title: string };
  styles: StyleInfluence[];

  /** Resolved BPM (materialized or defaulted to 128). */
  bpm: number;
  tempoFeel?: string;
  perceivedBpm?: number;
  mood?: string;
  energy?: number;
  complexity?: number;
  characteristics: string[];
  descriptors: IntentDescriptor[];
  key?: string;
  scale?: "major" | "minor";

  vocals: ResolvedVocals;
  lyrics: ResolvedLyrics;
  arrangement: ResolvedArrangement;

  traits: ResolvedTrait[];
  conflicts: IntentConflict[];
  decisions: ResolutionDecision[];

  exclusions: string[];
  references: ReferenceIntent[];
}

// ── Canonical SongIntentV1 ────────────────────────────────────────────

export interface SongIntentV1 {
  schemaVersion: 1;
  identity: { title: string };
  styles: StyleInfluence[];
  musical: MusicalIntent;
  vocals: VocalIntent;
  lyrics: LyricsIntent;
  arrangement: ArrangementIntent;
  exclusions: string[];
  references: ReferenceIntent[];
}
