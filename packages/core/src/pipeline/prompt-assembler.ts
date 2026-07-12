import type { GenerationStage, InterpretedReference } from "@track-forge/contracts";
import type { GenreModule } from "@track-forge/genre-core";
import type { PromptContext, PromptManifest } from "./types.js";
import { formatInterpretedRef } from "./reference-interpreter.js";

// ── Fragment key resolution maps ──────────────────────────────────────

/**
 * Maps canonical pipeline stage → genre fragment key candidates.
 * First key found in fragments is used; if none, fallback template used.
 */
const FRAGMENT_KEYS: Record<string, string[]> = {
  planning: ["planning"],
  style_writing: ["style_writing", "style"],
  lyrics_writing: ["lyrics_writing", "lyrics_full", "lyrics_instrumental", "lyrics"],
  compilation: ["compilation"],
  review: ["review"],
  revision: ["revision"],
  verification: ["verification"],
};

// ── Fallback templates ────────────────────────────────────────────────

const FALLBACKS: Record<string, string> = {
  planning: `Create a song plan based on the following inputs:\n{{context}}\nGenerate a structured plan including arrangement, instrumentation, and mood progression.`,
  style_writing: `Write a Suno AI music style prompt based on this plan:\n{{plan}}\nInclude genre, mood, tempo, instrumentation, and production characteristics. Be concise.`,
  lyrics_writing: `Write lyrics/structure based on this plan:\n{{plan}}\nFollow the song structure specified. Use section markers like [Verse], [Chorus], [Bridge].`,
  review: `Review the following song for quality and coherence. Return findings as JSON array with format:\n[{"severity":"error|warning|suggestion","field":"style|lyrics|structure","message":"description","autoFixPolicy":"required|preferred|skipped","patchType":"replace_style_description|replace_negative_tags|replace_lyrics_section|replace_selected_text|input_patch","suggestedValue":"fix"}]\n\nSong data:\n{{compiledJson}}\n\nCheck: style coherence, lyrics fit, structure completeness, tag correctness, genre alignment.`,
};

export const PROMPT_STAGES: GenerationStage[] = [
  "planning",
  "style_writing",
  "lyrics_writing",
  "compilation",
  "review",
  "revision",
  "verification",
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

// ── Context builder ───────────────────────────────────────────────────

/**
 * Build PromptContext from pipeline state inputs.
 */
export function buildPromptContext(params: {
  genreId: string;
  genreName: string;
  presetId: string;
  inputs: string | null;
  reference: string | null;
  interpretedRef: InterpretedReference | null;
}): PromptContext {
  const inputs: Record<string, unknown> = {};
  if (params.inputs) {
    try {
      Object.assign(inputs, JSON.parse(params.inputs));
    } catch { /* ignore parse errors */ }
  }

  const context: PromptContext = {
    genreId: params.genreId,
    genreName: params.genreName,
    presetId: params.presetId,
    reference: params.reference,
    interpretedRef: params.interpretedRef ? formatInterpretedRef(params.interpretedRef) : null,
    ...inputs,
  };

  return context;
}
