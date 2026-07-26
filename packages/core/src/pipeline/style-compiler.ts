/**
 * Pure-function style compiler — single source of truth for the Suno style prompt.
 *
 * Used by:
 *  - POST /api/preview-style (unsaved sessions)
 *  - POST /api/jobs/:id/preview-style (saved sessions)
 *  - compilation pipeline stage
 *
 * The fixed ordering contract is documented in LOGIC_AND_ALGORITHMS.md § compiledStyle().
 * Changing the order here changes what the UI preview shows AND what the pipeline sends to Suno.
 */

import type { ResolvedSongIntent } from "@track-forge/song-intent";

export interface CompileStyleInput {
  genreName: string;
  presetLabels: string[];
  descriptors: { label: string; cat: string; weight: number }[];
  bpm: number;
  sections: { name: string; fn: string }[];
  lyricsMode: "full_lyrics" | "strict_instrumental";
  vocalType?: string;
  tempoFeel?: string;
  flowPattern?: string;
  /** Preset/job mood text (e.g. "euphoric and building") folded into the mood arc when not already covered by descriptors. */
  presetMood?: string;
  /** Preset/job energy 1-10, folded into the mood arc when no energy-category descriptors are active. */
  presetEnergy?: number;
  /** Genre characteristics from the preset (e.g. "hard drums", "1990s era", "intense delivery"). Merged into the character part. */
  characteristics?: string[];
}

export interface CompileStyleResult {
  style: string;
  charCount: number;
  activeCount: number;
}

export function compileStylePrompt(
  input: CompileStyleInput,
): CompileStyleResult {
  // Deprecated — delegates to renderSunoStyle for backwards compat.
  // The resolved-intent path provides richer data (Hip-Hop vocals, mood arcs).
  // Will be removed entirely in a future major version.
  return renderSunoStyle({
    schemaVersion: 1 as const,
    identity: { title: "" },
    styles: [],
    genreName: input.genreName,
    presetLabels: input.presetLabels,
    bpm: input.bpm,
    tempoFeel: input.tempoFeel,
    perceivedBpm: undefined,
    mood: input.presetMood,
    energy: input.presetEnergy,
    complexity: undefined,
    characteristics: input.characteristics ?? [],
    descriptors: input.descriptors as any,
    key: undefined,
    scale: undefined as any,
    vocals: {
      mode: input.lyricsMode as any,
      hasLeadVocal: input.lyricsMode === "full_lyrics",
      type: input.vocalType,
      sectionOverrides: [],
    },
    lyrics: {
      shouldWrite: input.lyricsMode === "full_lyrics",
      topic: undefined,
      themes: [],
      angle: undefined,
      narrativeArc: undefined,
      rhymeStyle: undefined,
      flowPattern: input.flowPattern,
      vocalStyle: undefined,
      lineDensity: undefined,
      perspective: undefined,
      imageAnchors: [],
    },
    arrangement: {
      sections: input.sections.map((s) => ({
        id: s.name,
        name: s.name,
        bars: 8,
        fn: s.fn as any,
        deltas: [],
        tags: [],
      })),
      typicalSongStructure: undefined,
      arcs: [],
    },
    traits: [],
    conflicts: [],
    decisions: [],
    exclusions: [],
    references: [],
  });
}

/* ── Compile steps ─────────────────────────────────────────────────── */

function compileCore(genreName: string, presetLabels: string[]): string {
  if (presetLabels.length > 0) {
    return `${genreName} — ${presetLabels.join(", ")}`;
  }
  return genreName;
}

function compileRhythm(
  active: { label: string; cat: string }[],
  bpm: number,
  tempoFeel?: string,
  flowPattern?: string,
  presetMood?: string,
): string {
  const rhythm = active.filter((d) => d.cat === "rhythm").map((d) => d.label);
  const rhythmStr = rhythm.length > 0 ? rhythm.join(", ") : "";
  const moodWord = presetMood?.toLowerCase().split(/[\s,;]+/)[0] ?? "";
  const VALID_MOODS = [
    "dark",
    "warm",
    "bright",
    "cold",
    "hype",
    "tense",
    "soulful",
    "dreamy",
    "deep",
    "aggressive",
    "catchy",
    "funky",
    "euphoric",
    "gritty",
    "smooth",
    "gentle",
    "intense",
    "mellow",
    "soft",
    "hard",
  ];
  const moodPart = VALID_MOODS.includes(moodWord) ? `, ${moodWord}` : "";
  const feel = tempoFeel
    ? ` (${tempoFeel.replace(/_/g, "-")} feel${flowPattern ? `, ${flowPattern.replace(/_/g, "-")}` : ""}${moodPart})`
    : "";

  if (rhythmStr) return `${rhythmStr}, around ${bpm} BPM${feel}`;
  return `around ${bpm} BPM${feel}`;
}

function compileSound(active: { label: string; cat: string }[]): string | null {
  const sound = active.filter((d) => d.cat === "sound").map((d) => d.label);
  if (sound.length === 0) return null;
  return `built around ${sound.join(", ")}`;
}

function compileIdentity(
  lyricsMode: string,
  vocalType?: string,
): string | null {
  if (lyricsMode === "strict_instrumental") {
    return "instrumental";
  }
  if (vocalType) {
    return `${vocalType} vocals`;
  }
  return null;
}

function compileMoodArc(
  active: { label: string; cat: string }[],
  sections: { name: string; fn: string }[],
  presetMood?: string,
  presetEnergy?: number,
): string | null {
  const atmosphere = active
    .filter((d) => d.cat === "atmosphere")
    .map((d) => d.label);
  const energy = active.filter((d) => d.cat === "energy").map((d) => d.label);

  const moodParts: string[] = [];
  if (atmosphere.length > 0) moodParts.push(atmosphere.join(", "));
  if (
    presetMood &&
    presetMood.trim() &&
    !moodParts.some((p) => p.toLowerCase().includes(presetMood.toLowerCase()))
  ) {
    moodParts.push(presetMood.trim());
  }
  if (energy.length > 0) {
    moodParts.push(energy.join(", "));
  } else if (presetEnergy !== undefined) {
    const word = energyWord(presetEnergy);
    if (word) moodParts.push(word);
  }

  const arc = macroArc(sections);
  if (!moodParts.length && !arc) return null;

  const result: string[] = [];
  if (moodParts.length) result.push(moodParts.join(", "));
  if (arc) result.push(arc);

  return result.join("; ");
}

function energyWord(energy: number): string | null {
  if (energy >= 9) return "explosive energy";
  if (energy >= 7) return "high energy";
  if (energy >= 5) return "moderate energy";
  if (energy >= 3) return "low energy";
  if (energy >= 1) return "minimal energy";
  return null;
}

function macroArc(sections: { name: string; fn: string }[]): string | null {
  const peaks = sections.filter(
    (s) => s.fn === "peak" || /drop|chorus|hook/i.test(s.name),
  );

  if (peaks.length >= 2) {
    const label = /drop/i.test(peaks[0]!.name) ? "drops" : "choruses";
    return `gradually builds toward ${peaks.length} increasingly intense ${label}`;
  }
  if (peaks.length === 1) {
    return `builds toward a single climactic ${peaks[0]!.name.toLowerCase()}`;
  }
  return "evolves gradually with a slow-building energy arc";
}

/**
 * Compact ordered section list, appended to the style string for
 * strict-instrumental jobs only. Instrumental generations never populate
 * the Suno `prompt` field (that would flip `instrumental` to false), so the
 * style string is the only channel available to hand Suno the arrangement's
 * journey. Vocal jobs get the full per-section bracket metatags in the
 * lyrics artifact instead (see formatLyricsArtifact in the orchestrator).
 */
function compileStructureNote(
  sections: { name: string; fn: string }[],
  lyricsMode: string,
): string | null {
  if (lyricsMode !== "strict_instrumental") return null;
  const names = sections.map((s) => s.name).filter(Boolean);
  if (names.length === 0) return null;
  const note = `structure: ${names.join(" → ")}`;
  return note.length > 220 ? null : note;
}

function compileProduction(
  active: { label: string; cat: string }[],
): string | null {
  const prod = active.filter((d) => d.cat === "production").map((d) => d.label);
  if (prod.length === 0) return null;
  return `${prod.join(", ")} production`;
}

/**
 * Inject genre characteristics (from the preset) into the style string.
 * These are subgenre-level descriptors like "hard drums", "1990s era",
 * "intense delivery" — applicable to any genre.
 */
function compileCharacter(characteristics?: string[]): string | null {
  if (!characteristics || characteristics.length === 0) return null;
  return characteristics.join(", ");
}

interface HipHopVocalCharacter {
  flowPattern?: string;
  rhymeStyle?: string;
  narrativeArc?: string;
  vocalStyle?: string;
}

/**
 * HipHop-specific vocal/flow character — flow pattern, rhyme style,
 * narrative arc, and prose vocal style. These are genre-specific
 * concepts that don't fit the generic descriptor categories.
 */
function compileHipHopVocalCharacter(
  hipHop: HipHopVocalCharacter,
): string | null {
  const parts: string[] = [];

  // Flow + rhyme: "laid-back flow with multi-syllabic rhymes"
  if (hipHop.flowPattern && hipHop.rhymeStyle) {
    const flow = hipHop.flowPattern.replace(/_/g, "-");
    const rhyme = hipHop.rhymeStyle.replace(/_/g, " ");
    parts.push(`${flow} flow with ${rhyme} rhymes`);
  } else if (hipHop.flowPattern) {
    parts.push(`${hipHop.flowPattern.replace(/_/g, "-")} flow`);
  } else if (hipHop.rhymeStyle) {
    parts.push(`${hipHop.rhymeStyle.replace(/_/g, " ")} rhymes`);
  }

  // Narrative arc: "braggadocio narrative"
  if (hipHop.narrativeArc) {
    parts.push(`${hipHop.narrativeArc.replace(/_/g, " ")} narrative`);
  }

  // Prose vocal style: "assertive, commanding delivery with precise phrasing"
  if (hipHop.vocalStyle) {
    parts.push(hipHop.vocalStyle);
  }

  if (parts.length === 0) return null;
  return parts.join(". ");
}

/**
 * Compact typed structure note used when a genre provides an explicit
 * typical song structure (e.g. HipHop's typicalSongStructure from presets).
 */
function compileTypedStructure(sections: string[]): string | null {
  if (sections.length === 0) return null;
  const note = `structure: ${sections.join(" → ")}`;
  return note.length > 220 ? null : note;
}

// ── renderSunoStyle — new entry point from ResolvedSongIntent ───────

/**
 * New-style style renderer that consumes `ResolvedSongIntent` instead of
 * the flat `CompileStyleInput`. Shared helpers are identical; genre-specific
 * fields are resolved through the intent's lyrics/arrangement sub-objects
 * instead of being passed as top-level arguments.
 */
export function renderSunoStyle(
  resolved: ResolvedSongIntent,
): CompileStyleResult {
  const active = resolved.descriptors
    .filter((d) => d.weight > 0)
    .sort((a, b) => b.weight - a.weight);
  const activeCount = active.length;

  const core = compileCore(resolved.genreName, resolved.presetLabels);
  const rhythmPart = compileRhythm(
    active,
    resolved.bpm,
    resolved.tempoFeel,
    resolved.lyrics.flowPattern,
    resolved.mood,
  );
  const soundPart = compileSound(active);
  const identityPart = compileIdentity(
    resolved.vocals.mode,
    resolved.vocals.type,
  );
  const moodArc = compileMoodArc(
    active,
    resolved.arrangement.sections.map((s) => ({ name: s.name, fn: s.fn })),
    resolved.mood,
    resolved.energy,
  );
  const prodPart = compileProduction(active);
  const charPart = compileCharacter(resolved.characteristics);
  const hipHopPart = compileHipHopVocalCharacter({
    flowPattern: resolved.lyrics.flowPattern,
    rhymeStyle: resolved.lyrics.rhymeStyle,
    narrativeArc: resolved.lyrics.narrativeArc,
    vocalStyle: resolved.lyrics.vocalStyle,
  });
  const structureNote = resolved.arrangement.typicalSongStructure
    ? compileTypedStructure(resolved.arrangement.typicalSongStructure)
    : compileStructureNote(
        resolved.arrangement.sections.map((s) => ({ name: s.name, fn: s.fn })),
        resolved.vocals.mode,
      );

  const parts = [core, rhythmPart];
  if (soundPart) parts.push(soundPart);
  if (charPart) parts.push(charPart);
  if (identityPart) parts.push(identityPart);
  if (moodArc) parts.push(moodArc);
  if (prodPart) parts.push(prodPart);
  if (hipHopPart) parts.push(hipHopPart);
  if (structureNote) parts.push(structureNote);

  const style = parts
    .filter(Boolean)
    .join(". ")
    .replace(/\.{2,}/g, ".")
    .replace(/\.\s*\./g, ".")
    .trim();
  const final = style.endsWith(".") ? style : style + ".";

  return { style: final, charCount: final.length, activeCount };
}

/* ── Helpers ───────────────────────────────────────────────────────── */
