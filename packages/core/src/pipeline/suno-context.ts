/**
 * Build the Suno-style context string from the session bundle.
 * Used by the lyrics generation pipeline and the "Copy arrangement" feature.
 * Format matches LOGIC_AND_ALGORITHMS.md § buildSunoContext().
 */

import type { ArrangementSection } from "@track-forge/genre-core";
import { compileStylePrompt } from "./style-compiler.js";

export interface SunoContextInput {
  genreName: string;
  presetLabels: string[];
  descriptors: { label: string; cat: string; weight: number }[];
  bpm: number;
  key: string;
  scale: "major" | "minor";
  sections: ArrangementSection[];
  lyricsMode: "full_lyrics" | "strict_instrumental";
  vocalType?: string;
  lyricTopic?: string;
  lyricThemes?: string[];
  lyricAngle?: string;
  /** Pre-compiled style string. When provided, skips internal compileStylePrompt call. */
  styleOverride?: string;
}

export function buildSunoContext(input: SunoContextInput): string {
  const lines: string[] = [];

  // Style prompt block — use pre-compiled style if available, otherwise compile
  const style =
    input.styleOverride ??
    compileStylePrompt({
      genreName: input.genreName,
      presetLabels: input.presetLabels,
      descriptors: input.descriptors,
      bpm: input.bpm,
      key: input.key,
      scale: input.scale,
      sections: input.sections.map((s) => ({ name: s.section, fn: s.fn })),
      lyricsMode: input.lyricsMode,
      vocalType: input.vocalType,
    }).style;

  lines.push("STYLE PROMPT:");
  lines.push(style);
  lines.push("");

  // Structure block — per design target: "{name} — {bars} bars [{fn}, {deltas...}]"
  lines.push("STRUCTURE:");
  for (const sec of input.sections) {
    const deltas = sec.deltas.length > 0 ? `, ${sec.deltas.join(", ")}` : "";
    lines.push(`${sec.section} — ${sec.bars} bars [${sec.fn}${deltas}]`);
  }
  lines.push("");

  // Brief block
  const topic =
    input.lyricTopic && input.lyricTopic.trim()
      ? input.lyricTopic
      : "(no brief — infer a fitting theme from the style)";
  lines.push(`BRIEF: ${topic}`);
  if (input.lyricThemes && input.lyricThemes.length > 0) {
    lines.push(`THEMES: ${input.lyricThemes.join(", ")}`);
  }
  if (input.lyricAngle) {
    lines.push(`ANGLE: ${input.lyricAngle}`);
  }

  return lines.join("\n");
}
