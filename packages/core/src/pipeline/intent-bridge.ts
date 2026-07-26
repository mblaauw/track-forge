import type { ResolvedSongIntent } from "@track-forge/song-intent";
import type { LyricsWriterInput } from "../llm/lyrics-writer.js";

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
