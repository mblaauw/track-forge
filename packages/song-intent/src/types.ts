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
