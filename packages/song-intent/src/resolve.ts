import type {
  MaterializedIntent,
  ResolvedSongIntent,
  ResolvedVocals,
  ResolvedLyrics,
  ResolvedArrangement,
  ResolvedSection,
  ResolvedTrait,
  IntentConflict,
  ResolutionDecision,
  MoodArc,
} from "./types.js";

/**
 * Pure-function resolver: takes a `MaterializedIntent` and returns a
 * `ResolvedSongIntent` with normalized values, derived traits, detected
 * conflicts, and resolution decisions.
 *
 * Rules implemented (constraint: only rules with observable behavior
 * in current Track-Forge presets):
 *
 *   1. strict_instrumental → no lead vocal, no lyrical sections,
 *      add vocal exclusions
 *   2. high energy + multiple peak sections → increasing peak arc
 *   3. intimate vocal + dense arrangement → flag as creative tension
 *   4. multiple primary styles → error
 *
 * Callers MUST set `genreName` and `presetLabels` on the result before
 * passing it to `renderSunoStyle()`.
 *
 * Future rules are TODOs with failing tests, not unimplemented code.
 */
/**
 * Build resolved exclusions from intent exclusions + resolved vocals.
 * strict_instrumental mode adds vocal exclusions automatically (silent
 * derivation — not a conflict, just a normalization step).
 */
function buildExclusions(
  rawExclusions: string[],
  vocals: ResolvedVocals,
): string[] {
  const result = [...rawExclusions];
  if (vocals.mode === "strict_instrumental") {
    const vocalTags = ["vocals", "singing", "lyrics", "voice"];
    for (const tag of vocalTags) {
      if (!result.some((e) => e.toLowerCase() === tag)) {
        result.push(tag);
      }
    }
  }
  return result;
}

export function resolveSongIntent(
  materialized: MaterializedIntent,
): ResolvedSongIntent {
  const intent = materialized.intent;
  const conflicts: IntentConflict[] = [];
  const decisions: ResolutionDecision[] = [];
  const traits: ResolvedTrait[] = [];

  // Carry materialization warnings into resolved result as info-level conflicts
  for (const w of materialized.warnings ?? []) {
    conflicts.push({
      message: w.message,
      path: "",
      severity: w.severity === "error" ? "error" : "warning",
    });
  }

  // ── Base resolution ──────────────────────────────────────────────────

  const bpm = intent.musical.bpm ?? 128;
  const sections = intent.arrangement.sections.map(resolveSection);
  const vocals = resolveVocals(intent, conflicts, traits);
  const lyrics = resolveLyrics(intent, vocals, conflicts);
  const arrangement = resolveArrangement(
    sections,
    intent,
    conflicts,
    traits,
    decisions,
  );

  resolvePrimaryStyleConflict(intent, conflicts);
  resolveIntimateVocalDenseArrangement(vocals, sections, traits, conflicts);

  // RULE 1 (continued): strict_instrumental → add vocal exclusions to
  // resolved exclusions so downstream stages don't have to derive them.
  const exclusions = buildExclusions(intent.exclusions, vocals);

  return {
    schemaVersion: 1,
    identity: intent.identity,
    styles: [...intent.styles],
    genreName: "",
    presetLabels: [],

    bpm,
    tempoFeel: intent.musical.tempoFeel,
    perceivedBpm: intent.musical.perceivedBpm,
    mood: intent.musical.mood,
    energy: intent.musical.energy,
    complexity: intent.musical.complexity,
    characteristics: [...intent.musical.characteristics],
    descriptors: [...intent.musical.descriptors],
    key: intent.musical.key,
    scale: intent.musical.scale,

    vocals,
    lyrics,
    arrangement,

    traits,
    conflicts,
    decisions,

    exclusions,
    references: [...intent.references],
  };
}

// ── Helpers ───────────────────────────────────────────────────────────

function resolveSection(s: ResolvedSection): ResolvedSection {
  return {
    ...s,
    bars: s.bars > 0 ? s.bars : 8,
    deltas: [...(s.deltas ?? [])],
    tags: [...(s.tags ?? [])],
  };
}

function resolveVocals(
  intent: MaterializedIntent["intent"],
  conflicts: IntentConflict[],
  traits: ResolvedTrait[],
): ResolvedVocals {
  const mode = intent.vocals.mode;
  const hasVocalOverrides = intent.vocals.sections.length > 0;

  // RULE 1: strict_instrumental → no lead vocal, add vocal exclusions
  if (mode === "strict_instrumental" && !hasVocalOverrides) {
    traits.push({
      name: "instrumental",
      description:
        "No vocal content — purely instrumental arrangement. Suno prompt excludes vocals.",
      category: "arrangement",
    });
    return {
      mode: "strict_instrumental",
      hasLeadVocal: false,
      type: intent.vocals.type,
      sectionOverrides: [...intent.vocals.sections],
    };
  }

  if (mode === "strict_instrumental" && hasVocalOverrides) {
    // Instrumental mode with vocal overrides — contradictory but the
    // overrides can still produce a hybrid result (e.g. spoken word).
    conflicts.push({
      message: "Instrumental lyrics mode but sections have vocal overrides",
      path: "/vocals/mode",
      severity: "warning",
    });
  }

  return {
    mode,
    hasLeadVocal: mode === "full_lyrics" || hasVocalOverrides,
    type: intent.vocals.type,
    sectionOverrides: [...intent.vocals.sections],
  };
}

function resolveLyrics(
  intent: MaterializedIntent["intent"],
  vocals: ResolvedVocals,
  _conflicts: IntentConflict[],
): ResolvedLyrics {
  const l = intent.lyrics;
  return {
    shouldWrite: vocals.hasLeadVocal,
    topic: l.topic,
    themes: [...l.themes],
    angle: l.angle,
    narrativeArc: l.narrativeArc,
    rhymeStyle: l.rhymeStyle,
    flowPattern: l.flowPattern,
    vocalStyle: l.vocalStyle,
    lineDensity: l.lineDensity,
    perspective: l.perspective,
    imageAnchors: [...l.imageAnchors],
  };
}

function resolveArrangement(
  sections: ResolvedSection[],
  intent: MaterializedIntent["intent"],
  conflicts: IntentConflict[],
  traits: ResolvedTrait[],
  decisions: ResolutionDecision[],
): ResolvedArrangement {
  const energy = intent.musical.energy;
  const arcs: MoodArc[] = [];

  // RULE 2: high energy + multiple peak sections → increasing peak arc.
  const peakSections = sections.filter((s) => s.fn === "peak");
  if (energy !== undefined && energy >= 7 && peakSections.length >= 2) {
    arcs.push({
      label: "increasing peak",
      sections: peakSections.map((s) => s.id),
      energy,
    });
    decisions.push({
      message: `Derived increasing-peak arc from energy ${energy} and ${peakSections.length} peak sections`,
      path: "/arrangement/arcs",
    });
    traits.push({
      name: "increasing-peak-arc",
      description:
        "High energy with multiple peak sections — energy builds through the track towards each successive peak",
      category: "arrangement",
    });
  }

  return {
    sections,
    typicalSongStructure: intent.arrangement.typicalSongStructure
      ? [...intent.arrangement.typicalSongStructure]
      : undefined,
    arcs,
  };
}

function resolvePrimaryStyleConflict(
  intent: MaterializedIntent["intent"],
  conflicts: IntentConflict[],
): void {
  const primaryCount = intent.styles.filter((s) => s.role === "primary").length;
  if (primaryCount > 1) {
    conflicts.push({
      message: `Multiple primary styles (${primaryCount}) — only the last-primary values take effect for conflicting fields`,
      path: "/styles",
      severity: "error",
    });
  }
}

// RULE 3: intimate vocal + dense arrangement → creative tension.
function resolveIntimateVocalDenseArrangement(
  vocals: ResolvedVocals,
  sections: ResolvedSection[],
  traits: ResolvedTrait[],
  conflicts: IntentConflict[],
): void {
  if (!vocals.hasLeadVocal) return;
  const hasFullArrangement = sections.some(
    (s) =>
      s.tags.includes("full groove") ||
      s.tags.includes("full arrangement") ||
      s.tags.includes("bass-led") ||
      s.tags.includes("added impact"),
  );
  if (vocals.type === "female_lead" || vocals.type === "male_lead") {
    // Known intimate vocal styles in intimate arrangements
    const intimateDelivery = sections.some(
      (s) => s.vocal?.delivery === "intimate" || s.vocal?.delivery === "soft",
    );
    if (intimateDelivery && hasFullArrangement) {
      traits.push({
        name: "vocal-arrangement-tension",
        description:
          "Intimate vocal against dense arrangement — may need side-chain or frequency carving in production",
        category: "mix",
      });
      conflicts.push({
        message:
          "Intimate vocal delivery against a dense arrangement — may require mix adjustments (side-chain, frequency carving)",
        path: "/arrangement/sections",
        severity: "warning",
      });
    }
  }
}
