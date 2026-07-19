import type {
  GenerationStage,
  InterpretedReference,
  ControlDescriptor,
} from "@track-forge/contracts";
import type { GenreModule } from "@track-forge/genre-core";
import type { PromptContext, PromptManifest } from "./types.js";

// ── Fragment key resolution maps ──────────────────────────────────────

/**
 * Maps canonical pipeline stage → genre fragment key candidates.
 * First key found in fragments is used; if none, fallback template used.
 */
const FRAGMENT_KEYS: Record<string, string[]> = {
  planning: ["planning"],
  style_writing: ["style_writing", "style"],
  lyrics_writing: [
    "lyrics_writing",
    "lyrics_full",
    "lyrics_hook",
    "lyrics_instrumental",
    "lyrics",
  ],
};

// ── Fallback templates ────────────────────────────────────────────────

const FALLBACKS: Record<string, string> = {
  planning: `Create a song plan based on the following inputs:\n{{context}}\nGenerate a structured plan including arrangement, instrumentation, and mood progression.`,
  style_writing: `Write a Suno AI music style prompt based on this plan:\n{{plan}}\nInclude genre, mood, tempo, instrumentation, and production characteristics. Be concise.\n\nReturn your answer as valid JSON matching this schema:\n{\n  "titleCandidates": ["suggested title 1", "suggested title 2"],\n  "descriptiveStyle": "the style description text",\n  "negativeTags": ["tag_to_avoid"],\n  "bpm": 140,\n  "key": "C",\n  "vocalDescription": "vocal style notes"\n}`,
  lyrics_writing: `Write lyrics/structure based on this plan:\n{{plan}}\nFollow the song structure specified. Use section markers like [Verse], [Chorus], [Bridge].\n\nReturn your answer as valid JSON matching this schema:\n{\n  "document": {\n    "bpm": 140,\n    "key": "Am",\n    "genre": "genre name",\n    "sections": [\n      { "type": "verse", "lines": ["line 1", "line 2"], "bars": 8, "tags": [], "instrumental": false }\n    ],\n    "metadata": {}\n  }\n}`,
};

export const PROMPT_STAGES: GenerationStage[] = [
  "planning",
  "style_writing",
  "lyrics_writing",
];

// ── Assembler ─────────────────────────────────────────────────────────

export class PromptAssembler {
  private fragments: Record<string, string>;

  constructor(module: GenreModule) {
    this.fragments = module.promptFragments;
  }

  /**
   * Build prompt manifest for all pipeline stages.
   */
  buildManifest(context: PromptContext): PromptManifest {
    const manifest: PromptManifest = {};

    for (const stage of PROMPT_STAGES) {
      const resolved = this.resolvePrompt(stage, context);
      if (resolved) {
        manifest[stage] = resolved;
      }
    }

    return manifest;
  }

  /**
   * Resolve a single stage prompt.
   * Tries genre fragment keys first, falls back to default template.
   */
  resolvePrompt(stage: string, context: PromptContext): string | null {
    const keys = FRAGMENT_KEYS[stage];
    let template: string | null = null;

    if (keys) {
      for (const key of keys) {
        if (this.fragments[key]) {
          template = this.fragments[key];
          break;
        }
      }
    }

    if (!template) {
      template = FALLBACKS[stage] ?? null;
    }

    if (!template) return null;

    return fillTemplate(template, context);
  }
}

// ── Template filler ───────────────────────────────────────────────────

/**
 * Fill {{placeholders}} in a template from context.
 * Supports dotted paths: {{inputs.field}} → context["inputs.field"].
 * Falls back to empty string for unknown placeholders.
 */
export function fillTemplate(template: string, context: PromptContext): string {
  return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, key: string) => {
    const value = resolveKey(key, context);
    if (value === null || value === undefined) return "";
    if (Array.isArray(value)) return value.join(", ");
    return String(value);
  });
}

function resolveKey(key: string, context: PromptContext): unknown {
  // Direct key lookup
  if (key in context) return context[key];

  // Dotted path: inputs.field, blueprint.field
  const parts = key.split(".");
  if (parts.length === 2) {
    const section = parts[0]!;
    const field = parts[1]!;
    const parent = context[section];
    if (parent && typeof parent === "object") {
      return (parent as Record<string, unknown>)[field];
    }
  }

  return undefined;
}

// ── Control descriptor formatting ─────────────────────────────────────

/**
 * Convert ControlDescriptor[] into a human-readable string for prompt injection.
 * Falls back to raw text if descriptors are empty.
 */
export function formatControlDescriptors(
  descriptors: ControlDescriptor[] | null | string,
): string {
  if (!descriptors || (Array.isArray(descriptors) && descriptors.length === 0))
    return "";

  if (typeof descriptors === "string") return descriptors;

  return descriptors
    .map((d) => {
      const val = Array.isArray(d.value) ? d.value.join(", ") : String(d.value);
      return `${d.operator} ${d.parameter} = ${val}`;
    })
    .join("\n");
}

/**
 * Parse raw nlAdjustments string into ControlDescriptor[].
 * Backward compat: plain text becomes a single descriptor.
 */
export function parseControlDescriptors(
  raw: string | null,
): ControlDescriptor[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as ControlDescriptor[];
  } catch {
    /* not JSON — treat as plain text */
  }
  return [
    { parameter: "instruction", operator: "set", value: raw, confidence: 0.3 },
  ];
}

// ── Reference sanitizer ────────────────────────────────────────────────

const URL_RE = /https?:\/\/[^\s,;)]+/g;
const MAX_RAW_LENGTH = 500;

/**
 * Sanitize user-provided reference text for safe prompt injection.
 * Strips URLs and truncates.
 */
export function sanitizeReference(
  raw: string | null,
  _interpretedRef: InterpretedReference | null,
): string | null {
  if (!raw) return null;

  // Only raw text available — strip URLs and truncate
  const cleaned = raw.replace(URL_RE, "").replace(/\s+/g, " ").trim();
  if (cleaned.length <= MAX_RAW_LENGTH) return cleaned;
  return cleaned.slice(0, MAX_RAW_LENGTH) + "...";
}

// ── Context builder ───────────────────────────────────────────────────

/**
 * Build PromptContext from pipeline state inputs.
 * Reference text is sanitized before injection into prompt templates.
 */
export function buildPromptContext(params: {
  genreId: string;
  genreName: string;
  presetId: string;
  inputs: string | null;
  reference: string | null;
  interpretedRef: InterpretedReference | null;
  nlAdjustments?: ControlDescriptor[] | string | null;
}): PromptContext {
  const inputs: Record<string, unknown> = {};
  if (params.inputs) {
    try {
      Object.assign(inputs, JSON.parse(params.inputs));
    } catch {
      /* ignore parse errors */
    }
  }

  const context: PromptContext = {
    // Spread inputs first so reserved fields below always win
    ...inputs,
    genreId: params.genreId,
    genreName: params.genreName,
    presetId: params.presetId,
    reference: sanitizeReference(params.reference, params.interpretedRef),
    interpretedRef: params.interpretedRef
      ? String(params.interpretedRef)
      : null,
    nlAdjustments: formatControlDescriptors(params.nlAdjustments ?? null),
  };

  return context;
}
