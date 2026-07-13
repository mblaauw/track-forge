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
  type LyricsFormat,
  CriticSeverity,
  AutoFixPolicy,
} from "@track-forge/contracts";
import type { GenreModule, GenreCritics } from "@track-forge/genre-core";
import type { PipelineDeps, PipelineState, PipelineResult, PromptContext } from "./types.js";
import type { ControlDescriptor } from "@track-forge/contracts";
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
import { PromptAssembler, buildPromptContext, parseControlDescriptors } from "./prompt-assembler.js";
import { runCritics, parseFindings } from "./critic-runner.js";
import { publish } from "./events.js";
import { applyLyricsPatch, isLyricsSectionPatch } from "./lyrics-patcher.js";
import { serializeLyrics } from "../lyrics/canonical.js";
import { createAbortController, cleanupJob } from "./job-abort-controller.js";

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

  const cache = deps.refCache ?? _refCache;
  const interpreted = await interpretReference(
    job.reference,
    job.sourceHash,
    deps.llm,
    cache,
    deps.signal,
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
    maxTokens: 2048,
    signal: deps.signal,
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

  // Check lyrics mode — skip LLM call for strict_instrumental
  let inputs: Record<string, unknown> = {};
  try { inputs = JSON.parse(job.inputs ?? "{}"); } catch { /* ignore */ }
  const lyricsMode = String(inputs.lyricsMode ?? inputs.lyricsFormat ?? "");
  const isStrictInstrumental = lyricsMode === "strict_instrumental";

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

  if (deps.signal?.aborted) throw new DOMException("Job cancelled", "AbortError");

  if (isStrictInstrumental) {
    // Skip lyrics LLM — renderer will produce empty lyrics
    const [styleResult] = await Promise.all([
      deps.llm.complete({
        messages: [{ role: "user", content: stylePrompt }],
        temperature: 0.8,
        maxTokens: 4096,
        signal: deps.signal,
      }),
    ]);

    return {
      ...state,
      styleWriterResult: tryParseStyleResult(styleResult.content),
      lyricsWriterResult: { document: { sections: [], metadata: {} } },
    };
  }

  const lyricsPrompt = assembler.resolvePrompt("lyrics_writing", context)
    ?? `Generate Suno lyrics/structure based on:\n${songPlan}`;

  const [styleResult, lyricsResult] = await Promise.all([
    deps.llm.complete({
      messages: [{ role: "user", content: stylePrompt }],
      temperature: 0.8,
      maxTokens: 4096,
      signal: deps.signal,
    }),
    deps.llm.complete({
      messages: [{ role: "user", content: lyricsPrompt }],
      temperature: 0.8,
      maxTokens: 2048,
      signal: deps.signal,
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

  // Extract lyrics format from inputs if present
  const lyricsFormat = (bp.lyricsMode ?? bp.lyricsFormat ?? null) as LyricsFormat | null;

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
  const lyricsText = (lyricsWriterResult.document.sections.length > 0
    ? serializeLyrics(lyricsWriterResult.document)
    : null) ?? module.renderers.lyrics(bp);

  const compiled: Record<string, string> = {
    title: titleText,
    style: styleText,
    excludedStyles: excludedText,
    lyrics: lyricsText,
    bpm: styleWriterResult.bpm !== null ? String(styleWriterResult.bpm) : "",
    key: styleWriterResult.key ?? "",
    vocalDescription: styleWriterResult.vocalDescription,
    negativeTags: styleWriterResult.negativeTags.join(", "),
    titleCandidates: styleWriterResult.titleCandidates.slice(1).join(" | "),
  };

  let compiledJson = JSON.stringify(compiled);

  // Run blueprint validators
  const blueprintErrors = module.validators.blueprint(bp as Record<string, unknown>);
  if (blueprintErrors.length > 0) {
    throw new Error(`Blueprint validation failed: ${blueprintErrors.map((e) => `${e.field}: ${e.message}`).join("; ")}`);
  }

  return { ...state, compiledJson, lyricsFormat };
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

  // Inject individual compiled fields for critic {{placeholders}}
  try {
    const compiled = JSON.parse(compiledJson) as Record<string, string>;
    context.title = compiled.title ?? "";
    context.style = compiled.style ?? "";
    context.lyrics = compiled.lyrics ?? "";
    context.excluded_styles = compiled.excludedStyles ?? "";
  } catch { /* compiledJson parse failed */ }

  let useFullCritics = false;
  try {
    const inputs = JSON.parse(job.inputs ?? "{}") as Record<string, unknown>;
    useFullCritics = inputs.fullReview === true;
  } catch { /* ignore */ }

  const rawFindings = await runCritics(module.critics, context, deps.llm, {
    full: useFullCritics,
  }, deps.signal);

  const findings = Array.isArray(rawFindings) ? rawFindings.filter(Boolean) : rawFindings;
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

    // Use LyricsPatcher for section-level lyrics patches
    if (key === "lyrics" && isLyricsSectionPatch(p.type)) {
      const lyricsDoc = state.lyricsWriterResult?.document
        ? JSON.stringify(state.lyricsWriterResult.document)
        : null;
      const patched = lyricsDoc ? applyLyricsPatch(lyricsDoc, p) : undefined;
      if (patched) {
        compiled[key] = patched;
      }
      continue;
    }

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
  const { compiledJson, appliedPatch, job, module } = state;

  if (appliedPatch && compiledJson) {
    // Re-run blueprint validator as sanity check
    const bp = parseBlueprint(job, module) as Record<string, unknown>;
    const errors = module.validators.blueprint(bp);
    if (errors.length > 0) {
      throw new Error(`Verification failed after revision: ${errors.map((e) => e.message).join("; ")}`);
    }

    // Re-run critics on patched content
    const context = buildPromptContext({
      genreId: module.id,
      genreName: module.name,
      presetId: job.presetId,
      inputs: job.inputs,
      reference: job.reference,
      interpretedRef: state.interpretedRef,
    });
    context.compiledJson = compiledJson;

    const recheckFindings = await runCritics(module.critics, context, deps.llm, {
      full: false,
    }, deps.signal);

    if (Array.isArray(recheckFindings) && recheckFindings.some(
      (f) => f && f.autoFixPolicy === "required",
    )) {
      throw new Error(`Verification failed: ${recheckFindings
        .filter((f) => f && f.autoFixPolicy === "required")
        .map((f) => f!.message).join("; ")}`);
    }
  }

  return state;
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

  // Store structured writer fields as artifacts
  const { styleWriterResult } = state;
  if (styleWriterResult) {
    if (styleWriterResult.bpm !== null) {
      artifacts.push({ type: "bpm", value: String(styleWriterResult.bpm), versionId: vid });
    }
    if (styleWriterResult.key) {
      artifacts.push({ type: "key", value: styleWriterResult.key, versionId: vid });
    }
    if (styleWriterResult.vocalDescription) {
      artifacts.push({ type: "vocal_description", value: styleWriterResult.vocalDescription, versionId: vid });
    }
    if (styleWriterResult.negativeTags.length > 0) {
      artifacts.push({ type: "negative_tags", value: styleWriterResult.negativeTags.join(", "), versionId: vid });
    }
    if (styleWriterResult.titleCandidates.length > 1) {
      artifacts.push({ type: "title", value: styleWriterResult.titleCandidates.slice(1).join(" | "), versionId: vid });
    }
  }

  // Store patch history as extra artifact if patches applied
  if (patchNotes) {
    artifacts.push({
      type: "patch_notes",
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
  const controller = createAbortController(jobId);
  deps.signal = controller.signal;

  const job = await loadJob(deps.db, jobId as any);
  if (!job) {
    cleanupJob(jobId);
    return { success: false, jobId, versionId: null, error: "Job not found" };
  }

  // Seed from job columns so resumed/cancelled runs pick up persisted artifacts
  const initialState: PipelineState = {
    job,
    module,
    interpretedRef: null,
    songPlan: null,
    styleWriterResult: null,
    lyricsWriterResult: null,
    compiledJson: job.compiledJson ?? null,
    findings: job.findings ? JSON.parse(job.findings) as unknown[] : null,
    appliedPatch: null,
    versionId: null,
    nlAdjustments: parseControlDescriptors(job.nlAdjustments),
    lyricsFormat: null,
  };

  // Override with persisted stage-level state if available
  const saved = await loadPipelineState(deps.db, job.id as any);
  if (saved) {
    initialState.compiledJson = saved.compiledJson ?? initialState.compiledJson;
    initialState.interpretedRef = saved.interpretedRef ?? null;
    initialState.songPlan = saved.songPlan ?? null;
    initialState.styleWriterResult = saved.styleWriterResult ?? null;
    initialState.lyricsWriterResult = saved.lyricsWriterResult ?? null;
    initialState.findings = saved.findings ?? (initialState.findings ?? null);
    initialState.appliedPatch = saved.appliedPatch ?? null;
    initialState.lyricsFormat = saved.lyricsFormat ?? null;
  }

  let state = initialState;

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
      if (deps.signal?.aborted) {
        await publish(deps.db, state.job.id, { stage: currentStage, status: "error", error: "Cancelled" });
        cleanupJob(state.job.id);
        return { success: false, jobId: state.job.id, versionId: null, error: "Cancelled by user" };
      }
      const handler = stageHandlers[currentStage];
      if (!handler) {
        throw new Error(`No handler for stage: ${currentStage}`);
      }

      await publish(deps.db, state.job.id, { stage: currentStage, status: "started" });
      state = await handler(state, deps);
      await publish(deps.db, state.job.id, { stage: currentStage, status: "completed" });

      // Persist state after each stage
      const stageData: StageData = {
        interpretedRef: state.interpretedRef,
        songPlan: state.songPlan,
        styleWriterResult: state.styleWriterResult,
        lyricsWriterResult: state.lyricsWriterResult,
        compiledJson: state.compiledJson,
        findings: state.findings as unknown[] | null | undefined,
        appliedPatch: state.appliedPatch,
        lyricsFormat: state.lyricsFormat,
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
      await publish(deps.db, state.job.id, { stage: currentStage, status: "started" });
      state = await handleVersioning(state, deps);
      await publish(deps.db, state.job.id, { stage: currentStage, status: "completed" });
    }

    cleanupJob(state.job.id);
    return {
      success: true,
      jobId: state.job.id,
      versionId: state.versionId,
      error: null,
    };
  } catch (err) {
    const isTimeout = err instanceof Error && (
      err.message === "Request timed out" ||
      (err.cause instanceof Error && err.cause.message === "Request timed out")
    );
    const isCancel = (err instanceof DOMException && err.name === "AbortError" && !isTimeout)
      || err instanceof DOMException && (err as any).cause?.message === "Cancelled by user";
    const errorMsg = isCancel ? "Cancelled by user" : isTimeout ? "LLM request timed out" : err instanceof Error ? err.message : String(err);
    if (!isCancel) {
      await publish(deps.db, job.id, { stage: currentStage, status: "error", error: errorMsg });
      await failStage(deps.db, job.id, errorMsg);
    }
    cleanupJob(job.id);
    return { success: false, jobId: job.id, versionId: null, error: errorMsg };
  }
}

// ── Helpers ───────────────────────────────────────────────────────────

function parseBlueprint(job: Job, module: GenreModule): Record<string, unknown> {
  if (!job.inputs) return {};
  let inputs: Record<string, unknown>;
  try {
    inputs = JSON.parse(job.inputs) as Record<string, unknown>;
  } catch {
    return {};
  }
  // Compile raw inputs into full blueprint shape if module supports it
  if (module.compileBlueprint && typeof module.compileBlueprint === "function") {
    try {
      return module.compileBlueprint(inputs) as Record<string, unknown>;
    } catch { /* fall through to raw inputs */ }
  }
  return inputs;
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


