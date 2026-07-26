import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { LyricsWriterInput } from "./lyrics-writer.js";

const DEFAULT_TRACE_DIR = join("data", "lyrics-traces");

/**
 * Get the trace output directory: env var LYRICS_TRACE_DIR overrides default.
 */
function traceDir(): string {
  return process.env.LYRICS_TRACE_DIR ?? DEFAULT_TRACE_DIR;
}

/**
 * Ensure the trace directory exists (no-op if already present).
 */
function ensureDir(dir: string): void {
  mkdirSync(dir, { recursive: true });
}

/**
 * Safe label for filenames — lowercases, collapses non-alphanumeric to `-`.
 */
function slug(...parts: string[]): string {
  return parts
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Write a trace file containing the full prompt that was sent to the
 * lyrics-writing LLM. Always synchronous so the trace is guaranteed to be on
 * disk before the LLM response arrives.
 */
export function writeLyricsTrace(
  input: LyricsWriterInput,
  system: string,
  user: string,
  traceDirOverride?: string,
): string {
  const dir = traceDirOverride ?? traceDir();
  ensureDir(dir);

  const now = new Date().toISOString();
  const presetSummary = slug(...input.presetLabels.slice(0, 2));
  const timestamp = now.replace(/[:.]/g, "-");
  const filename = `${slug(input.genreName)}_${presetSummary || "no-preset"}_${timestamp}.log`;
  const filePath = join(dir, filename);

  const lyricalParams = [
    input.mood ? `Mood: ${input.mood}` : "",
    input.energy !== undefined ? `Energy: ${input.energy}/10` : "",
    input.narrativeArc ? `Narrative arc: ${input.narrativeArc}` : "",
    input.flowPattern ? `Flow: ${input.flowPattern}` : "",
    input.rhymeStyle ? `Rhyme style: ${input.rhymeStyle}` : "",
    input.vocalStyle ? `Vocal style: ${input.vocalStyle}` : "",
    input.tempoFeel ? `Tempo feel: ${input.tempoFeel}` : "",
    input.perceivedBpm ? `Perceived BPM: ${input.perceivedBpm}` : "",
    input.lineDensity ? `Line density: ${input.lineDensity}` : "",
    input.perspective ? `Perspective: ${input.perspective}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const sections = [
    "=== Lyrics Prompt Trace ===",
    `Timestamp: ${now}`,
    `Genre: ${input.genreName}`,
    `Presets: ${input.presetLabels.join(", ") || "(none)"}`,
    `BPM: ${input.bpm}`,
    input.key ? `Key: ${input.key} ${input.scale ?? ""}` : "Key: (not set)",
    `Lyric topic: ${input.lyricTopic || "(not set)"}`,
    `Lyric angle: ${input.lyricAngle || "(not set)"}`,
    input.lyricThemes?.length
      ? `Themes: ${input.lyricThemes.join(", ")}`
      : "Themes: (not set)",
    lyricalParams,
    "",
    "─── SYSTEM PROMPT ─────────────────────────────────────",
    system,
    "",
    "─── USER PROMPT ───────────────────────────────────────",
    user,
    "",
  ];

  const content = sections.join("\n");
  writeFileSync(filePath, content, "utf-8");
  return filePath;
}
