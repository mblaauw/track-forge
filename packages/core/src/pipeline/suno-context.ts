/**
 * Build the Suno-style context string from the session bundle.
 * Used by the lyrics generation pipeline and the "Copy arrangement" feature.
 * Format matches LOGIC_AND_ALGORITHMS.md § buildSunoContext().
 */

import type { ArrangementSection } from "@track-forge/genre-core";

export interface SunoContextInput {
  genreName: string;
  presetLabels: string[];
  descriptors: { label: string; cat: string; weight: number }[];
  bpm: number;
  key: string;
  scale: "major" | "minor";
  sections: ArrangementSection[];
  lyricsMode: "full_lyrics" | "strict_instrumental" | "guided_instrumental";
  vocalType?: string;
  lyricTopic?: string;
  lyricThemes?: string[];
  lyricAngle?: string;
}

export function buildSunoContext(input: SunoContextInput): string {
  const lines: string[] = [];

  // Style prompt block
  lines.push("STYLE PROMPT:");
  lines.push(compileStyleSummary(input));
  lines.push("");

  // Structure block
  lines.push("STRUCTURE:");
  for (const sec of input.sections) {
    const deltas = sec.deltas.length > 0 ? ` ${sec.deltas.join(", ")}` : "";
    lines.push(`"${sec.section}" — ${sec.bars} bars [${sec.fn}${deltas}]`);
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

/** Minimal style summary for the Suno context (not the same as compileStylePrompt output) */
function compileStyleSummary(input: SunoContextInput): string {
  const active = input.descriptors.filter((d) => d.weight > 0);
  if (active.length === 0) return `${input.genreName}`;

  const parts: string[] = [input.genreName];
  if (input.presetLabels.length > 0) {
    parts.push(`— ${input.presetLabels.join(", ")}`);
  }
  const descLabels = active.map((d) => d.label).join(", ");
  parts.push(`(${descLabels})`);
  parts.push(
    `${input.bpm} BPM ${input.key}${input.scale === "minor" ? "m" : ""}`,
  );
  return parts.join(" ");
}
