import { defaultSongIntent } from "./defaults.js";
import type {
  SongIntentDraft,
  MaterializedIntent,
  IntentSource,
  MaterializationWarning,
  PresetCatalog,
  StyleRole,
  SongIntentV1,
  ArrangementSectionIntent,
  VocalSectionOverride,
  MusicalIntent,
  VocalIntent,
  LyricsIntent,
  ArrangementIntent,
  IntentDescriptor,
} from "./types.js";

// ── Public API ────────────────────────────────────────────────────────

/**
 * Given a user's draft selections (styles + typed partial values) and a
 * preset catalog, produce a materialized `SongIntentV1` with full provenance
 * tracking and conflict warnings.
 *
 * Materialization order:
 *   1. default `SongIntentV1`
 *   2. preset recipe values (from catalog, per `selectedStyles`)
 *   3. explicit `userValues`
 *
 * Provenance is a flat `Record<string, IntentSource[]>` — not a DAG.
 */
export function materializeIntent(
  draft: SongIntentDraft,
  catalog: PresetCatalog,
): MaterializedIntent {
  const provenance: Record<string, IntentSource[]> = {};
  const warnings: MaterializationWarning[] = [];
  const intent = defaultSongIntent();

  const record = (path: string, source: IntentSource) => {
    if (!provenance[path]) provenance[path] = [];
    provenance[path].push(source);
  };

  // 1. Apply preset values for each selected style (in order)
  for (const style of draft.selectedStyles) {
    const preset = catalog.getPreset(style.genreId, style.presetId);
    if (!preset) {
      // Check if this should be primary-based or section-scoped warning
      continue;
    }
    applyLegacyValues(
      intent,
      preset.values,
      { kind: "preset", id: style.presetId },
      record,
    );
  }

  // 2. Detect multiple-primary conflict AFTER all presets are applied.
  const primaryCount = draft.selectedStyles.filter(
    (s) => s.role === "primary",
  ).length;
  if (primaryCount > 1) {
    warnings.push({
      message: `Multiple primary styles (${primaryCount}) — only the last-primary values take effect for conflicting fields`,
      severity: "warning",
    });
  }

  // 3. Apply typed user values (these win over presets).
  applyPartialIntent(intent, draft.userValues, { kind: "user" }, record);

  // 3b. Apply flat user values on top (e.g. from create-job route inputs).
  if (draft.userFlat) {
    applyLegacyValues(intent, draft.userFlat, { kind: "user" }, record);
  }

  // 4. Carry style influences into the intent.
  intent.styles = draft.selectedStyles;

  // 5. Inherit identity title from user values if present.
  if (draft.userValues.identity?.title) {
    intent.identity.title = draft.userValues.identity.title;
  }

  return { intent, provenance, warnings };
}

/**
 * Flatten a materialized SongIntentV1 back to the legacy flat
 * `Record<string, unknown>` so existing pipeline code that reads
 * `jobs.inputs` still works. This is the inverse of the per-field
 * assignments in `applyLegacyValues` — not of `migrateLegacyJob`
 * (which also handles styles/identity logic on top).
 *
 * Only includes fields the legacy pipeline recognises; debug state
 * (lyricLines, lyricsGenerated) is intentionally absent.
 */
export function flattenIntentToInputs(
  intent: SongIntentV1,
): Record<string, unknown> {
  const m = intent.musical;
  const v = intent.vocals;
  const l = intent.lyrics;
  const a = intent.arrangement;
  const result: Record<string, unknown> = {
    title: intent.identity.title || undefined,
    bpm: m.bpm,
    key: m.key,
    scale: m.scale,
    mood: m.mood,
    energy: m.energy,
    complexity: m.complexity,
    tempoFeel: m.tempoFeel,
    perceivedBpm: m.perceivedBpm,
    lyricsMode: v.mode,
    vocalType: v.type || undefined,
    lyricTopic: l.topic,
    lyricThemes: l.themes.length > 0 ? l.themes : undefined,
    lyricAngle: l.angle,
    narrativeArc: l.narrativeArc,
    rhymeStyle: l.rhymeStyle,
    flowPattern: l.flowPattern,
    vocalStyle: l.vocalStyle,
    lineDensity: l.lineDensity,
    perspective: l.perspective,
    imageAnchors: l.imageAnchors.length > 0 ? l.imageAnchors : undefined,
    characteristics:
      m.characteristics.length > 0 ? m.characteristics : undefined,
    typicalSongStructure: a.typicalSongStructure,
    excludedStyles:
      intent.exclusions.length > 0 ? intent.exclusions.join(", ") : undefined,
    reference:
      intent.references.length > 0 ? intent.references[0]!.text : undefined,
    sections: a.sections.length > 0 ? (a.sections as unknown[]) : undefined,
    descriptors:
      m.descriptors.length > 0 ? (m.descriptors as unknown[]) : undefined,
  };
  cleanEmpty(result);
  return result;
}

// ── Internal helpers ──────────────────────────────────────────────────

function cleanEmpty(o: Record<string, unknown>): void {
  for (const k of Object.keys(o)) {
    if (o[k] === undefined || o[k] === null) delete o[k];
  }
}

type ProvenanceRecorder = (path: string, source: IntentSource) => void;

function withValue(
  source: Omit<IntentSource, "value">,
  val: unknown,
): IntentSource {
  return { ...source, value: val };
}

/** Apply a flat `Record<string, unknown>` (e.g. preset `.values`) to an intent. */
function applyLegacyValues(
  intent: SongIntentV1,
  values: Record<string, unknown>,
  source: Omit<IntentSource, "value">,
  record: ProvenanceRecorder,
): void {
  const v = values;
  const m = intent.musical;
  const voc = intent.vocals;
  const l = intent.lyrics;
  const a = intent.arrangement;

  applyNum(v.bpm, (x) => {
    m.bpm = x;
    record("/musical/bpm", withValue(source, x));
  });
  applyNum(v.energy, (x) => {
    m.energy = x;
    record("/musical/energy", withValue(source, x));
  });
  applyNum(v.complexity, (x) => {
    m.complexity = x;
    record("/musical/complexity", withValue(source, x));
  });
  applyNum(v.perceivedBpm, (x) => {
    m.perceivedBpm = x;
    record("/musical/perceivedBpm", withValue(source, x));
  });
  applyNum(v.lineDensity, (x) => {
    l.lineDensity = x;
    record("/lyrics/lineDensity", withValue(source, x));
  });
  applyStr(v.mood, (x) => {
    m.mood = x;
    record("/musical/mood", withValue(source, x));
  });
  applyStr(v.tempoFeel, (x) => {
    m.tempoFeel = x;
    record("/musical/tempoFeel", withValue(source, x));
  });
  applyStr(v.key, (x) => {
    m.key = x;
    record("/musical/key", withValue(source, x));
  });
  applyStr(v.lyricTopic, (x) => {
    l.topic = x;
    record("/lyrics/topic", withValue(source, x));
  });
  applyStr(v.lyricAngle, (x) => {
    l.angle = x as any;
    record("/lyrics/angle", withValue(source, x));
  });
  applyStr(v.narrativeArc, (x) => {
    l.narrativeArc = x;
    record("/lyrics/narrativeArc", withValue(source, x));
  });
  applyStr(v.rhymeStyle, (x) => {
    l.rhymeStyle = x;
    record("/lyrics/rhymeStyle", withValue(source, x));
  });
  applyStr(v.flowPattern, (x) => {
    l.flowPattern = x;
    record("/lyrics/flowPattern", withValue(source, x));
  });
  applyStr(v.vocalStyle, (x) => {
    l.vocalStyle = x;
    record("/lyrics/vocalStyle", withValue(source, x));
  });
  applyStr(v.perspective, (x) => {
    l.perspective = x;
    record("/lyrics/perspective", withValue(source, x));
  });
  applyStr(v.reference, (x) => {
    intent.references = [{ text: x }];
    record("/references/0/text", withValue(source, x));
  });

  if (v.scale === "major" || v.scale === "minor") {
    m.scale = v.scale;
    record("/musical/scale", withValue(source, v.scale));
  }
  if (
    v.lyricsMode === "full_lyrics" ||
    v.lyricsMode === "strict_instrumental"
  ) {
    voc.mode = v.lyricsMode;
    record("/vocals/mode", withValue(source, v.lyricsMode));
  }

  applyStr(v.vocalType, (x) => {
    voc.type = x;
    record("/vocals/type", withValue(source, x));
  });

  if (Array.isArray(v.characteristics)) {
    m.characteristics = v.characteristics.map(String);
    record("/musical/characteristics", withValue(source, m.characteristics));
  }
  if (Array.isArray(v.lyricThemes)) {
    l.themes = v.lyricThemes.map(String);
    record("/lyrics/themes", withValue(source, l.themes));
  }
  if (Array.isArray(v.imageAnchors)) {
    l.imageAnchors = v.imageAnchors.map(String);
    record("/lyrics/imageAnchors", withValue(source, l.imageAnchors));
  }
  if (Array.isArray(v.typicalSongStructure)) {
    a.typicalSongStructure = v.typicalSongStructure.map(String);
    record(
      "/arrangement/typicalSongStructure",
      withValue(source, a.typicalSongStructure),
    );
  }
  if (Array.isArray(v.descriptors)) {
    const descs: IntentDescriptor[] = [];
    for (const d of v.descriptors) {
      if (d && typeof d === "object") {
        const r = d as Record<string, unknown>;
        if (
          typeof r.label === "string" &&
          typeof r.cat === "string" &&
          typeof r.weight === "number"
        ) {
          descs.push({
            label: r.label,
            cat: r.cat as any,
            weight: r.weight as any,
          });
        }
      }
    }
    m.descriptors = descs;
    record("/musical/descriptors", withValue(source, descs));
  }
  if (Array.isArray(v.sections)) {
    const secs: ArrangementSectionIntent[] = [];
    const overrides: VocalSectionOverride[] = [];
    for (const s of v.sections) {
      if (!s || typeof s !== "object") continue;
      const r = s as Record<string, unknown>;
      const id = typeof r.id === "string" ? r.id : undefined;
      const name = typeof r.name === "string" ? r.name : undefined;
      if (!id || !name) continue;
      const fn = (typeof r.fn === "string" ? r.fn : "establish") as any;
      const sec: ArrangementSectionIntent = {
        id,
        name,
        bars: typeof r.bars === "number" ? r.bars : 0,
        fn,
        deltas: Array.isArray(r.deltas) ? r.deltas.map(String) : [],
        tags: Array.isArray(r.tags) ? r.tags.map(String) : [],
      };
      if (r.vocal && typeof r.vocal === "object") {
        const vr = r.vocal as Record<string, unknown>;
        if (typeof vr.type === "string") {
          sec.vocal = {
            type: vr.type,
            delivery: String(vr.delivery ?? ""),
            energy: typeof vr.energy === "number" ? vr.energy : 0,
            adlibs: vr.adlibs === true,
            harmonies: vr.harmonies === true,
          };
          overrides.push({ sectionId: id, vocal: sec.vocal });
        }
      }
      secs.push(sec);
    }
    a.sections = secs;
    voc.sections = overrides;
    record("/arrangement/sections", withValue(source, secs));
  }
  // excludedStyles as comma-joined string or array.
  const exc = v.excludedStyles;
  if (typeof exc === "string") {
    intent.exclusions = exc
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    record("/exclusions", withValue(source, intent.exclusions));
  } else if (Array.isArray(exc)) {
    intent.exclusions = exc.map(String);
    record("/exclusions", withValue(source, intent.exclusions));
  }
  // tags (used as a negative-list fallback in legacy).
  if (typeof exc !== "string" && Array.isArray(v.tags)) {
    // Only apply if excludedStyles wasn't already set.
    if (intent.exclusions.length === 0) {
      intent.exclusions = v.tags.map(String);
      record("/exclusions", withValue(source, intent.exclusions));
    }
  }
  if (typeof v.name === "string" && v.name) {
    intent.identity.title = v.name;
    record("/identity/title", withValue(source, v.name));
  } else if (typeof v.title === "string" && v.title) {
    intent.identity.title = v.title;
    record("/identity/title", withValue(source, v.title));
  }
}

/** Apply a typed `Partial<SongIntentV1>` on top of an existing intent (user overrides). */
function applyPartialIntent(
  intent: SongIntentV1,
  partial: Partial<SongIntentV1>,
  source: Omit<IntentSource, "value">,
  record: ProvenanceRecorder,
): void {
  if (partial.musical)
    applyPartialMusical(intent.musical, partial.musical, source, record);
  if (partial.vocals)
    applyPartialVocals(intent.vocals, partial.vocals, source, record);
  if (partial.lyrics)
    applyPartialLyrics(intent.lyrics, partial.lyrics, source, record);
  if (partial.arrangement)
    applyPartialArrangement(
      intent.arrangement,
      partial.arrangement,
      source,
      record,
    );
  if (partial.exclusions) {
    intent.exclusions = partial.exclusions;
    record("/exclusions", withValue(source, partial.exclusions));
  }
  if (partial.identity?.title) {
    intent.identity.title = partial.identity.title;
    record("/identity/title", withValue(source, partial.identity.title));
  }
}

function applyPartialMusical(
  m: MusicalIntent,
  p: Partial<MusicalIntent>,
  source: Omit<IntentSource, "value">,
  record: ProvenanceRecorder,
): void {
  if (p.bpm !== undefined) {
    m.bpm = p.bpm;
    record("/musical/bpm", withValue(source, p.bpm));
  }
  if (p.tempoFeel !== undefined) {
    m.tempoFeel = p.tempoFeel;
    record("/musical/tempoFeel", withValue(source, p.tempoFeel));
  }
  if (p.mood !== undefined) {
    m.mood = p.mood;
    record("/musical/mood", withValue(source, p.mood));
  }
  if (p.energy !== undefined) {
    m.energy = p.energy;
    record("/musical/energy", withValue(source, p.energy));
  }
  if (p.complexity !== undefined) {
    m.complexity = p.complexity;
    record("/musical/complexity", withValue(source, p.complexity));
  }
  if (p.key !== undefined) {
    m.key = p.key;
    record("/musical/key", withValue(source, p.key));
  }
  if (p.scale !== undefined) {
    m.scale = p.scale;
    record("/musical/scale", withValue(source, p.scale));
  }
  if (p.perceivedBpm !== undefined) {
    m.perceivedBpm = p.perceivedBpm;
    record("/musical/perceivedBpm", withValue(source, p.perceivedBpm));
  }
  if (p.characteristics) {
    m.characteristics = p.characteristics;
    record("/musical/characteristics", withValue(source, p.characteristics));
  }
  if (p.descriptors) {
    m.descriptors = p.descriptors;
    record("/musical/descriptors", withValue(source, p.descriptors));
  }
}

function applyPartialVocals(
  v: VocalIntent,
  p: Partial<VocalIntent>,
  source: Omit<IntentSource, "value">,
  record: ProvenanceRecorder,
): void {
  if (p.mode !== undefined) {
    v.mode = p.mode;
    record("/vocals/mode", withValue(source, p.mode));
  }
  if (p.type !== undefined) {
    v.type = p.type;
    record("/vocals/type", withValue(source, p.type));
  }
  if (p.sections) {
    v.sections = p.sections;
    record("/vocals/sections", withValue(source, p.sections));
  }
}

function applyPartialLyrics(
  l: LyricsIntent,
  p: Partial<LyricsIntent>,
  source: Omit<IntentSource, "value">,
  record: ProvenanceRecorder,
): void {
  if (p.topic !== undefined) {
    l.topic = p.topic;
    record("/lyrics/topic", withValue(source, p.topic));
  }
  if (p.themes) {
    l.themes = p.themes;
    record("/lyrics/themes", withValue(source, p.themes));
  }
  if (p.angle !== undefined) {
    l.angle = p.angle;
    record("/lyrics/angle", withValue(source, p.angle));
  }
  if (p.narrativeArc !== undefined) {
    l.narrativeArc = p.narrativeArc;
    record("/lyrics/narrativeArc", withValue(source, p.narrativeArc));
  }
  if (p.rhymeStyle !== undefined) {
    l.rhymeStyle = p.rhymeStyle;
    record("/lyrics/rhymeStyle", withValue(source, p.rhymeStyle));
  }
  if (p.flowPattern !== undefined) {
    l.flowPattern = p.flowPattern;
    record("/lyrics/flowPattern", withValue(source, p.flowPattern));
  }
  if (p.vocalStyle !== undefined) {
    l.vocalStyle = p.vocalStyle;
    record("/lyrics/vocalStyle", withValue(source, p.vocalStyle));
  }
  if (p.lineDensity !== undefined) {
    l.lineDensity = p.lineDensity;
    record("/lyrics/lineDensity", withValue(source, p.lineDensity));
  }
  if (p.perspective !== undefined) {
    l.perspective = p.perspective;
    record("/lyrics/perspective", withValue(source, p.perspective));
  }
  if (p.imageAnchors) {
    l.imageAnchors = p.imageAnchors;
    record("/lyrics/imageAnchors", withValue(source, p.imageAnchors));
  }
}

function applyPartialArrangement(
  a: ArrangementIntent,
  p: Partial<ArrangementIntent>,
  source: Omit<IntentSource, "value">,
  record: ProvenanceRecorder,
): void {
  if (p.source !== undefined) {
    a.source = p.source;
    record("/arrangement/source", withValue(source, p.source));
  }
  if (p.sections) {
    a.sections = p.sections;
    record("/arrangement/sections", withValue(source, p.sections));
  }
  if (p.typicalSongStructure) {
    a.typicalSongStructure = p.typicalSongStructure;
    record(
      "/arrangement/typicalSongStructure",
      withValue(source, p.typicalSongStructure),
    );
  }
}

// ── Value-coercion helpers ────────────────────────────────────────────

function applyNum(raw: unknown, fn: (v: number) => void): void {
  if (typeof raw === "number" && Number.isFinite(raw)) fn(raw);
}
function applyStr(raw: unknown, fn: (v: string) => void): void {
  if (typeof raw === "string" && raw.length > 0) fn(raw);
}
