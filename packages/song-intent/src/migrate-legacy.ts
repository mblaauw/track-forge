import type {
  DescriptorCategory,
  DescriptorWeight,
  SectionFunction,
  Vocal,
} from "@track-forge/genre-core";
import type { LyricsFormat } from "@track-forge/contracts";
import { defaultSongIntent } from "./defaults.js";
import { hashIntent } from "./hash.js";
import type {
  ArrangementSectionIntent,
  IntentDescriptor,
  LyricAngle,
  SongIntentV1,
  StyleInfluence,
} from "./types.js";

/**
 * Shape of a legacy job's persisted inputs, as written by `apps/server/src/routes/jobs.ts`.
 * `inputs` is the post-merge JSON blob (preset values + user overrides).
 *
 * This is intentionally permissive — it's a migration surface, and old jobs
 * may carry fields newer code doesn't recognize. Unknown fields are ignored
 * silently; the schema's `.strict()` only fires when *we* build a fresh
 * SongIntentV1, not when we read legacy data.
 */
export interface LegacyInputs {
  bpm?: unknown;
  key?: unknown;
  scale?: unknown;
  mood?: unknown;
  energy?: unknown;
  complexity?: unknown;
  lyricsMode?: unknown;
  characteristics?: unknown;
  typicalSongStructure?: unknown;
  tempoFeel?: unknown;
  perceivedBpm?: unknown;
  lineDensity?: unknown;
  perspective?: unknown;
  imageAnchors?: unknown;
  narrativeArc?: unknown;
  rhymeStyle?: unknown;
  flowPattern?: unknown;
  vocalStyle?: unknown;
  lyricTopic?: unknown;
  lyricThemes?: unknown;
  lyricAngle?: unknown;
  title?: unknown;
  name?: unknown;
  reference?: unknown;
  excludedStyles?: unknown;
  tags?: unknown;
  sections?: unknown;
  descriptors?: unknown;
  vocalType?: unknown;
}

export interface LegacyJob {
  genreId: string;
  presetId: string;
  /** Stringified JSON of merged preset + user values. */
  inputs: string | null;
}

export interface MigrateLegacyResult {
  intent: SongIntentV1;
  hash: string;
}

/**
 * Convert a legacy job (genreId + presetId + merged JSON inputs) into a
 * canonical `SongIntentV1` with no data loss.
 *
 * Meaningful fields migrate to their typed home; debug/UI state
 * (`lyricLines`, `lyricsGenerated`) is intentionally dropped — those are
 * downstream artifacts, not intent.
 */
export function migrateLegacyJob(job: LegacyJob): MigrateLegacyResult {
  const raw = parseRaw(job.inputs);
  const intent = defaultSongIntent();

  applyIdentity(raw, intent);
  applyStyles(job, intent);
  applyMusical(raw, intent);
  applyVocals(raw, intent);
  applyLyrics(raw, intent);
  applyArrangement(raw, intent);
  applyExclusionsAndRefs(raw, intent);

  return { intent, hash: hashIntent(intent) };
}

// ── Helpers ───────────────────────────────────────────────────────────

function parseRaw(inputs: string | null): LegacyInputs {
  if (!inputs) return {};
  try {
    return JSON.parse(inputs) as LegacyInputs;
  } catch {
    return {};
  }
}

function asNum(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function asStr(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function asStrArr(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x)).filter((s) => s.length > 0);
}

function asArr<T>(
  v: unknown,
  map: (x: unknown, i: number) => T | undefined,
): T[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x, i) => map(x, i))
    .filter((x): x is NonNullable<typeof x> => x !== undefined);
}

function applyIdentity(raw: LegacyInputs, intent: SongIntentV1): void {
  intent.identity.title = asStr(raw.title) ?? asStr(raw.name) ?? "";
}

function applyStyles(job: LegacyJob, intent: SongIntentV1): void {
  // In the legacy model there is one primary preset; Job.presetId carries it.
  if (!job.presetId || !job.genreId) return;
  const influence: StyleInfluence = {
    genreId: job.genreId,
    presetId: job.presetId,
    role: "primary",
    strength: 3,
  };
  intent.styles.push(influence);
}

function applyMusical(raw: LegacyInputs, intent: SongIntentV1): void {
  const m = intent.musical;
  if (asNum(raw.bpm) !== undefined) m.bpm = asNum(raw.bpm);
  if (asStr(raw.tempoFeel)) m.tempoFeel = asStr(raw.tempoFeel);
  if (asNum(raw.perceivedBpm) !== undefined)
    m.perceivedBpm = asNum(raw.perceivedBpm);
  if (asStr(raw.mood)) m.mood = asStr(raw.mood);
  if (asNum(raw.energy) !== undefined) m.energy = asNum(raw.energy);
  if (asNum(raw.complexity) !== undefined) m.complexity = asNum(raw.complexity);
  m.characteristics = asStrArr(raw.characteristics);
  m.descriptors = asArr(raw.descriptors, (x) => mapDescriptor(x));
  // key/scale are optional harmonic hints
  if (asStr(raw.key)) m.key = asStr(raw.key);
  if (raw.scale === "major" || raw.scale === "minor") m.scale = raw.scale;
}

function mapDescriptor(x: unknown): IntentDescriptor | undefined {
  if (!x || typeof x !== "object") return undefined;
  const r = x as Record<string, unknown>;
  if (typeof r.label !== "string" || typeof r.cat !== "string")
    return undefined;
  const cat = r.cat as DescriptorCategory;
  if (!isDescriptorCategory(cat)) return undefined;
  if (typeof r.weight !== "number" || ![1, 2, 3].includes(r.weight))
    return undefined;
  return {
    label: r.label,
    cat,
    weight: r.weight as DescriptorWeight,
  };
}

function isDescriptorCategory(s: string): s is DescriptorCategory {
  return ["sound", "rhythm", "atmosphere", "production", "energy"].includes(s);
}

function applyVocals(raw: LegacyInputs, intent: SongIntentV1): void {
  const v = intent.vocals;
  if (
    raw.lyricsMode === "full_lyrics" ||
    raw.lyricsMode === "strict_instrumental"
  ) {
    v.mode = raw.lyricsMode as LyricsFormat;
  }
  if (asStr(raw.vocalType)) v.type = asStr(raw.vocalType);
  // Per-section vocal overrides come from raw.sections[].vocal
  if (Array.isArray(raw.sections)) {
    for (const sec of raw.sections) {
      if (!sec || typeof sec !== "object") continue;
      const r = sec as Record<string, unknown>;
      const id = typeof r.id === "string" ? r.id : undefined;
      const vocal = mapVocal(r.vocal);
      if (id && vocal) {
        v.sections.push({ sectionId: id, vocal });
      }
    }
  }
}

function mapVocal(v: unknown): Vocal | undefined {
  if (!v || typeof v !== "object") return undefined;
  const r = v as Record<string, unknown>;
  if (
    typeof r.type === "string" &&
    typeof r.delivery === "string" &&
    typeof r.energy === "number" &&
    typeof r.adlibs === "boolean" &&
    typeof r.harmonies === "boolean"
  ) {
    return {
      type: r.type,
      delivery: r.delivery,
      energy: r.energy,
      adlibs: r.adlibs,
      harmonies: r.harmonies,
    };
  }
  return undefined;
}

function applyLyrics(raw: LegacyInputs, intent: SongIntentV1): void {
  const l = intent.lyrics;
  if (asStr(raw.lyricTopic)) l.topic = asStr(raw.lyricTopic);
  l.themes = asStrArr(raw.lyricThemes);
  const angle = asStr(raw.lyricAngle);
  if (angle && isLyricAngle(angle)) l.angle = angle;
  if (asStr(raw.narrativeArc)) l.narrativeArc = asStr(raw.narrativeArc);
  if (asStr(raw.rhymeStyle)) l.rhymeStyle = asStr(raw.rhymeStyle);
  if (asStr(raw.flowPattern)) l.flowPattern = asStr(raw.flowPattern);
  if (asStr(raw.vocalStyle)) l.vocalStyle = asStr(raw.vocalStyle);
  if (asNum(raw.lineDensity) !== undefined)
    l.lineDensity = asNum(raw.lineDensity);
  if (asStr(raw.perspective)) l.perspective = asStr(raw.perspective);
  l.imageAnchors = asStrArr(raw.imageAnchors);
}

function isLyricAngle(s: string): s is LyricAngle {
  return ["first_person", "story", "abstract", "anthemic"].includes(s);
}

function applyArrangement(raw: LegacyInputs, intent: SongIntentV1): void {
  const a = intent.arrangement;
  if (asStrArr(raw.typicalSongStructure).length > 0) {
    a.typicalSongStructure = asStrArr(raw.typicalSongStructure);
  }
  a.sections = asArr(raw.sections, (x) => mapSection(x));
}

function mapSection(x: unknown): ArrangementSectionIntent | undefined {
  if (!x || typeof x !== "object") return undefined;
  const r = x as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id : undefined;
  const name = typeof r.name === "string" ? r.name : undefined;
  if (!id || !name) return undefined;
  const fn = (typeof r.fn === "string" ? r.fn : "establish") as SectionFunction;
  if (!isSectionFunction(fn)) return undefined;
  return {
    id,
    name,
    bars: typeof r.bars === "number" ? r.bars : 0,
    fn,
    deltas: asStrArr(r.deltas),
    tags: asStrArr(r.tags),
    vocal: mapVocal(r.vocal),
  };
}

function isSectionFunction(s: string): s is SectionFunction {
  return [
    "establish",
    "introduce",
    "escalate",
    "contrast",
    "remove",
    "peak",
    "resolve",
  ].includes(s);
}

function applyExclusionsAndRefs(raw: LegacyInputs, intent: SongIntentV1): void {
  // `excludedStyles` in web UI is a comma-joined string; `tags` may be
  // descriptor objects (legacy jobs pre-descriptors field) or exclusion
  // strings. Prefer `excludedStyles`, then detect tags shape.
  const es = asStr(raw.excludedStyles);
  if (es) {
    intent.exclusions = es
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  } else if (Array.isArray(raw.tags) && raw.tags.length > 0) {
    // Detect by examining first item
    if (isDescriptorObj(raw.tags[0])) {
      // Legacy: tags field holds descriptor objects — migrate to musical.descriptors
      if (intent.musical.descriptors.length === 0) {
        intent.musical.descriptors = asArr(raw.tags, (x) => mapDescriptor(x));
      }
    } else {
      // Tags are plain exclusion strings
      intent.exclusions = asStrArr(raw.tags);
    }
  }
  const ref = asStr(raw.reference);
  if (ref) intent.references.push({ text: ref });
}

function isDescriptorObj(v: unknown): boolean {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.label === "string" &&
    typeof r.cat === "string" &&
    typeof r.weight === "number"
  );
}
