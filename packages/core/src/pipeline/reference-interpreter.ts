import type { SourceHash, InterpretedReference } from "@track-forge/contracts";
import type { LlmClient } from "../llm/index.js";
import { ReferenceCache } from "./reference-cache.js";

// ── Prompt template ───────────────────────────────────────────────────

const INTERPRET_PROMPT = `You are a music analysis AI. Analyze the following reference material and extract structured information for use in generating a Suno AI music prompt.

Return ONLY valid JSON with no markdown formatting, no code fences, no explanation text:

{
  "genre": "primary genre",
  "subgenre": "subgenre or null",
  "mood": "mood/tone description (1-2 sentences)",
  "tempo": "tempo feel or BPM range",
  "key": "musical key or null",
  "structure": ["section types detected, e.g. verse, chorus, bridge"],
  "instrumentation": ["instruments or sound sources"],
  "production": ["production characteristics"],
  "lyricalThemes": ["themes and subject matter"],
  "rhymeScheme": "rhyme pattern or null",
  "vocalStyle": "vocal style or null",
  "suggestedTags": ["tags for Suno style prompt"],
  "negativeTags": ["tags to explicitly avoid"]
}

Reference material:
`;

// ── Interpreter ───────────────────────────────────────────────────────

export async function interpretReference(
  reference: string,
  sourceHash: SourceHash,
  llm: LlmClient,
  cache?: ReferenceCache,
): Promise<InterpretedReference> {
  // Check cache first
  if (cache?.has(sourceHash)) {
    return cache.get(sourceHash)!;
  }

  // Call LLM
  const response = await llm.complete({
    messages: [
      { role: "system", content: "You are a music analysis assistant. Return only valid JSON." },
      { role: "user", content: INTERPRET_PROMPT + reference },
    ],
    temperature: 0.3,
    maxTokens: 1500,
  });

  // Parse response
  const parsed = parseInterpretation(response.content, sourceHash);

  // Cache result
  cache?.set(sourceHash, parsed);

  return parsed;
}

// ── Response parser ───────────────────────────────────────────────────

export function parseInterpretation(
  text: string,
  sourceHash: SourceHash,
): InterpretedReference {
  // Strip markdown code fences if present
  let clean = text.trim();
  if (clean.startsWith("```")) {
    const firstNl = clean.indexOf("\n");
    if (firstNl !== -1) {
      clean = clean.slice(firstNl + 1);
    }
    const lastFence = clean.lastIndexOf("```");
    if (lastFence !== -1) {
      clean = clean.slice(0, lastFence);
    }
    clean = clean.trim();
  }

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(clean) as Record<string, unknown>;
  } catch {
    // Fallback: treat entire response as raw analysis
    return {
      sourceHash,
      genre: "unknown",
      subgenre: null,
      mood: "unknown",
      tempo: "unknown",
      key: null,
      structure: [],
      instrumentation: [],
      production: [],
      lyricalThemes: [],
      rhymeScheme: null,
      vocalStyle: null,
      suggestedTags: [],
      negativeTags: [],
      rawAnalysis: clean,
    };
  }

  return {
    sourceHash,
    genre: stringField(raw, "genre", "unknown"),
    subgenre: nullableString(raw, "subgenre"),
    mood: stringField(raw, "mood", "unknown"),
    tempo: stringField(raw, "tempo", "unknown"),
    key: nullableString(raw, "key"),
    structure: stringArray(raw, "structure"),
    instrumentation: stringArray(raw, "instrumentation"),
    production: stringArray(raw, "production"),
    lyricalThemes: stringArray(raw, "lyricalThemes"),
    rhymeScheme: nullableString(raw, "rhymeScheme"),
    vocalStyle: nullableString(raw, "vocalStyle"),
    suggestedTags: stringArray(raw, "suggestedTags"),
    negativeTags: stringArray(raw, "negativeTags"),
    rawAnalysis: clean,
  };
}

// ── Format for prompt context ─────────────────────────────────────────

export function formatInterpretedRef(ref: InterpretedReference): string {
  const lines: string[] = [];
  lines.push(`Genre: ${ref.genre}${ref.subgenre ? ` (${ref.subgenre})` : ""}`);
  lines.push(`Mood: ${ref.mood}`);
  lines.push(`Tempo: ${ref.tempo}`);
  if (ref.key) lines.push(`Key: ${ref.key}`);
  if (ref.structure.length > 0) lines.push(`Structure: ${ref.structure.join(", ")}`);
  if (ref.instrumentation.length > 0) lines.push(`Instrumentation: ${ref.instrumentation.join(", ")}`);
  if (ref.production.length > 0) lines.push(`Production: ${ref.production.join(", ")}`);
  if (ref.lyricalThemes.length > 0) lines.push(`Lyrical Themes: ${ref.lyricalThemes.join(", ")}`);
  if (ref.vocalStyle) lines.push(`Vocal Style: ${ref.vocalStyle}`);
  if (ref.rhymeScheme) lines.push(`Rhyme Scheme: ${ref.rhymeScheme}`);
  if (ref.suggestedTags.length > 0) lines.push(`Suggested Tags: ${ref.suggestedTags.join(", ")}`);
  if (ref.negativeTags.length > 0) lines.push(`Avoid: ${ref.negativeTags.join(", ")}`);
  return lines.join("\n");
}

// ── Field helpers ─────────────────────────────────────────────────────

function stringField(obj: Record<string, unknown>, key: string, fallback: string): string {
  const v = obj[key];
  return typeof v === "string" && v.length > 0 ? v : fallback;
}

function nullableString(obj: Record<string, unknown>, key: string): string | null {
  const v = obj[key];
  return typeof v === "string" && v.length > 0 ? v : null;
}

function stringArray(obj: Record<string, unknown>, key: string): string[] {
  const v = obj[key];
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}
