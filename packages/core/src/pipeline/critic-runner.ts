import type {
  CriticFinding,
  CriticSeverity,
  AutoFixPolicy,
} from "@track-forge/contracts";
import type { GenreCritics, CriticDefinition } from "@track-forge/genre-core";
import type { LlmClient } from "../llm/index.js";
import type { PromptContext } from "./types.js";
import { fillTemplate } from "./prompt-assembler.js";

// ── JSON extraction regex ─────────────────────────────────────────────

const JSON_ARRAY_RE = /\[[\s\S]*?\]/;

// ── Run critics ───────────────────────────────────────────────────────

export interface CriticRunOptions {
  /** Use full critics (parallel) instead of fast panel only */
  full?: boolean;
}

/**
 * Run the genre module's critics against compiled song data.
 * By default runs fast panel critic (single call).
 * Set `full: true` to run all full critics in parallel.
 */
export async function runCritics(
  critics: GenreCritics,
  context: PromptContext,
  llm: LlmClient,
  options: CriticRunOptions = {},
  signal?: AbortSignal,
): Promise<CriticFinding[]> {
  if (options.full && critics.full && critics.full.length > 0) {
    return runFullCritics(critics.full, context, llm, signal);
  }

  if (critics.fast) {
    return runSingleCritic(critics.fast, context, llm, signal);
  }

  // Fallback: generic review
  return [];
}

/**
 * Run a single critic (fast panel).
 */
async function runSingleCritic(
  critic: CriticDefinition,
  context: PromptContext,
  llm: LlmClient,
  signal?: AbortSignal,
): Promise<CriticFinding[]> {
  const prompt = fillTemplate(critic.promptTemplate, context);

  const response = await llm.complete({
    messages: [
      {
        role: "system",
        content:
          "You are a music production critic. Review the following song data and return findings as a JSON array. Each finding must have: severity (error|warning|suggestion), field (string), message (string), autoFixPolicy (required|preferred|skipped), patchType (optional), suggestedValue (optional).",
      },
      { role: "user", content: prompt },
    ],
    temperature: 0.3,
    signal,
  });

  return parseFindings(response.content);
}

/**
 * Run all full critics in parallel and merge results.
 */
async function runFullCritics(
  criticDefs: CriticDefinition[],
  context: PromptContext,
  llm: LlmClient,
  signal?: AbortSignal,
): Promise<CriticFinding[]> {
  const results = await Promise.all(
    criticDefs.map((critic) => runSingleCritic(critic, context, llm, signal)),
  );
  return results.flat();
}

// ── Findings parser ───────────────────────────────────────────────────

export function parseFindings(text: string): CriticFinding[] {
  // Strip markdown fences
  let clean = text.trim();
  if (clean.startsWith("```")) {
    const firstNl = clean.indexOf("\n");
    if (firstNl !== -1) clean = clean.slice(firstNl + 1);
    const lastFence = clean.lastIndexOf("```");
    if (lastFence !== -1) clean = clean.slice(0, lastFence);
    clean = clean.trim();
  }

  try {
    const match = clean.match(JSON_ARRAY_RE);
    if (match) {
      const parsed = JSON.parse(match[0]) as unknown[];
      return parsed.filter(isValidFinding).map(normalizeFinding);
    }
  } catch {
    /* fall through */
  }

  return [];
}

function isValidFinding(f: unknown): f is Record<string, unknown> {
  return typeof f === "object" && f !== null;
}

function normalizeFinding(f: Record<string, unknown>): CriticFinding {
  return {
    severity: (f.severity as CriticSeverity) ?? "suggestion",
    field: (f.field as string) ?? "unknown",
    message: (f.message as string) ?? "",
    autoFixPolicy: (f.autoFixPolicy as AutoFixPolicy) ?? "skipped",
    patchType: f.patchType as any,
    suggestedValue: f.suggestedValue as string | undefined,
  };
}
