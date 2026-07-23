import { z } from "zod";
import type { LlmRequest, LlmResponse } from "./types.js";

/**
 * Single implementation of the lyrics-generation contract, shared by the
 * pipeline's lyrics_writing stage and the standalone /api/lyrics/generate
 * route. Sections are addressed by id (not by display name) so the caller
 * never has to string-match model output back onto the arrangement.
 */

export interface LyricsWriterVocal {
  type: string;
  delivery: string;
  energy: number;
  adlibs: boolean;
  harmonies: boolean;
}

export interface LyricsWriterSectionInput {
  id: string;
  name: string;
  bars: number;
  fn: string;
  deltas: string[];
  vocal?: LyricsWriterVocal;
}

export interface LyricsWriterInput {
  genreName: string;
  presetLabels: string[];
  bpm: number;
  key: string;
  scale: "major" | "minor";
  sections: LyricsWriterSectionInput[];
  lyricTopic?: string;
  lyricThemes?: string[];
  lyricAngle?: string;
  /** Pre-compiled style string (Suno STYLE PROMPT block). */
  style: string;
  /** Genre-specific songwriting conventions from config/genres/<id>.yaml → lyrics_guidance. */
  lyricsGuidance?: string;
}

export interface LyricsWriterSectionResult {
  id: string;
  lines: string[];
}

export interface LyricsWriterOutput {
  sections: LyricsWriterSectionResult[];
}

const ResponseSchema = z.object({
  sections: z.array(
    z.object({
      id: z.string().min(1),
      lines: z.array(z.string()),
    }),
  ),
});

const ANGLE_INSTRUCTIONS: Record<string, string> = {
  first_person:
    "Write in first person, present tense — the listener is inside the narrator's head.",
  story:
    "Write as a narrative with a clear beginning, turn, and resolution across the sections.",
  abstract:
    "Favor imagery and impressionistic language over literal narrative.",
  anthemic:
    "Write big, singable, universal lines built for a crowd to shout back.",
};

function stripFences(text: string): string {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (match ? match[1]! : text).trim();
}

/** ~1 line per 2 bars, clamped to a sane range for a Suno-length lyric block. */
function targetLinesForBars(bars: number): number {
  return Math.max(2, Math.min(16, Math.round(bars / 2)));
}

function vocalDescription(vocal?: LyricsWriterVocal): string {
  if (!vocal) return "";
  const energyWords = [
    "",
    "intimate",
    "restrained",
    "balanced",
    "powerful",
    "explosive",
  ];
  const parts = [vocal.type, vocal.delivery, energyWords[vocal.energy] ?? ""];
  if (vocal.adlibs) parts.push("ad-libs");
  if (vocal.harmonies) parts.push("harmonies");
  return parts.filter(Boolean).join(", ");
}

export function buildLyricsPrompt(input: LyricsWriterInput): {
  system: string;
  user: string;
} {
  const angleInstruction = input.lyricAngle
    ? (ANGLE_INSTRUCTIONS[input.lyricAngle] ?? "")
    : "";

  const systemParts = [
    `You are a professional songwriter working in the ${input.genreName} genre${
      input.presetLabels.length ? ` (${input.presetLabels.join(", ")})` : ""
    }.`,
    "Write lyrics formatted for Suno AI music generation.",
  ];
  if (input.lyricsGuidance) systemParts.push(input.lyricsGuidance);
  if (angleInstruction) systemParts.push(angleInstruction);
  systemParts.push(
    `Match syllable density and phrasing to the tempo: ${input.bpm} BPM in ${input.key} ${input.scale}.`,
    "Each section below gives a target line count derived from its bar length — stay close to it.",
    "Write only sung/rapped lyric lines — no stage directions, no section headers inside `lines`.",
    'Return ONLY valid JSON matching this shape: {"sections":[{"id":"<echo the section id exactly>","lines":["line 1","line 2"]}]}. No prose, no markdown fences, no commentary outside the JSON.',
  );

  const sectionLines = input.sections.map((s) => {
    const vocalMeta = vocalDescription(s.vocal);
    const deltaStr = s.deltas.length > 0 ? `, ${s.deltas.join(", ")}` : "";
    const vocalStr = vocalMeta ? ` — vocal: ${vocalMeta}` : "";
    return `- id="${s.id}" [${s.name}${deltaStr}] ${s.bars} bars, function=${s.fn}, target ${targetLinesForBars(s.bars)} lines${vocalStr}`;
  });

  const userParts = [
    `STYLE: ${input.style}`,
    "",
    "SECTIONS:",
    ...sectionLines,
    "",
  ];
  userParts.push(
    `BRIEF: ${input.lyricTopic?.trim() || "(no brief — infer a fitting theme from the style)"}`,
  );
  if (input.lyricThemes && input.lyricThemes.length > 0) {
    userParts.push(`THEMES: ${input.lyricThemes.join(", ")}`);
  }

  return { system: systemParts.join("\n"), user: userParts.join("\n") };
}

export interface LyricsLlm {
  complete(req: LlmRequest): Promise<LlmResponse>;
}

/**
 * Call the LLM to write lyrics, validating the response against the
 * id-keyed schema. Retries once with the validation error appended when the
 * model returns invalid/unparseable JSON (fenced JSON is unwrapped first).
 * Never falls back to raw model text — a bad response is a failed stage,
 * not a synthesized-lyrics stage.
 */
export async function writeLyrics(
  llm: LyricsLlm,
  input: LyricsWriterInput,
  opts?: { signal?: AbortSignal; maxAttempts?: number },
): Promise<LyricsWriterOutput> {
  const { system, user } = buildLyricsPrompt(input);
  const maxAttempts = opts?.maxAttempts ?? 2;

  let lastError = "unknown error";
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const messages: LlmRequest["messages"] = [
      { role: "system", content: system },
      { role: "user", content: user },
    ];
    if (attempt > 0) {
      messages.push({
        role: "user",
        content: `Your previous response was invalid (${lastError}). Return ONLY the corrected JSON object — no other text, no markdown fences.`,
      });
    }

    const response = await llm.complete({
      messages,
      temperature: 0.8,
      maxTokens: 16384,
      responseFormat: "json_object",
      signal: opts?.signal,
    });

    try {
      const raw = stripFences(response.content);
      const parsed = JSON.parse(raw);
      const validated = ResponseSchema.parse(parsed);
      return { sections: validated.sections };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  throw new Error(
    `LyricsWriter: model did not return valid JSON after ${maxAttempts} attempt(s): ${lastError}`,
  );
}
