import {
  migrateLegacyJob,
  resolveSongIntent,
  type ResolvedSongIntent,
} from "@track-forge/song-intent";
import type {
  CompileStyleInput,
  CompileStyleResult,
} from "./style-compiler.js";
import type {
  MaterializedIntent,
  PresetCatalog,
} from "@track-forge/song-intent";
import type { LyricsWriterInput } from "../llm/lyrics-writer.js";

/**
 * Bridge: `MaterializedIntent → CompileStyleInput`
 *
 * Transitional adapter — Phase 4's `renderSunoStyle` replaces this.
 * Only kept for backward compat during migration.
 */
export function materializedToCompileStyleInput(
  m: MaterializedIntent,
  catalog: PresetCatalog,
  genreName: string,
): CompileStyleInput {
  const intent = m.intent;
  const presetLabels = resolvePresetLabels(intent.styles, catalog);
  return {
    genreName,
    presetLabels,
    descriptors: intent.musical.descriptors,
    bpm: intent.musical.bpm ?? 128,
    sections: intent.arrangement.sections.map((s) => ({
      name: s.name,
      fn: s.fn,
    })),
    lyricsMode: intent.vocals.mode,
    vocalType: intent.vocals.type || undefined,
    characteristics:
      intent.musical.characteristics.length > 0
        ? intent.musical.characteristics
        : undefined,
    tempoFeel: intent.musical.tempoFeel || undefined,
    flowPattern: intent.lyrics.flowPattern || undefined,
    presetMood: intent.musical.mood || undefined,
    presetEnergy:
      intent.musical.energy !== undefined ? intent.musical.energy : undefined,
  };
}

function resolvePresetLabels(
  styles: MaterializedIntent["intent"]["styles"],
  catalog: PresetCatalog,
): string[] {
  const labels: string[] = [];
  for (const s of styles) {
    const preset = catalog.getPreset(s.genreId, s.presetId);
    if (preset) labels.push(preset.name);
  }
  return labels;
}

/**
 * Enrich a `ResolvedSongIntent` with genre/preset display info the pipeline
 * caller owns (not available during pure resolve).
 */
export function enrichResolved(
  resolved: ResolvedSongIntent,
  genreName: string,
  presetLabels: string[],
): ResolvedSongIntent {
  return { ...resolved, genreName, presetLabels };
}

/**
 * Load a job's merged inputs and produce a `ResolvedSongIntent` for the
 * pipeline stages. No catalog needed — inputs are already merged.
 */
export function resolveIntentFromJob(
  job: { genreId: string; presetId: string; inputs: string | null },
  genreName: string,
  presetLabels: string[],
): ResolvedSongIntent {
  const migrated = migrateLegacyJob({
    genreId: job.genreId,
    presetId: job.presetId,
    inputs: job.inputs,
  });
  const resolved = resolveSongIntent({
    intent: migrated.intent,
    provenance: {},
    warnings: [],
  });
  return enrichResolved(resolved, genreName, presetLabels);
}

/**
 * Build a `LyricsWriterInput` from a `ResolvedSongIntent`.
 * Replaces the inline writerInput assembly in the orchestrator.
 */
export function buildLyricsBrief(
  resolved: ResolvedSongIntent,
  sections: LyricsWriterInput["sections"],
  lyricsGuidance?: string,
): LyricsWriterInput {
  return {
    genreName: resolved.genreName,
    presetLabels: resolved.presetLabels,
    bpm: resolved.bpm,
    key: resolved.key || undefined,
    scale: resolved.scale || undefined,
    sections,
    lyricTopic: resolved.lyrics.topic,
    lyricThemes: resolved.lyrics.themes,
    lyricAngle: resolved.lyrics.angle,
    lyricsGuidance,
    mood: resolved.mood,
    energy: resolved.energy,
    narrativeArc: resolved.lyrics.narrativeArc,
    rhymeStyle: resolved.lyrics.rhymeStyle,
    flowPattern: resolved.lyrics.flowPattern,
    vocalStyle: resolved.lyrics.vocalStyle,
    characteristics:
      resolved.characteristics.length > 0
        ? resolved.characteristics
        : undefined,
    tempoFeel: resolved.tempoFeel,
    perceivedBpm: resolved.perceivedBpm,
    lineDensity: resolved.lyrics.lineDensity,
    perspective: resolved.lyrics.perspective,
    imageAnchors:
      resolved.lyrics.imageAnchors.length > 0
        ? resolved.lyrics.imageAnchors
        : undefined,
  };
}
