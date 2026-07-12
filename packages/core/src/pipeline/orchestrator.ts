import {
  GenerationStage,
  type Job,
  type CriticFinding,
  type SurgicalPatch,
  type PatchType,
  type SunoArtifact,
  type SunoArtifactType,
  type StyleWriterResult,
  type LyricsWriterResult,
  CriticSeverity,
  AutoFixPolicy,
} from "@track-forge/contracts";
import type { GenreModule, GenreCritics } from "@track-forge/genre-core";
import type { PipelineDeps, PipelineState, PipelineResult, PromptContext } from "./types.js";
import { eq } from "drizzle-orm";
import { schema } from "../db/index.js";
import {
  loadJob,
  advanceStage,
  failStage,
  completeJob,
  createVersion,
  savePipelineState,
  loadPipelineState,
} from "./job-service.js";
import type { StageData } from "./job-service.js";
import { ReferenceCache } from "./reference-cache.js";
import { interpretReference, formatInterpretedRef } from "./reference-interpreter.js";
import { PromptAssembler, buildPromptContext } from "./prompt-assembler.js";
import { runCritics, parseFindings } from "./critic-runner.js";
import { publish } from "./events.js";

// ── Reference cache (module-level singleton) ─────────────────────────

const _refCache = new ReferenceCache();

// ── Stage order ───────────────────────────────────────────────────────

const STAGE_ORDER: readonly GenerationStage[] = [
  "ref_interpretation",
  "planning",
  "style_writing",
  "compilation",
  "review",
  "revision",
  "verification",
  "versioning",
] as const;

function nextStage(current: GenerationStage): GenerationStage | undefined {
  const idx = STAGE_ORDER.indexOf(current);
  if (idx === -1 || idx >= STAGE_ORDER.length - 1) return undefined;
  return STAGE_ORDER[idx + 1];
}

// ── Stage: Ref Interpretation ─────────────────────────────────────────

async function handleRefInterpretation(
  state: PipelineState,
  deps: PipelineDeps,
): Promise<PipelineState> {
  const { job } = state;
  if (!job.reference || !job.sourceHash) {
    return { ...state, interpretedRef: null };
  }

  const interpreted = await interpretReference(
    job.reference,
    job.sourceHash,
    deps.llm,
    _refCache,
  );

  return { ...state, interpretedRef: interpreted };
}

// ── Stage: Planning ───────────────────────────────────────────────────

async function handlePlanning(
  state: PipelineState,
  deps: PipelineDeps,
): Promise<PipelineState> {
  const { job, module, interpretedRef } = state;

  const assembler = new PromptAssembler(module);
  const context = buildPromptContext({
    genreId: module.id,
    genreName: module.name,
    presetId: job.presetId,
    inputs: job.inputs,
    reference: job.reference,
    interpretedRef,
    nlAdjustments: state.nlAdjustments,
  });
  const prompt = assembler.resolvePrompt("planning", context)
    ?? `Create a song plan based on:\n${job.inputs ?? "{}"}`;

  const response = await deps.llm.complete({
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
  });

  return { ...state, songPlan: response.content };
}

// ── Stage: Writing (style + lyrics in parallel) ──────────────────────

async function handleWriting(
  state: PipelineState,
  deps: PipelineDeps,
): Promise<PipelineState> {
  const { job, module, songPlan, interpretedRef } = state;
  if (!songPlan) throw new Error("Pipeline state missing songPlan before writing");

  const assembler = new PromptAssembler(module);
  const context = buildPromptContext({
    genreId: module.id,
    genreName: module.name,
    presetId: job.presetId,
    inputs: job.inputs,
    reference: job.reference,
    interpretedRef,
    nlAdjustments: state.nlAdjustments,
  });
  // Inject plan into context for {{plan}} placeholder
  context.plan = songPlan;

  const stylePrompt = assembler.resolvePrompt("style_writing", context)
    ?? `Generate Suno style description based on:\n${songPlan}`;
  const lyricsPrompt = assembler.resolvePrompt("lyrics_writing", context)
    ?? `Generate Suno lyrics/structure based on:\n${songPlan}`;

  const [styleResult, lyricsResult] = await Promise.all([
    deps.llm.complete({
      messages: [{ role: "user", content: stylePrompt }],
      temperature: 0.8,
    }),
    deps.llm.complete({
      messages: [{ role: "user", content: lyricsPrompt }],
      temperature: 0.8,
    }),
  ]);

  const styleWriterResult = tryParseStyleResult(styleResult.content);
  const lyricsWriterResult = tryParseLyricsResult(lyricsResult.content);

  return {
    ...state,
    styleWriterResult,
    lyricsWriterResult,
  };
}

// ── Stage: Compilation ────────────────────────────────────────────────

async function handleCompilation(
  state: PipelineState,
  deps: PipelineDeps,
): Promise<PipelineState> {
  const { job, module, styleWriterResult, lyricsWriterResult, songPlan, interpretedRef } = state;
  if (!styleWriterResult || !lyricsWriterResult) {
    throw new Error("Pipeline state missing style/lyrics results before compilation");
  }

  const bp = parseBlueprint(job, module) as Record<string, unknown>;

  // Use the assembler for compilation context (includes raw outputs for potential fragment use)
  const assembler = new PromptAssembler(module);
  const context = buildPromptContext({
    genreId: module.id,
    genreName: module.name,
    presetId: job.presetId,
    inputs: job.inputs,
    reference: job.reference,
    interpretedRef,
    nlAdjustments: state.nlAdjustments,
  });
  context.styleDescription = styleWriterResult.descriptiveStyle;
  context.lyricsDocument = JSON.stringify(lyricsWriterResult.document);
  context.songPlan = songPlan ?? "";
  context.compilation = JSON.stringify(bp);

  // Run any compile-time fragments first (resolves {{placeholders}} in compilation fragments)
  assembler.resolvePrompt("compilation", context);

  // Blend structured writer results into compiled artifacts
  const styleText = styleWriterResult.descriptiveStyle || module.renderers.style(bp);
  const excludedText = module.renderers.excludedStyles(bp);
  const titleText = styleWriterResult.titleCandidates[0] ?? module.renderers.title(bp);
  const lyricsText = module.renderers.lyrics(bp);

  const compiled: Record<string, string> = {
    title: titleText,
    style: styleText,
    excludedStyles: excludedText,
    lyrics: lyricsText,
  };

  let compiledJson = JSON.stringify(compiled);

  // Run blueprint validators
  const blueprintErrors = module.validators.blueprint(bp as Record<string, unknown>);
  if (blueprintErrors.length > 0) {
    throw new Error(`Blueprint validation failed: ${blueprintErrors.map((e) => `${e.field}: ${e.message}`).join("; ")}`);
  }

  return { ...state, compiledJson };
}

// ── Stage: Review ─────────────────────────────────────────────────────

async function handleReview(
  state: PipelineState,
  deps: PipelineDeps,
): Promise<PipelineState> {
  const { compiledJson, job, module, interpretedRef } = state;
  if (!compiledJson) throw new Error("Pipeline state missing compiledJson before review");

  const context = buildPromptContext({
    genreId: module.id,
    genreName: module.name,
    presetId: job.presetId,
    inputs: job.inputs,
    reference: job.reference,
    interpretedRef,
    nlAdjustments: state.nlAdjustments,
  });
  context.compiledJson = compiledJson;
  context.styleResult = state.styleWriterResult ? JSON.stringify(state.styleWriterResult) : "";
  context.lyricsResult = state.lyricsWriterResult ? JSON.stringify(state.lyricsWriterResult.document) : "";
  context.songPlan = state.songPlan ?? "";

  let useFullCritics = false;
  try {
    const inputs = JSON.parse(job.inputs ?? "{}") as Record<string, unknown>;
    useFullCritics = inputs.fullReview === true;
  } catch { /* ignore */ }

  const findings = await runCritics(module.critics, context, deps.llm, {
    full: useFullCritics,
  });

  return { ...state, findings };
}

// ── Stage: Revision ───────────────────────────────────────────────────

async function handleRevision(
  state: PipelineState,
  deps: PipelineDeps,
): Promise<PipelineState> {
  const { compiledJson, findings, job, module } = state;

  // When restarting from review pause, load state from job columns
  const effCompiled = compiledJson ?? job.compiledJson;
  const effFindings: CriticFinding[] | null = findings
    ? (findings as unknown as CriticFinding[])
    : (job.findings ? JSON.parse(job.findings) as CriticFinding[] : null);

  if (!effCompiled || !effFindings || effFindings.length === 0) {
    return state;
  }

  const patches: SurgicalPatch[] = [];
  for (const f of effFindings) {
    if (f.autoFixPolicy === "required" && f.patchType && f.suggestedValue) {
      patches.push({
        type: f.patchType as PatchType,
        target: f.field,
        value: f.suggestedValue,
        description: f.message,
      });
    }

    if (f.autoFixPolicy === "preferred" && f.patchType && f.suggestedValue && f.severity === "warning") {
      patches.push({
        type: f.patchType as PatchType,
        target: f.field,
        value: f.suggestedValue,
        description: f.message,
      });
    }
  }

  if (patches.length === 0) {
    return state;
  }

  // Apply patches to compiled output with fallback
  const compiled = JSON.parse(effCompiled) as Record<string, string>;
  const fallback = { ...compiled };

  for (const p of patches) {
    const key = p.target as keyof typeof compiled;
    if (!(key in compiled)) continue;

    switch (p.type) {
      case "merge_field":
        // Append to existing content
        compiled[key] = compiled[key] + "\n" + p.value;
        break;
      case "remove_field":
        // Clear field (cannot delete from object, set empty)
        compiled[key] = "";
        break;
      default:
        // Replace field value
        compiled[key] = p.value;
    }
  }

  // Validate patched output — fallback to original if invalid
  const patchedCompiledJson = JSON.stringify(compiled);
  try {
    const bp = parseBlueprint(job, module) as Record<string, unknown>;
    // Re-run only if blueprint changed
    if (patches.some((p) => p.target === "inputs" || p.target === "input")) {
      const errors = module.validators.blueprint(bp);
      if (errors.length > 0) {
        // Fallback: revert to original
        return { ...state, appliedPatch: JSON.stringify(patches) };
      }
    }
  } catch {
    // Validation failed — use fallback
    const fallbackJson = JSON.stringify(fallback);
    return { ...state, compiledJson: fallbackJson, appliedPatch: JSON.stringify(patches) };
  }

  const appliedPatch = JSON.stringify(patches);
  return { ...state, appliedPatch, compiledJson: patchedCompiledJson };
}

// ── Stage: Verification ───────────────────────────────────────────────

async function handleVerification(
  state: PipelineState,
  deps: PipelineDeps,
): Promise<PipelineState> {
  const { compiledJson, appliedPatch, job } = state;

  // If there was a patch applied, do basic verification
  if (appliedPatch) {
    JSON.parse(appliedPatch) as SurgicalPatch[];
    // Re-run blueprint validator as sanity check
    const bp = parseBlueprint(job, state.module) as Record<string, unknown>;
    const errors = state.module.validators.blueprint(bp);
    if (errors.length > 0) {
      throw new Error(`Verification failed after revision: ${errors.map((e) => e.message).join("; ")}`);
    }
  }

  return state; // Pass through
}

// ── Stage: Versioning ─────────────────────────────────────────────────

async function handleVersioning(
  state: PipelineState,
  deps: PipelineDeps,
): Promise<PipelineState> {
  const { job, compiledJson } = state;
  if (!compiledJson) throw new Error("Pipeline state missing compiledJson before versioning");

  const compiled = JSON.parse(compiledJson) as Record<string, string>;

  // Create version (empty artifacts initially, updated below)
  const version = await createVersion(deps.db, job.id, [], "final");
  const vid = version.id;

  // Attach patch history if available
  const patchNotes = state.appliedPatch
    ? `Patches: ${(JSON.parse(state.appliedPatch) as SurgicalPatch[]).map((p) => p.description).join("; ")}`
    : "";

  const artifacts: SunoArtifact[] = [
    { type: "title", value: compiled.title ?? "", versionId: vid },
    { type: "style", value: compiled.style ?? "", versionId: vid },
    { type: "excluded_styles", value: compiled.excludedStyles ?? "", versionId: vid },
    { type: "lyrics", value: compiled.lyrics ?? "", versionId: vid },
  ];

  // Store patch history as extra artifact if patches applied
  if (patchNotes) {
    artifacts.push({
      type: "title" as any,
      value: patchNotes,
      versionId: vid,
    });
  }

  // Update version with real artifacts (replaces initial empty artifacts)
  await deps.db
    .update(schema.versions)
    .set({ artifacts: JSON.stringify(artifacts) })
    .where(eq(schema.versions.id, vid));
  await completeJob(deps.db, job.id);

  return { ...state, versionId: vid };
}

// ── Main orchestrator ─────────────────────────────────────────────────

export async function runPipeline(
  jobId: string,
  deps: PipelineDeps,
  module: GenreModule,
): Promise<PipelineResult> {
  const job = await loadJob(deps.db, jobId as any);
  if (!job) {
    return { success: false, jobId, versionId: null, error: "Job not found" };
  }

  let state: PipelineState = {
    job,
    module,
    interpretedRef: null,
    songPlan: null,
    styleWriterResult: null,
    lyricsWriterResult: null,
    compiledJson: null,
    findings: null,
    appliedPatch: null,
    versionId: null,
    nlAdjustments: job.nlAdjustments ?? null,
  };

  // Restore persisted pipeline state if available
  const saved = await loadPipelineState(deps.db, job.id as any);
  if (saved) {
    state = {
      ...state,
      interpretedRef: saved.interpretedRef ?? null,
      songPlan: saved.songPlan ?? null,
      styleWriterResult: saved.styleWriterResult ?? null,
      lyricsWriterResult: saved.lyricsWriterResult ?? null,
      compiledJson: saved.compiledJson ?? null,
      findings: saved.findings ?? null,
      appliedPatch: saved.appliedPatch ?? null,
    };
  }

  const stageHandlers: Record<string, (s: PipelineState, d: PipelineDeps) => Promise<PipelineState>> = {
    ref_interpretation: handleRefInterpretation,
    planning: handlePlanning,
    style_writing: handleWriting,
    compilation: handleCompilation,
    review: handleReview,
    revision: handleRevision,
    verification: handleVerification,
    versioning: handleVersioning,
  };

  let currentStage: GenerationStage = state.job.currentStage;

  try {
    // Process all stages before versioning
    while (currentStage !== "versioning") {
      const handler = stageHandlers[currentStage];
      if (!handler) {
        throw new Error(`No handler for stage: ${currentStage}`);
      }

      publish(state.job.id, { stage: currentStage, status: "started" });
      state = await handler(state, deps);
      publish(state.job.id, { stage: currentStage, status: "completed" });

      // Persist state after each stage
      const stageData: StageData = {
        interpretedRef: state.interpretedRef,
        songPlan: state.songPlan,
        styleWriterResult: state.styleWriterResult,
        lyricsWriterResult: state.lyricsWriterResult,
        compiledJson: state.compiledJson,
        findings: state.findings as unknown[] | null | undefined,
        appliedPatch: state.appliedPatch,
      };
      await savePipelineState(deps.db, state.job.id as any, stageData);

      // ── Pause after revision if human-review findings remain ────────
      if (currentStage === "revision" && state.findings) {
        const remainingFindings = (state.findings as unknown as CriticFinding[]).filter(
          (f) => f.autoFixPolicy === "skipped" || !f.patchType || !f.suggestedValue,
        );
        if (remainingFindings.length > 0) {
          const now = new Date().toISOString();
          await deps.db
            .update(schema.jobs)
            .set({
              findings: JSON.stringify(state.findings),
              compiledJson: state.compiledJson,
              updatedAt: now,
            })
            .where(eq(schema.jobs.id, state.job.id));
          break;
        }
      }

      const next = nextStage(currentStage);
      if (!next) break;

      // Update DB with new stage
      state.job = await advanceStage(deps.db, state.job.id, next);
      currentStage = next;
    }

    // Final versioning stage (handles completion internally)
    if (currentStage === "versioning") {
      publish(state.job.id, { stage: currentStage, status: "started" });
      state = await handleVersioning(state, deps);
      publish(state.job.id, { stage: currentStage, status: "completed" });
    }

    return {
      success: true,
      jobId: state.job.id,
      versionId: state.versionId,
      error: null,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    publish(job.id, { stage: currentStage, status: "error", error: errorMsg });
    await failStage(deps.db, job.id, errorMsg);
    return { success: false, jobId: job.id, versionId: null, error: errorMsg };
  }
}

// ── Helpers ───────────────────────────────────────────────────────────

function parseBlueprint(job: Job, module: GenreModule): unknown {
  if (!job.inputs) return {};
  try {
    return JSON.parse(job.inputs);
  } catch {
    return {};
  }
}

function tryParseStyleResult(content: string): StyleWriterResult {
  try {
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed === "object" && Array.isArray(parsed.titleCandidates)) {
      return {
        titleCandidates: parsed.titleCandidates ?? [],
        descriptiveStyle: String(parsed.descriptiveStyle ?? parsed.style ?? ""),
        negativeTags: Array.isArray(parsed.negativeTags) ? parsed.negativeTags : [],
        bpm: typeof parsed.bpm === "number" ? parsed.bpm : null,
        key: typeof parsed.key === "string" ? parsed.key : null,
        vocalDescription: String(parsed.vocalDescription ?? parsed.vocal ?? ""),
      };
    }
  } catch { /* not JSON */ }
  return {
    titleCandidates: [],
    descriptiveStyle: content,
    negativeTags: [],
    bpm: null,
    key: null,
    vocalDescription: "",
  };
}

function tryParseLyricsResult(content: string): LyricsWriterResult {
  try {
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed === "object" && parsed.document) {
      return { document: parsed.document };
    }
    if (parsed && typeof parsed === "object" && Array.isArray(parsed.sections)) {
      return { document: parsed as any };
    }
  } catch { /* not JSON */ }
  return {
    document: {
      sections: [],
      metadata: {},
    },
  };
}


