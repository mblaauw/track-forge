import {
  GenerationStage,
  type Job,
  type CriticFinding,
  type SurgicalPatch,
  type PatchType,
  type SunoArtifact,
  type SunoArtifactType,
  CriticSeverity,
  AutoFixPolicy,
} from "@track-forge/contracts";
import type { GenreModule, GenreCritics } from "@track-forge/genre-core";
import type { PipelineDeps, PipelineState, PipelineResult, PromptContext } from "./types.js";
import {
  loadJob,
  advanceStage,
  failStage,
  completeJob,
  createVersion,
} from "./job-service.js";
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

  return {
    ...state,
    rawStyle: styleResult.content,
    rawLyrics: lyricsResult.content,
  };
}

// ── Stage: Compilation ────────────────────────────────────────────────

async function handleCompilation(
  state: PipelineState,
  deps: PipelineDeps,
): Promise<PipelineState> {
  const { job, module, rawStyle, rawLyrics, songPlan, interpretedRef } = state;
  if (!rawStyle || !rawLyrics) {
    throw new Error("Pipeline state missing style/lyrics before compilation");
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
  });
  context.rawStyle = rawStyle;
  context.rawLyrics = rawLyrics;
  context.songPlan = songPlan ?? "";
  context.compilation = JSON.stringify(bp);

  // Run any compile-time fragments first (resolves {{placeholders}} in compilation fragments)
  assembler.resolvePrompt("compilation", context);

  // Deterministic compilation from blueprint via renderers
  const styleText = module.renderers.style(bp);
  const excludedText = module.renderers.excludedStyles(bp);
  const titleText = module.renderers.title(bp);
  const lyricsText = module.renderers.lyrics(bp);

  const compiled: Record<string, string> = {
    title: titleText,
    style: styleText,
    excludedStyles: excludedText,
    lyrics: lyricsText,
  };

  const compiledJson = JSON.stringify(compiled);

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
  });
  context.compiledJson = compiledJson;
  context.rawStyle = state.rawStyle ?? "";
  context.rawLyrics = state.rawLyrics ?? "";
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
  if (!compiledJson || !findings || findings.length === 0) {
    return state;
  }

  const patches: SurgicalPatch[] = [];
  for (const f of findings as unknown as CriticFinding[]) {
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

  // Apply patches to compiled output
  const compiled = JSON.parse(compiledJson) as Record<string, string>;
  for (const p of patches) {
    // Patches target fields like "style", "lyrics", "title", "excludedStyles"
    const key = p.target as keyof typeof compiled;
    if (key in compiled && typeof compiled[key] === "string") {
      compiled[key] = p.value;
    }
  }
  const patchedCompiledJson = JSON.stringify(compiled);

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

  const version = await createVersion(deps.db, job.id, [], "final");
  const vid = version.id;

  const artifacts: SunoArtifact[] = [
    { type: "title", value: compiled.title ?? "", versionId: vid },
    { type: "style", value: compiled.style ?? "", versionId: vid },
    { type: "excluded_styles", value: compiled.excludedStyles ?? "", versionId: vid },
    { type: "lyrics", value: compiled.lyrics ?? "", versionId: vid },
  ];

  // Use the same version — attach artifacts with versionId set
  await createVersion(deps.db, job.id, artifacts, "final");
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
    rawStyle: null,
    rawLyrics: null,
    compiledJson: null,
    findings: null,
    appliedPatch: null,
    versionId: null,
  };

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


