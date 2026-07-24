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

export interface CompileStyleInput {
  genreName: string;
  presetLabels: string[];
  descriptors: { label: string; cat: string; weight: number }[];
  bpm: number;
  key: string;
  scale: "major" | "minor";
  sections: { name: string; fn: string }[];
  lyricsMode: "full_lyrics" | "strict_instrumental";
  vocalType?: string;
  /** Preset/job mood text (e.g. "euphoric and building") folded into the mood arc when not already covered by descriptors. */
  presetMood?: string;
  /** Preset/job energy 1-10, folded into the mood arc when no energy-category descriptors are active. */
  presetEnergy?: number;
  /** Genre characteristics from the preset (e.g. "hard drums", "1990s era", "intense delivery"). Merged into the character part. */
  characteristics?: string[];
  /** HipHop-specific: flow/rhyme style description (e.g. "laid_back", "multi_syllabic"). */
  hipHopFlowPattern?: string;
  hipHopRhymeStyle?: string;
  /** HipHop-specific: narrative arc (e.g. "braggadocio", "storytelling"). */
  hipHopNarrativeArc?: string;
  /** HipHop-specific: prose vocal style description (e.g. "assertive, commanding delivery with precise phrasing"). */
  hipHopVocalStyle?: string;
  /** HipHop-specific: ordered section structure (replaces generic structure note when present). */
  hipHopTypicalSongStructure?: string[];
}

export interface CompileStyleResult {
  style: string;
  charCount: number;
  activeCount: number;
}

export function compileStylePrompt(
  input: CompileStyleInput,
): CompileStyleResult {
  const active = input.descriptors
    .filter((d) => d.weight > 0)
    .sort((a, b) => b.weight - a.weight);

  const activeCount = active.length;

  // NOTE: even with zero active descriptors, a real style string is always
  // produced (genre + preset + tempo/key at minimum). This function is the
  // single source of truth for BOTH the live UI preview AND the string that
  // is actually persisted and sent to Suno — it must never return placeholder
  // text, since callers on the pipeline side cannot distinguish "nothing
  // compiled yet" from "this is the final style". UI-side empty-state nudges
  // belong in the caller, not here.
  const keyLabel = keyLabelFn(input.key, input.scale);
  const core = compileCore(input.genreName, input.presetLabels);
  const rhythmPart = compileRhythm(active, input.bpm, keyLabel);
  const soundPart = compileSound(active);
  const identityPart = compileIdentity(input.lyricsMode, input.vocalType);
  const moodArc = compileMoodArc(
    active,
    input.sections,
    input.presetMood,
    input.presetEnergy,
  );
  const prodPart = compileProduction(active);
  const charPart = compileCharacter(input.characteristics);
  const hipHopPart = compileHipHopVocalCharacter(input);
  const structureNote = input.hipHopTypicalSongStructure
    ? compileTypedStructure(input.hipHopTypicalSongStructure)
    : compileStructureNote(input.sections, input.lyricsMode);

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

  // Ensure trailing period
  const final = style.endsWith(".") ? style : style + ".";

  return { style: final, charCount: final.length, activeCount };
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
  keyLabel: string,
): string {
  const rhythm = active.filter((d) => d.cat === "rhythm").map((d) => d.label);
  const rhythmStr = rhythm.length > 0 ? rhythm.join(", ") : "";

  if (rhythmStr) {
    return `${rhythmStr}, around ${bpm} BPM in ${keyLabel}`;
  }
  return `around ${bpm} BPM in ${keyLabel}`;
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

/**
 * HipHop-specific vocal/flow character — flow pattern, rhyme style,
 * narrative arc, and prose vocal style. These are genre-specific
 * concepts that don't fit the generic descriptor categories.
 */
function compileHipHopVocalCharacter(input: CompileStyleInput): string | null {
  const parts: string[] = [];

  // Flow + rhyme: "laid-back flow with multi-syllabic rhymes"
  if (input.hipHopFlowPattern && input.hipHopRhymeStyle) {
    const flow = input.hipHopFlowPattern.replace(/_/g, "-");
    const rhyme = input.hipHopRhymeStyle.replace(/_/g, " ");
    parts.push(`${flow} flow with ${rhyme} rhymes`);
  } else if (input.hipHopFlowPattern) {
    parts.push(`${input.hipHopFlowPattern.replace(/_/g, "-")} flow`);
  } else if (input.hipHopRhymeStyle) {
    parts.push(`${input.hipHopRhymeStyle.replace(/_/g, " ")} rhymes`);
  }

  // Narrative arc: "braggadocio narrative"
  if (input.hipHopNarrativeArc) {
    parts.push(`${input.hipHopNarrativeArc.replace(/_/g, " ")} narrative`);
  }

  // Prose vocal style: "assertive, commanding delivery with precise phrasing"
  if (input.hipHopVocalStyle) {
    parts.push(input.hipHopVocalStyle);
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

/* ── Helpers ───────────────────────────────────────────────────────── */

function keyLabelFn(key: string, scale: "major" | "minor"): string {
  if (!key) return "—";
  return key + (scale === "minor" ? "m" : "");
}
