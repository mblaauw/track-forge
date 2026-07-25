import { z } from "zod";
import type { LlmRequest, LlmResponse } from "./types.js";
import { writeLyricsTrace } from "./lyrics-trace.js";

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
  purpose?: string;
  pocket?: string;
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
  lyricsGuidance?: string;
  mood?: string;
  energy?: number;
  narrativeArc?: string;
  rhymeStyle?: string;
  flowPattern?: string;
  vocalStyle?: string;
  characteristics?: string[];
  tempoFeel?: string;
  perceivedBpm?: number;
  /** Lines per bar ratio (e.g. 1 = 1 line/bar, 0.5 = 1 line/2 bars). Default 0.5. */
  lineDensity?: number;
  /** Narrative perspective (first_person, third_person). */
  perspective?: string;
  /** Optional concrete imagery anchors for the brief. */
  imageAnchors?: string[];
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

const ENERGY_WORDS: Record<number, string> = {
  1: "minimal",
  2: "low",
  3: "low-moderate",
  4: "moderate",
  5: "moderate",
  6: "moderate-high",
  7: "high",
  8: "high",
  9: "explosive",
  10: "explosive",
};

// ── Helpers ─────────────────────────────────────────────────────────

function firstWord(name: string): string {
  return name.toLowerCase().split(/[\s_-]+/)[0] ?? "";
}

function stripFences(text: string): string {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (match ? match[1]! : text).trim();
}

function feelLabel(feel?: string): string {
  return (feel ?? "straight").replace(/_/g, "-");
}

/** Lines per section — respects lineDensity (lines per bar ratio). */
function targetLinesForBars(bars: number, density = 0.5): number {
  return Math.max(2, Math.min(32, Math.round(bars * density)));
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

// ── Derivation helpers ──────────────────────────────────────────────

function narrativeArcLine(arc?: string): string | null {
  if (!arc) return null;
  const descriptions: Record<string, string> = {
    braggadocio: "braggadocio narrative — confident, asserting dominance",
    storytelling:
      "storytelling narrative — a clear story arc with characters and events",
    conscious: "conscious narrative — introspective, socially aware themes",
    abstract: "abstract, impressionistic wordplay",
  };
  const desc = descriptions[arc];
  return desc ? `NARRATIVE ARC: ${desc}.` : null;
}

function flowRhymeLine(flow?: string, rhyme?: string): string | null {
  if (!flow && !rhyme) return null;
  const flowClean = flow?.replace(/_/g, "-") ?? "";
  const rhymeClean = rhyme?.replace(/_/g, " ") ?? "";
  if (flow && rhyme)
    return `FLOW & RHYME: Use a ${flowClean} flow with ${rhymeClean} rhyme patterns.`;
  if (flow) return `FLOW: Use a ${flowClean} flow.`;
  return `RHYME: Use ${rhymeClean} rhyme patterns.`;
}

function moodEnergyLine(mood?: string, energy?: number): string | null {
  const parts: string[] = [];
  if (mood) parts.push(mood);
  if (energy !== undefined) {
    const word = ENERGY_WORDS[energy];
    if (word) parts.push(`${energy}/10 — ${word} energy`);
  }
  if (parts.length === 0) return null;
  return `MOOD & ENERGY: ${parts.join(", ")}.`;
}

function vocalStyleLine(style?: string): string | null {
  if (!style) return null;
  return `VOCAL STYLE: ${style}.`;
}

function characteristicsLine(chars?: string[]): string | null {
  if (!chars || chars.length === 0) return null;
  return `CHARACTER: ${chars.join(", ")}.`;
}

function tempoFeelLine(
  feel?: string,
  bpm?: number,
  perceived?: number,
): string | null {
  if (!feel || !bpm || !perceived) return null;
  return `Tempo: ${bpm} BPM, performed with a ${feelLabel(feel)} pulse felt around ${perceived} BPM.`;
}

function perspectiveLine(perspective?: string): string | null {
  if (!perspective) return null;
  const label = perspective.replace(/_/g, " ");
  return `PERSPECTIVE: ${label}.`;
}

/** Count how many sections with the same root name precede this index. */
function precedingCount(
  name: string,
  allSections: { name: string }[],
  index: number,
): number {
  const root = firstWord(name);
  return allSections.slice(0, index).filter((s) => firstWord(s.name) === root)
    .length;
}

function deriveSectionPurpose(
  name: string,
  fn: string,
  index: number,
  allSections: { name: string }[],
  explicit?: string,
): string {
  if (explicit) return explicit;
  const key = firstWord(name);
  const count = precedingCount(name, allSections, index);

  if (key === "verse") {
    if (count === 0)
      return "introduce the narrator, the encounter, and the initial attraction";
    if (count === 1)
      return "advance the story, deepen emotional stakes, or introduce a turn";
    return "develop toward resolution or climax";
  }
  if (key === "chorus" || key === "hook") {
    if (fn === "peak")
      return "express the song's central emotional release through one title-worthy phrase";
    return "reinforce the central hook with repetition and variation";
  }
  if (key === "pre-chorus" || key === "prechorus") {
    return "build anticipation, moving from the verse toward the chorus or drop";
  }
  if (key === "bridge") {
    return "provide contrast and emotional reflection before the final section";
  }
  if (key === "breakdown")
    return "create a momentary release before rebuilding energy";
  if (key === "build") return "build anticipation toward the next peak";
  if (key === "intro")
    return "establish the mood and prepare the listener for what follows";
  if (key === "outro") return "bring the song to a close with finality";
  if (key === "drop") return "deliver the climactic release of the arrangement";
  return "support the arrangement section";
}

function deriveSectionPocket(
  deltas: string[],
  tempoFeel?: string,
  flowPattern?: string,
  explicit?: string,
): string {
  if (explicit) return explicit;
  const feel = feelLabel(tempoFeel);
  const flow = flowPattern?.replace(/_/g, "-") ?? "";
  const energyHint = deltas.includes("building")
    ? " with building intensity"
    : deltas.includes("intense")
      ? " with heightened intensity"
      : deltas.includes("catchy")
        ? ", catchy and direct"
        : deltas.includes("climactic")
          ? ", climactic"
          : deltas.includes("stripped back") || deltas.includes("minimal")
            ? ", stripped back"
            : "";
  const flowPart = flow ? `, ${flow} phrasing` : "";
  return `${feel} pocket${flowPart}${energyHint}`;
}

function deriveSectionRhyme(
  rhymeStyle?: string,
  energy?: number,
  fn?: string,
): string {
  if (rhymeStyle) {
    const rhyme = rhymeStyle.replace(/_/g, " ");
    if (fn === "peak" || firstWord(fn ?? "") === "peak")
      return `${rhyme}, simpler repetition for impact`;
    const density =
      energy && energy >= 7
        ? "high internal-rhyme density"
        : "medium internal-rhyme density";
    return `${rhyme}, ${density}`;
  }
  return "flexible rhyme scheme, natural phrasing preferred";
}

function deriveSectionStructure(name: string, bars: number): string | null {
  const key = firstWord(name);
  if (key !== "hook" && key !== "chorus") return null;
  // Hooks: core phrase count and repetition strategy
  if (bars >= 16)
    return "four-line core repeated twice; preserve the central hook line exactly";
  if (bars >= 12)
    return "four-line core repeated twice with one varied ending line";
  if (bars >= 8)
    return "four-line core with one repeat; minor variation on the second pass";
  if (bars >= 4) return "single short hook phrase";
  return null;
}

function deriveSectionLanguage(
  name: string,
  energy?: number,
  fn?: string,
  deltas?: string[],
): string | null {
  const key = firstWord(name);
  if (key === "chorus" || key === "hook") {
    if (deltas?.includes("climactic"))
      return "broad and immediate; preserve the central hook, allow one intensified variation near the ending";
    return "broad and immediate, with open vowels and deliberate repetition";
  }
  if (key === "pre-chorus" || key === "prechorus")
    return "increasingly short and direct phrases, leading into the chorus";
  if (key === "verse" && energy && energy >= 7)
    return "slightly more urgent than the previous verse, shorter phrases";
  if (key === "verse")
    return "simple narrative details with one or two recurring images";
  if (key === "bridge")
    return "more vulnerable, intimate language with space between phrases";
  return null;
}

function narrativeProgressionBlock(
  sections: { name: string; fn: string }[],
  allSections: { name: string; fn: string }[],
): string | null {
  const lines: string[] = [];
  for (let i = 0; i < sections.length; i++) {
    const s = sections[i]!;
    const fullDesc = deriveSectionPurpose(s.name, s.fn, i, allSections);
    const short = fullDesc.split(".")[0]!;
    lines.push(`  ${s.name}: ${short}`);
  }
  if (lines.length === 0) return null;
  return `NARRATIVE PROGRESSION:\n${lines.join("\n")}`;
}

// ── Per-section block formatter ────────────────────────────────────

function formatSectionBlock(
  s: LyricsWriterSectionInput,
  input: LyricsWriterInput,
  index: number,
  allSections: { name: string }[],
): string {
  const isInstrumental =
    !s.vocal || s.deltas.some((d) => d.toLowerCase() === "instrumental");
  const lineCount = targetLinesForBars(s.bars, input.lineDensity);
  const purpose = deriveSectionPurpose(
    s.name,
    s.fn,
    index,
    allSections,
    s.purpose,
  );
  const pocket = deriveSectionPocket(
    s.deltas,
    input.tempoFeel,
    input.flowPattern,
    s.pocket,
  );
  const rhyme = deriveSectionRhyme(input.rhymeStyle, input.energy, s.fn);
  const language = deriveSectionLanguage(s.name, input.energy, s.fn, s.deltas);
  const structure = deriveSectionStructure(s.name, s.bars);
  const vocal = isInstrumental ? null : vocalDescription(s.vocal);

  const lines: string[] = [];
  const namePart = `${s.name}${s.deltas.filter((d) => d.toLowerCase() !== "instrumental").length > 0 ? `, ${s.deltas.filter((d) => d.toLowerCase() !== "instrumental").join(", ")}` : ""}`;
  lines.push(`  ${s.id} — ${namePart}`);
  lines.push(
    `         ${s.bars} bars; ${isInstrumental ? "instrumental" : `target ~${lineCount} lyric lines`}`,
  );
  lines.push(`         purpose: ${purpose}`);
  if (structure) lines.push(`         structure: ${structure}`);
  lines.push(`         pocket: ${pocket}`);
  if (!isInstrumental && rhyme) lines.push(`         rhyme: ${rhyme}`);
  if (language) lines.push(`         language: ${language}`);
  if (vocal) lines.push(`         vocal: ${vocal}`);

  return lines.join("\n");
}

export function buildLyricsPrompt(input: LyricsWriterInput): {
  system: string;
  user: string;
} {
  // ── System prompt ─────────────────────────────────────────────────
  // Deduplicate: when narrativeArc is set, don't emit the "story" angle
  // instruction (it's already covered by NARRATIVE ARC).
  const emitAngle =
    input.lyricAngle && input.lyricAngle !== "story"
      ? (ANGLE_INSTRUCTIONS[input.lyricAngle] ?? "")
      : "";

  const systemParts: string[] = [
    `You are a professional songwriter working in the ${input.genreName} genre${
      input.presetLabels.length ? ` (${input.presetLabels.join(", ")})` : ""
    }.`,
    "Write lyrics formatted for Suno AI music generation.",
  ];

  if (input.lyricsGuidance) systemParts.push(input.lyricsGuidance);

  const lyricalBlocks = [
    perspectiveLine(input.perspective),
    narrativeArcLine(input.narrativeArc),
    flowRhymeLine(input.flowPattern, input.rhymeStyle),
    moodEnergyLine(input.mood, input.energy),
    vocalStyleLine(input.vocalStyle),
    characteristicsLine(input.characteristics),
    tempoFeelLine(input.tempoFeel, input.bpm, input.perceivedBpm),
    emitAngle || null,
  ].filter(Boolean) as string[];

  systemParts.push(...lyricalBlocks);

  systemParts.push(
    "Write only sung/rapped lyric lines — no stage directions, no section headers inside `lines`.",
    "",
    "OUTPUT FORMAT:",
    "Return ONLY valid JSON — no prose, no markdown fences, no commentary.",
    'Schema: {"sections":[{"id":"<section id>","lines":["line 1","line 2",...]}]}',
    "Rules:",
    "- One entry per section listed below — do not add or skip sections.",
    '- Set "id" to the exact id shown for each section.',
    '- "lines" must be an array of individual strings, NOT a single string with newlines.',
    '- For instrumental sections, return "lines": [].',
    "- Stay within ±1 line of the target per section.",
  );

  // ── User prompt ───────────────────────────────────────────────────
  const sectionBlocks = input.sections.map((s, i) =>
    formatSectionBlock(s, input, i, input.sections),
  );

  const userParts: string[] = ["SECTIONS:", ...sectionBlocks, ""];

  userParts.push(
    `BRIEF: ${input.lyricTopic?.trim() || "(no brief — infer a fitting theme from the genre and presets)"}`,
  );
  if (input.lyricThemes && input.lyricThemes.length > 0) {
    userParts.push(`THEMES: ${input.lyricThemes.join(", ")}`);
  }
  if (input.imageAnchors && input.imageAnchors.length > 0) {
    userParts.push(`IMAGES: ${input.imageAnchors.join(", ")}`);
  }
  if (input.perspective) {
    userParts.push(`PERSPECTIVE: ${input.perspective.replace(/_/g, " ")}.`);
  }

  // Narrative progression block (only when arc is set)
  if (input.narrativeArc) {
    const prog = narrativeProgressionBlock(input.sections, input.sections);
    if (prog) userParts.push("", prog);
  }

  return { system: systemParts.join("\n\n"), user: userParts.join("\n") };
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
  opts?: { signal?: AbortSignal; maxAttempts?: number; traceDir?: string },
): Promise<LyricsWriterOutput> {
  const { system, user } = buildLyricsPrompt(input);
  writeLyricsTrace(input, system, user, opts?.traceDir);
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
        content: `Your previous response was invalid (${lastError}). Return ONLY valid JSON matching this shape: {"sections":[{"id":"<echo the section id exactly>","lines":["line 1","line 2"]}]} — no other text, no markdown fences. Corrected JSON object only.`,
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
