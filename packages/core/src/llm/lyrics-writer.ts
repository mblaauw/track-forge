import { createHash, randomUUID } from "node:crypto";
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
  key?: string;
  scale?: "major" | "minor";
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

export type LyricsWriterErrorType =
  | "parse_error"
  | "schema_error"
  | "semantic_error"
  | "provider_error"
  | "provider_refusal"
  | "prompt_lint_error";

export interface PromptDiagnostic {
  severity: "error" | "warning";
  code:
    | "STRUCTURE_CONFLICT"
    | "INSTRUMENTAL_VOCAL_CONFLICT"
    | "MISSING_GROUNDING"
    | "RULE_PRECEDENCE_CONFLICT"
    | "INVALID_SECTION_REFERENCE"
    | "SCHEMA_PROMPT_MISMATCH";
  path?: string;
  message: string;
  involvedRuleIds?: string[];
}

export interface ValidationIssue {
  code:
    | "SECTION_ID_MISMATCH"
    | "SECTION_ORDER_MISMATCH"
    | "SECTION_COUNT_MISMATCH"
    | "LINE_COUNT_MISMATCH"
    | "INSTRUMENTAL_NOT_EMPTY"
    | "BLANK_LYRIC_LINE"
    | "EMBEDDED_SECTION_MARKER"
    | "STAGE_DIRECTION_LINE";
  path?: string;
  message: string;
}

export interface PromptAttemptTelemetry {
  attempt: number;
  startedAt: string;
  latencyMs: number;
  status: "success" | "failure";
  errorType?: LyricsWriterErrorType;
  errorMessage?: string;
  validationIssues?: ValidationIssue[];
  model?: string;
  usage?: LlmResponse["usage"];
}

export interface PromptManifest {
  traceId: string;
  createdAt: string;
  provider: string;
  model: string;
  modelParameters: {
    temperature?: number;
    maxTokens?: number;
    seed?: number;
  };
  promptId: string;
  promptVersion: string;
  promptSourcePath: string;
  promptSourceHash: string;
  systemPromptHash: string;
  userPromptHash: string;
  responseSchemaVersion: string;
  genre: string;
  preset?: string;
  pipelineVersion: string;
  gitCommit?: string;
  selectedRuleIds?: string[];
  retryCount: number;
  parsingFailures: number;
  validationFailures: number;
  repairAttempts: number;
  latencyMs: number;
  tokenUsage?: LlmResponse["usage"];
  status: "success" | "failure";
  failureType?: LyricsWriterErrorType;
  failureMessage?: string;
  attempts: PromptAttemptTelemetry[];
  diagnostics?: PromptDiagnostic[];
  systemPrompt?: string;
  userPrompt?: string;
}

export interface LyricsWriterTraceOptions {
  traceId?: string;
  provider?: string;
  model?: string;
  promptId?: string;
  promptVersion?: string;
  promptSourcePath?: string;
  promptSourceHash?: string;
  genre?: string;
  preset?: string;
  pipelineVersion?: string;
  gitCommit?: string;
  selectedRuleIds?: string[];
  seed?: number;
  capturePromptText?: boolean;
  onManifest?: (manifest: PromptManifest) => void | Promise<void>;
}

export class LyricsWriterError extends Error {
  constructor(
    message: string,
    public readonly type: LyricsWriterErrorType,
    public readonly validationIssues: ValidationIssue[] = [],
    public readonly promptDiagnostics: PromptDiagnostic[] = [],
  ) {
    super(message);
    this.name = "LyricsWriterError";
  }
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

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function sanitizeMessage(message: string): string {
  return message
    .replace(/sk-[A-Za-z0-9_-]+/g, "[redacted]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
    .slice(0, 800);
}

function feelLabel(feel?: string): string {
  return (feel ?? "straight").replace(/_/g, "-");
}

/** Lines per section — respects lineDensity (lines per bar ratio). */
function targetLinesForBars(bars: number, density = 0.5): number {
  return Math.max(2, Math.min(32, Math.round(bars * density)));
}

function isInstrumentalSection(s: LyricsWriterSectionInput): boolean {
  return !s.vocal || s.deltas.some((d) => d.toLowerCase() === "instrumental");
}

function isEmbeddedSectionMarker(line: string): boolean {
  return /^\s*\[[^\]]+\]\s*$/.test(line);
}

function isStageDirectionLine(line: string): boolean {
  return /^\s*\([^)]*\)\s*$/.test(line);
}

function looksLikeProviderRefusal(content: string): boolean {
  const lower = content.toLowerCase();
  return (
    lower.includes("i can't comply") ||
    lower.includes("i cannot comply") ||
    lower.includes("i can't help") ||
    lower.includes("i cannot help") ||
    lower.includes("i'm unable to") ||
    lower.includes("i am unable to")
  );
}

export function expectedLineCountForSection(
  section: LyricsWriterSectionInput,
  input: LyricsWriterInput,
): number {
  return targetLinesForBars(section.bars, input.lineDensity);
}

export function validateLyricsSemantics(
  result: LyricsWriterOutput,
  specification: LyricsWriterInput,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const expected = specification.sections;

  if (result.sections.length !== expected.length) {
    issues.push({
      code: "SECTION_COUNT_MISMATCH",
      path: "/sections",
      message: `Expected ${expected.length} section(s), received ${result.sections.length}.`,
    });
  }

  const expectedIds = new Set(expected.map((s) => s.id));
  const seenIds = new Set<string>();

  result.sections.forEach((actual, index) => {
    const sectionPath = `/sections/${index}`;
    const expectedSection = expected[index];
    seenIds.add(actual.id);

    if (!expectedIds.has(actual.id)) {
      issues.push({
        code: "SECTION_ID_MISMATCH",
        path: `${sectionPath}/id`,
        message: `Unexpected section id "${actual.id}".`,
      });
    }

    if (expectedSection && actual.id !== expectedSection.id) {
      issues.push({
        code: "SECTION_ORDER_MISMATCH",
        path: `${sectionPath}/id`,
        message: `Expected section id "${expectedSection.id}" at position ${index}, received "${actual.id}".`,
      });
    }

    const spec = expected.find((s) => s.id === actual.id);
    if (!spec) return;

    if (isInstrumentalSection(spec)) {
      if (actual.lines.length !== 0) {
        issues.push({
          code: "INSTRUMENTAL_NOT_EMPTY",
          path: `${sectionPath}/lines`,
          message: `Instrumental section "${actual.id}" must contain zero lyric lines.`,
        });
      }
    } else {
      const expectedLines = expectedLineCountForSection(spec, specification);
      if (actual.lines.length !== expectedLines) {
        issues.push({
          code: "LINE_COUNT_MISMATCH",
          path: `${sectionPath}/lines`,
          message: `Section "${actual.id}" expected exactly ${expectedLines} lyric line(s), received ${actual.lines.length}.`,
        });
      }
    }

    actual.lines.forEach((line, lineIndex) => {
      const linePath = `${sectionPath}/lines/${lineIndex}`;
      if (line.trim().length === 0 || line.includes("\n")) {
        issues.push({
          code: "BLANK_LYRIC_LINE",
          path: linePath,
          message: `Section "${actual.id}" contains a blank or multi-line lyric string.`,
        });
      }
      if (isEmbeddedSectionMarker(line)) {
        issues.push({
          code: "EMBEDDED_SECTION_MARKER",
          path: linePath,
          message: `Section "${actual.id}" embeds a section heading inside lyric lines.`,
        });
      }
      if (isStageDirectionLine(line)) {
        issues.push({
          code: "STAGE_DIRECTION_LINE",
          path: linePath,
          message: `Section "${actual.id}" contains a pure stage direction instead of a lyric line.`,
        });
      }
    });
  });

  for (const s of expected) {
    if (!seenIds.has(s.id)) {
      issues.push({
        code: "SECTION_ID_MISMATCH",
        path: "/sections",
        message: `Missing expected section id "${s.id}".`,
      });
    }
  }

  return issues;
}

function hasCentralBrief(input: LyricsWriterInput): boolean {
  return !!(
    input.lyricTopic?.trim() ||
    input.lyricThemes?.length ||
    input.imageAnchors?.length
  );
}

function getRenderedSectionBlock(
  userPrompt: string,
  section: LyricsWriterSectionInput,
  next?: LyricsWriterSectionInput,
): string {
  const start = userPrompt.indexOf(`  ${section.id} —`);
  if (start === -1) return "";
  const end = next ? userPrompt.indexOf(`  ${next.id} —`, start + 1) : -1;
  return end === -1 ? userPrompt.slice(start) : userPrompt.slice(start, end);
}

export function lintRenderedLyricsRequest(
  input: LyricsWriterInput,
  rendered: { system: string; user: string },
): PromptDiagnostic[] {
  const diagnostics: PromptDiagnostic[] = [];
  const seen = new Map<string, number>();

  if (input.sections.length === 0) {
    diagnostics.push({
      severity: "error",
      code: "STRUCTURE_CONFLICT",
      path: "/sections",
      message: "Lyrics request has no section specifications.",
    });
  }

  input.sections.forEach((section, index) => {
    const path = `/sections/${index}`;
    const previous = seen.get(section.id);
    if (previous !== undefined) {
      diagnostics.push({
        severity: "error",
        code: "INVALID_SECTION_REFERENCE",
        path: `${path}/id`,
        message: `Duplicate section id "${section.id}" also appears at /sections/${previous}.`,
      });
    }
    seen.set(section.id, index);

    if (!Number.isFinite(section.bars) || section.bars <= 0) {
      diagnostics.push({
        severity: "error",
        code: "STRUCTURE_CONFLICT",
        path: `${path}/bars`,
        message: `Section "${section.id}" has invalid bar count ${section.bars}.`,
      });
    }

    const instrumentalDelta = section.deltas.some(
      (d) => d.toLowerCase() === "instrumental",
    );
    if (instrumentalDelta && section.vocal) {
      diagnostics.push({
        severity: "error",
        code: "INSTRUMENTAL_VOCAL_CONFLICT",
        path,
        message: `Section "${section.id}" is tagged instrumental but also has a vocal preset.`,
      });
    }

    const lowerDeltas = section.deltas.map((d) => d.toLowerCase());
    if (
      firstWord(section.name) === "bridge" &&
      lowerDeltas.some(
        (d) => d.includes("minimal") || d.includes("stripped"),
      ) &&
      lowerDeltas.some(
        (d) =>
          d.includes("full") ||
          d.includes("intense") ||
          d.includes("climactic"),
      )
    ) {
      diagnostics.push({
        severity: "warning",
        code: "STRUCTURE_CONFLICT",
        path: `${path}/deltas`,
        message: `Bridge "${section.id}" mixes stripped/minimal and full/intense arrangement cues.`,
      });
    }

    if (firstWord(section.name) === "verse") {
      const priorVerses = input.sections
        .slice(0, index)
        .filter((s) => firstWord(s.name) === "verse");
      if (priorVerses.length === 0) {
        const block = getRenderedSectionBlock(
          rendered.user,
          section,
          input.sections[index + 1],
        ).toLowerCase();
        if (block.includes("previous verse")) {
          diagnostics.push({
            severity: "error",
            code: "INVALID_SECTION_REFERENCE",
            path,
            message: `First verse section "${section.id}" refers to a previous verse.`,
          });
        }
      }
    }
  });

  if (input.lineDensity !== undefined && input.lineDensity <= 0) {
    diagnostics.push({
      severity: "error",
      code: "STRUCTURE_CONFLICT",
      path: "/lineDensity",
      message: `Line density must be positive, received ${input.lineDensity}.`,
    });
  }

  if (!hasCentralBrief(input)) {
    diagnostics.push({
      severity: "warning",
      code: "MISSING_GROUNDING",
      path: "/lyricTopic",
      message:
        "Lyrics request has no topic, themes, or image anchors; output will rely entirely on genre defaults.",
    });
  } else if (
    !input.imageAnchors?.length &&
    ((input.lyricTopic?.length ?? 0) > 80 ||
      (input.lyricThemes?.length ?? 0) > 3)
  ) {
    diagnostics.push({
      severity: "warning",
      code: "MISSING_GROUNDING",
      path: "/imageAnchors",
      message:
        "Specificity-heavy lyric request has no concrete image anchors for grounding.",
    });
  }

  const system = rendered.system;
  if (
    !system.includes("Return ONLY valid JSON") ||
    !system.includes('"lines" must be an array') ||
    !system.includes("specified lyric-line count")
  ) {
    diagnostics.push({
      severity: "error",
      code: "SCHEMA_PROMPT_MISMATCH",
      path: "/system",
      message:
        "System prompt is missing JSON, lines-array, or exact-line-count response contract.",
    });
  }

  return diagnostics;
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
  return `SONIC CONTEXT: ${chars.join(", ")} — leave space in the arrangement for these elements.`;
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
  narrativeArc?: string,
  explicit?: string,
): string {
  if (explicit) return explicit;
  const key = firstWord(name);
  const count = precedingCount(name, allSections, index);

  // ── Narrative-arc-aware purposes ────────────────────────────────
  if (key === "verse") {
    if (narrativeArc === "braggadocio") {
      if (count === 0)
        return "establish the narrator's position, recent wins, and the reaction from the block; show concrete evidence of progress";
      if (count === 1)
        return "introduce the cost, loyalty test, opposition, or consequence created by the narrator's position";
      return "develop the situation toward a decision or confrontation";
    }
    if (narrativeArc === "conscious") {
      if (count === 0)
        return "establish the narrator's perspective and the social or emotional terrain they navigate";
      if (count === 1)
        return "deepen the observation, introduce tension between ideals and reality";
      return "move toward a resolution, acceptance, or call to awareness";
    }
    if (narrativeArc === "abstract") {
      if (count === 0)
        return "establish the central image or sensory impression";
      if (count === 1)
        return "shift or distort the initial image, introduce a counter-impression";
      return "resolve the imagery or let it dissolve";
    }
    // Default: storytelling
    if (count === 0)
      return "introduce the narrator, the encounter, and the initial situation";
    if (count === 1)
      return "advance the story, deepen emotional stakes, or introduce a turn";
    return "develop toward resolution or climax";
  }
  if (key === "chorus" || key === "hook") {
    if (narrativeArc === "braggadocio")
      return "crystallize the central boast or title phrase into one immediate, repeatable line";
    if (fn === "peak")
      return "express the song's central emotional release through one title-worthy phrase";
    return "reinforce the central hook with repetition and variation";
  }
  if (key === "bridge") {
    if (narrativeArc === "braggadocio")
      return "expose what the success costs, whom the narrator still protects, or what feels uncertain despite the wins";
    return "provide contrast and emotional reflection before the final section";
  }
  if (key === "pre-chorus" || key === "prechorus") {
    return "build anticipation, moving from the verse toward the chorus or drop";
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
  index: number,
  allSections: { name: string }[],
  energy?: number,
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
  if (key === "verse") {
    const count = precedingCount(name, allSections, index);
    if (count === 0)
      return "controlled but increasingly urgent; establish the pocket before tightening phrases";
    return "more urgent than the previous verse, with shorter phrases and harder stops";
  }
  if (key === "bridge")
    return "vulnerable and intimate, with space between phrases and fewer but more deliberate words";
  return null;
}

function narrativeProgressionBlock(
  sections: { name: string; fn: string }[],
  allSections: { name: string; fn: string }[],
  narrativeArc?: string,
): string | null {
  const lines: string[] = [];
  for (let i = 0; i < sections.length; i++) {
    const s = sections[i]!;
    const fullDesc = deriveSectionPurpose(
      s.name,
      s.fn,
      i,
      allSections,
      narrativeArc,
    );
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
    input.narrativeArc,
    s.purpose,
  );
  const pocket = deriveSectionPocket(
    s.deltas,
    input.tempoFeel,
    input.flowPattern,
    s.pocket,
  );
  const rhyme = deriveSectionRhyme(input.rhymeStyle, input.energy, s.fn);
  const language = deriveSectionLanguage(
    s.name,
    index,
    allSections,
    input.energy,
    s.deltas,
  );
  const structure = deriveSectionStructure(s.name, s.bars);
  const vocal = isInstrumental ? null : vocalDescription(s.vocal);

  const lines: string[] = [];
  const namePart = `${s.name}${s.deltas.filter((d) => d.toLowerCase() !== "instrumental").length > 0 ? `, ${s.deltas.filter((d) => d.toLowerCase() !== "instrumental").join(", ")}` : ""}`;
  lines.push(`  ${s.id} — ${namePart}`);
  lines.push(
    `         ${s.bars} bars; ${isInstrumental ? "instrumental" : `target exactly ${lineCount} lyric lines`}`,
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
  // ═══════════════════════════════════════════════════════════════════
  // SYSTEM PROMPT — stable songwriting craft rules
  // ═══════════════════════════════════════════════════════════════════

  const systemParts: string[] = [
    `You are a professional songwriter working in the ${input.genreName} genre${
      input.presetLabels.length ? ` (${input.presetLabels.join(", ")})` : ""
    }.`,
    "Write lyrics formatted for Suno AI music generation.",
  ];

  if (input.lyricsGuidance) systemParts.push(input.lyricsGuidance);

  systemParts.push(
    "",
    "OUTPUT FORMAT:",
    "Return ONLY valid JSON — no prose, no markdown fences, no commentary.",
    'Schema: {"sections":[{"id":"<section id>","lines":["line 1","line 2",...]}]}',
    "Rules:",
    "- One entry per section listed below — do not add or skip sections.",
    '- Set "id" to the exact id shown for each section.',
    '- "lines" must be an array of individual strings, NOT a single string with newlines.',
    '- For instrumental sections, return "lines": [].',
    "- Each section must contain exactly its specified lyric-line count.",
  );

  // ═══════════════════════════════════════════════════════════════════
  // USER PROMPT — this song's normalized specification
  // ═══════════════════════════════════════════════════════════════════

  const userParts: string[] = [];

  // ── 1. Song specification (normalized) ──────────────────────────
  const specLines: string[] = ["SONG SPECIFICATION", ""];
  specLines.push(`Genre: ${input.genreName}`);
  if (input.presetLabels.length)
    specLines.push(`Preset: ${input.presetLabels.join(" / ")}`);
  if (input.bpm) {
    if (input.tempoFeel && input.perceivedBpm) {
      specLines.push(
        `Tempo: ${input.bpm} BPM, performed with a ${feelLabel(input.tempoFeel)} pulse felt around ${input.perceivedBpm} BPM.`,
      );
    } else {
      specLines.push(`Tempo: ${input.bpm} BPM`);
    }
  }
  if (input.characteristics?.length)
    specLines.push(
      `Sonic context: ${input.characteristics.join(", ")} — leave space in the arrangement for these elements.`,
    );
  if (input.perspective)
    specLines.push(`Perspective: ${input.perspective.replace(/_/g, " ")}.`);
  if (input.narrativeArc) {
    const arcLine = narrativeArcLine(input.narrativeArc);
    if (arcLine) specLines.push(arcLine);
  }
  if (input.mood || input.energy !== undefined) {
    const moodLine = moodEnergyLine(input.mood, input.energy);
    if (moodLine) specLines.push(moodLine);
  }
  if (input.flowPattern || input.rhymeStyle) {
    const flowLine = flowRhymeLine(input.flowPattern, input.rhymeStyle);
    if (flowLine) specLines.push(flowLine);
  }
  if (input.vocalStyle) {
    const vocalStyle = vocalStyleLine(input.vocalStyle);
    if (vocalStyle) specLines.push(vocalStyle);
  }
  // Angle instruction — only when arc is NOT set (narrative arc instruction
  // already covers it for story/braggadocio arcs).
  if (
    input.lyricAngle &&
    input.narrativeArc !== "story" &&
    input.narrativeArc !== "braggadocio" &&
    input.narrativeArc !== "storytelling"
  ) {
    const angle = ANGLE_INSTRUCTIONS[input.lyricAngle];
    if (angle) specLines.push(angle);
  }

  userParts.push(specLines.join("\n"), "");

  // ── 2. Central brief ────────────────────────────────────────────
  userParts.push(
    `CENTRAL BRIEF: ${input.lyricTopic?.trim() || "(no brief — infer a fitting theme from the genre and presets)"}`,
  );
  if (input.lyricThemes && input.lyricThemes.length > 0) {
    userParts.push(`Themes: ${input.lyricThemes.join(", ")}`);
  }
  if (input.imageAnchors && input.imageAnchors.length > 0) {
    userParts.push(
      `Grounding: ${input.imageAnchors.join("; ")}. Use or build on these concrete details.`,
    );
  }
  userParts.push("");

  // ── 3. Narrative progression ────────────────────────────────────
  if (input.narrativeArc) {
    const prog = narrativeProgressionBlock(
      input.sections,
      input.sections,
      input.narrativeArc,
    );
    if (prog) userParts.push(prog, "");
  }

  // ── 4. Sections ─────────────────────────────────────────────────
  const sectionBlocks = input.sections.map((s, i) =>
    formatSectionBlock(s, input, i, input.sections),
  );
  userParts.push("SECTION SPECIFICATIONS", ...sectionBlocks);

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
  opts?: {
    signal?: AbortSignal;
    maxAttempts?: number;
    traceDir?: string;
    trace?: LyricsWriterTraceOptions;
  },
): Promise<LyricsWriterOutput> {
  const { system, user } = buildLyricsPrompt(input);
  const promptDiagnostics = lintRenderedLyricsRequest(input, { system, user });
  writeLyricsTrace(input, system, user, opts?.traceDir);
  const maxAttempts = opts?.maxAttempts ?? 2;
  const temperature = 0.8;
  const maxTokens = 16384;
  const traceStarted = Date.now();
  const traceId = opts?.trace?.traceId ?? randomUUID();
  const attempts: PromptAttemptTelemetry[] = [];

  let lastError = "unknown error";
  let failureType: LyricsWriterErrorType | undefined;
  let lastIssues: ValidationIssue[] = [];

  const buildManifest = (
    status: PromptManifest["status"],
    response?: LlmResponse,
  ): PromptManifest => {
    const trace = opts?.trace;
    const parsingFailures = attempts.filter(
      (a) => a.errorType === "parse_error",
    ).length;
    const validationFailures = attempts.filter(
      (a) => a.errorType === "schema_error" || a.errorType === "semantic_error",
    ).length;
    return {
      traceId,
      createdAt: new Date(traceStarted).toISOString(),
      provider: trace?.provider ?? "unknown",
      model: response?.model ?? trace?.model ?? "unknown",
      modelParameters: { temperature, maxTokens, seed: trace?.seed },
      promptId: trace?.promptId ?? `lyrics-${input.genreName.toLowerCase()}`,
      promptVersion: trace?.promptVersion ?? "lyrics-writer-v1",
      promptSourcePath: trace?.promptSourcePath ?? "inline",
      promptSourceHash:
        trace?.promptSourceHash ?? sha256(input.lyricsGuidance ?? ""),
      systemPromptHash: sha256(system),
      userPromptHash: sha256(user),
      responseSchemaVersion: "lyrics-writer-response-v1",
      genre: trace?.genre ?? input.genreName,
      preset: trace?.preset ?? (input.presetLabels.join(" / ") || undefined),
      pipelineVersion: trace?.pipelineVersion ?? "1.0.0",
      gitCommit: trace?.gitCommit,
      selectedRuleIds: trace?.selectedRuleIds,
      retryCount: Math.max(0, attempts.length - 1),
      parsingFailures,
      validationFailures,
      repairAttempts: Math.max(0, attempts.length - 1),
      latencyMs: Date.now() - traceStarted,
      tokenUsage: response?.usage ?? attempts.at(-1)?.usage,
      status,
      failureType: status === "failure" ? failureType : undefined,
      failureMessage:
        status === "failure" ? sanitizeMessage(lastError) : undefined,
      attempts,
      diagnostics: promptDiagnostics.length > 0 ? promptDiagnostics : undefined,
      systemPrompt: trace?.capturePromptText ? system : undefined,
      userPrompt: trace?.capturePromptText ? user : undefined,
    };
  };

  const emitManifest = async (
    status: PromptManifest["status"],
    response?: LlmResponse,
  ) => {
    if (!opts?.trace?.onManifest) return;
    await opts.trace.onManifest(buildManifest(status, response));
  };

  const promptErrors = promptDiagnostics.filter((d) => d.severity === "error");
  if (promptErrors.length > 0) {
    failureType = "prompt_lint_error";
    lastError = `prompt lint failed: ${promptErrors.map((d) => d.message).join("; ")}`;
    await emitManifest("failure");
    throw new LyricsWriterError(
      `LyricsWriter: ${sanitizeMessage(lastError)}`,
      failureType,
      [],
      promptDiagnostics,
    );
  }

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const startedAt = new Date().toISOString();
    const startedMs = Date.now();
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

    let response: LlmResponse;
    try {
      response = await llm.complete({
        messages,
        temperature,
        maxTokens,
        responseFormat: "json_object",
        signal: opts?.signal,
      });
    } catch (err) {
      failureType = "provider_error";
      lastError = err instanceof Error ? err.message : String(err);
      attempts.push({
        attempt: attempt + 1,
        startedAt,
        latencyMs: Date.now() - startedMs,
        status: "failure",
        errorType: failureType,
        errorMessage: sanitizeMessage(lastError),
      });
      await emitManifest("failure");
      throw new LyricsWriterError(
        `LyricsWriter: provider error: ${sanitizeMessage(lastError)}`,
        failureType,
      );
    }

    try {
      if (looksLikeProviderRefusal(response.content)) {
        failureType = "provider_refusal";
        lastError = "provider refusal";
        attempts.push({
          attempt: attempt + 1,
          startedAt,
          latencyMs: Date.now() - startedMs,
          status: "failure",
          errorType: failureType,
          errorMessage: lastError,
          model: response.model,
          usage: response.usage,
        });
        await emitManifest("failure", response);
        throw new LyricsWriterError(
          "LyricsWriter: provider refusal",
          failureType,
        );
      }
      const raw = stripFences(response.content);
      const parsed = JSON.parse(raw);
      const validated = ResponseSchema.parse(parsed);
      const result = { sections: validated.sections };
      const issues = validateLyricsSemantics(result, input);
      if (issues.length > 0) {
        throw new LyricsWriterError(
          `semantic validation failed: ${issues.map((i) => i.message).join("; ")}`,
          "semantic_error",
          issues,
        );
      }
      attempts.push({
        attempt: attempt + 1,
        startedAt,
        latencyMs: Date.now() - startedMs,
        status: "success",
        model: response.model,
        usage: response.usage,
      });
      await emitManifest("success", response);
      return result;
    } catch (err) {
      if (err instanceof LyricsWriterError && err.type === "provider_refusal") {
        throw err;
      }
      if (err instanceof SyntaxError) failureType = "parse_error";
      else if (err instanceof z.ZodError) failureType = "schema_error";
      else if (err instanceof LyricsWriterError) failureType = err.type;
      else failureType = "parse_error";

      lastIssues = err instanceof LyricsWriterError ? err.validationIssues : [];
      lastError = err instanceof Error ? err.message : String(err);
      attempts.push({
        attempt: attempt + 1,
        startedAt,
        latencyMs: Date.now() - startedMs,
        status: "failure",
        errorType: failureType,
        errorMessage: sanitizeMessage(lastError),
        validationIssues: lastIssues.length > 0 ? lastIssues : undefined,
        model: response.model,
        usage: response.usage,
      });
    }
  }

  await emitManifest("failure");
  throw new LyricsWriterError(
    `LyricsWriter: model did not return valid lyrics JSON after ${maxAttempts} attempt(s): ${sanitizeMessage(lastError)}`,
    failureType ?? "parse_error",
    lastIssues,
  );
}
