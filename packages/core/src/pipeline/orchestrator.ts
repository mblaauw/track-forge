import pino from "pino";
import {
  GenerationStage,
  SectionType,
  SunoArtifactType,
  type JobId,
  type VersionId,
  type SunoArtifact,
  type LyricsSection,
  type LyricsWriterResult,
} from "@track-forge/contracts";
import { isVocalSection, type GenreModule } from "@track-forge/genre-core";
import type {
  PipelineDeps,
  PipelineState,
  PipelineResult,
  ParsedInputs,
} from "./types.js";
import { eq } from "drizzle-orm";
import { schema } from "../db/index.js";
import {
  loadJob,
  advanceStage,
  failJob,
  failStage,
  completeJob,
  savePipelineState,
  createVersion,
} from "./job-service.js";
import type { StageData } from "./job-service.js";
import { compileStylePrompt } from "./style-compiler.js";
import { writeLyrics } from "../llm/lyrics-writer.js";
import type { LyricsWriterSectionInput } from "../llm/lyrics-writer.js";
import { publish } from "./events.js";
import { createAbortController, cleanupJob } from "./job-abort-controller.js";
import { safeJsonParse, readJobInputs } from "../json-utils.js";

// Trace is a debug aid for /trace-generation — routed through pino (silent
// by default) rather than sync file writes, which used to block the pipeline
// hot path and clobber concurrent jobs' traces into one shared file.
const traceLogger = pino({
  level: process.env.TRACE_LOG_LEVEL ?? "silent",
  name: "pipeline-trace",
});

export function trace(section: string, data: unknown): void {
  traceLogger.debug({ section, data }, section);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Stage order ───────────────────────────────────────────────────────

const STAGE_ORDER: readonly GenerationStage[] = [
  "compilation",
  "lyrics_writing",
  "versioning",
] as const;

function nextStage(current: GenerationStage): GenerationStage | undefined {
  const idx = STAGE_ORDER.indexOf(current);
  if (idx === -1 || idx >= STAGE_ORDER.length - 1) return undefined;
  return STAGE_ORDER[idx + 1];
}

// ── Shared input parsing ──────────────────────────────────────────────

function parsePipelineInputs(
  job: PipelineState["job"],
  module: PipelineState["module"],
): ParsedInputs {
  const inputs = readJobInputs(job.inputs) ?? {};
  const presetIds = (inputs.presetIds as string[]) ?? [];
  const presetLabels = presetIds
    .map((id) => {
      const p = (module.presets ?? []).find((pr) => pr.id === id);
      return p ? p.name : "";
    })
    .filter(Boolean);

  const rawDescriptors = (inputs.tags as Array<Record<string, unknown>>) ?? [];
  const descriptors = rawDescriptors
    .filter((d) => !d.muted)
    .map((d) => ({
      label: String(d.label ?? ""),
      cat: String(d.cat ?? ""),
      weight: Number(d.weight ?? 0),
    }));

  const rawSections = (inputs.sections as Array<Record<string, unknown>>) ?? [];
  trace("parsePipelineInputs", {
    jobId: job.id,
    descriptorCount: descriptors.length,
    presetLabels,
    hasTags: !!inputs.tags,
    tagCount: (inputs.tags as any[])?.length,
  });
  return { inputs, presetIds, presetLabels, descriptors, rawSections };
}

// ── Stage: Compilation ────────────────────────────────────────────────

async function handleCompilation(
  state: PipelineState,
  deps: PipelineDeps,
): Promise<PipelineState> {
  const p = state.parsed!;
  const { inputs, presetLabels, descriptors, rawSections } = p;
  const genreName = state.module.name;

  const bpm = Number(inputs.bpm ?? 128);
  const key = String(inputs.key ?? "C");
  const scale = (inputs.scale ?? "minor") as "major" | "minor";
  const lyricsMode = String(inputs.lyricsMode ?? "strict_instrumental") as
    "full_lyrics" | "strict_instrumental";

  const sections = rawSections.map((s) => ({
    name: String(s.name ?? ""),
    fn: String(s.fn ?? "establish"),
  }));

  const vocalSections = rawSections.filter((s: Record<string, unknown>) =>
    isVocalSection({
      name: String(s.name ?? ""),
      deltas: (s.deltas as string[]) ?? [],
    }),
  );
  const vocalType =
    vocalSections.length > 0
      ? String((vocalSections[0]!.vocal as Record<string, unknown>)?.type ?? "")
      : undefined;

  const presetMood = inputs.mood ? String(inputs.mood) : undefined;
  const presetEnergy =
    inputs.energy !== undefined && inputs.energy !== null
      ? Number(inputs.energy)
      : undefined;

  // Genre characteristics from preset values (all genres)
  const characteristics = Array.isArray(inputs.characteristics)
    ? (inputs.characteristics as string[])
    : undefined;

  // HipHop-specific fields from preset values
  const hipHopFlowPattern = String(inputs.flowPattern ?? "");
  const hipHopRhymeStyle = String(inputs.rhymeStyle ?? "");
  const hipHopNarrativeArc = String(inputs.narrativeArc ?? "");
  const hipHopVocalStyle = String(inputs.vocalStyle ?? "");
  const hipHopTypicalSongStructure = Array.isArray(inputs.typicalSongStructure)
    ? (inputs.typicalSongStructure as string[])
    : undefined;

  const compiled = compileStylePrompt({
    genreName,
    presetLabels,
    descriptors,
    bpm,
    key,
    scale,
    sections,
    lyricsMode,
    vocalType: vocalType || undefined,
    presetMood,
    presetEnergy: Number.isFinite(presetEnergy) ? presetEnergy : undefined,
    characteristics,
    hipHopFlowPattern: hipHopFlowPattern || undefined,
    hipHopRhymeStyle: hipHopRhymeStyle || undefined,
    hipHopNarrativeArc: hipHopNarrativeArc || undefined,
    hipHopVocalStyle: hipHopVocalStyle || undefined,
    hipHopTypicalSongStructure,
  });

  trace("handleCompilation", {
    genreName,
    presetLabels,
    descriptorCount: descriptors.length,
    descriptors,
    compiledActiveCount: compiled.activeCount,
    compiledStyle: compiled.style,
  });

  const title = String(inputs.title ?? "Untitled");
  const negativeTags: string[] = [];
  if (lyricsMode !== "full_lyrics") {
    negativeTags.push("vocals", "singing", "lyrics", "voice");
  }
  const userExcluded = String(inputs.excludedStyles ?? "")
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
  for (const tag of userExcluded) {
    if (!negativeTags.some((t) => t.toLowerCase() === tag.toLowerCase())) {
      negativeTags.push(tag);
    }
  }

  const compiledJson = JSON.stringify({
    title,
    style: compiled.style,
    excludedStyles: negativeTags.join(", "),
    lyrics: "",
    bpm,
    key,
    vocalDescription: vocalType ?? "",
    vocalGender: deriveVocalGender(vocalType),
    negativeTags,
    titleCandidates: [title],
  });

  return { ...state, compiledJson };
}

function deriveVocalGender(
  vocalType: string | undefined,
): "m" | "f" | undefined {
  if (!vocalType) return undefined;
  const lower = vocalType.toLowerCase();
  if (lower.includes("female")) return "f";
  if (lower.includes("male")) return "m";
  return undefined;
}

// ── Stage: Lyrics Writing ─────────────────────────────────────────────

/** Map a display name to the closest SectionType bucket (best-effort — `label` carries the exact name). */
function toSectionType(name: string): SectionType {
  const n = name.toLowerCase();
  if (n.includes("pre-chorus") || n.includes("pre chorus"))
    return SectionType.PreChorus;
  if (n.includes("chorus")) return SectionType.Chorus;
  if (n.includes("hook")) return SectionType.Hook;
  if (n.includes("bridge")) return SectionType.Bridge;
  if (n.includes("breakdown")) return SectionType.Breakdown;
  if (n.includes("build")) return SectionType.Build;
  if (n.includes("drop")) return SectionType.Drop;
  if (n.includes("verse")) return SectionType.Verse;
  if (n.includes("intro")) return SectionType.Intro;
  if (n.includes("outro")) return SectionType.Outro;
  if (n.includes("solo")) return SectionType.Solo;
  if (n.includes("interlude")) return SectionType.Interlude;
  return SectionType.Verse;
}

/** Build the LyricsDocument from arrangement sections + lines keyed by section id. Sections with no lines are dropped (id-based — never string-matched against model output). */
function sectionsToLyricsDocument(
  sections: LyricsWriterSectionInput[],
  linesById: Record<string, string[]>,
): LyricsWriterResult["document"] {
  const docSections: LyricsSection[] = [];
  for (const s of sections) {
    const lines = linesById[s.id] ?? [];
    if (lines.length === 0) continue;
    docSections.push({
      type: toSectionType(s.name),
      label: s.name,
      id: s.id,
      lines,
      bars: s.bars,
      tags: s.deltas,
      instrumental: false,
    });
  }

  return { sections: docSections, metadata: {} };
}

async function handleLyricsWriting(
  state: PipelineState,
  deps: PipelineDeps,
): Promise<PipelineState> {
  const p = state.parsed!;
  const { inputs, presetLabels, rawSections } = p;
  const lyricsMode = String(inputs.lyricsMode ?? "strict_instrumental");
  const genreName = state.module.name;

  if (lyricsMode === "strict_instrumental") {
    return {
      ...state,
      lyricsWriterResult: {
        document: {
          sections: [],
          metadata: {},
        } as LyricsWriterResult["document"],
      },
    };
  }

  const sections: LyricsWriterSectionInput[] = rawSections.map((s) => ({
    id: String(s.id ?? ""),
    name: String(s.name ?? ""),
    bars: Number(s.bars ?? 8),
    fn: String(s.fn ?? "establish"),
    deltas: (s.deltas as string[]) ?? [],
    vocal: s.vocal as LyricsWriterSectionInput["vocal"],
  }));

  // Pre-generated lyrics from the "Generate lyrics" UI button — already
  // keyed by section id, same contract the writer produces below.
  const lyricLines = inputs.lyricLines as Record<string, string[]> | undefined;
  const lyricsGenerated = inputs.lyricsGenerated === true;
  if (lyricLines && lyricsGenerated) {
    const doc = sectionsToLyricsDocument(sections, lyricLines);
    if (doc.sections.length > 0) {
      trace("handleLyricsWriting.preGenerated", {
        sectionCount: doc.sections.length,
        totalLines: doc.sections.reduce((a, s) => a + s.lines.length, 0),
      });
      return { ...state, lyricsWriterResult: { document: doc } };
    }
  }

  const vocalSections = sections.filter((s) =>
    isVocalSection({ name: s.name, deltas: s.deltas }),
  );

  if (vocalSections.length === 0) {
    // full_lyrics mode but nothing in the arrangement is marked vocal —
    // nothing for the writer to do.
    return {
      ...state,
      lyricsWriterResult: { document: { sections: [], metadata: {} } },
    };
  }

  const compiledStyle = state.compiledJson
    ? (safeJsonParse<Record<string, string>>(state.compiledJson, {}).style ??
      "")
    : "";

  const writerInput = {
    genreName,
    presetLabels,
    bpm: Number(inputs.bpm ?? 128),
    key: String(inputs.key ?? "C"),
    scale: (inputs.scale ?? "minor") as "major" | "minor",
    sections: vocalSections,
    lyricTopic: String(inputs.lyricTopic ?? ""),
    lyricThemes: (inputs.lyricThemes as string[]) ?? [],
    lyricAngle: String(inputs.lyricAngle ?? ""),
    style: compiledStyle,
    lyricsGuidance: state.module.lyricsGuidance,
  };

  trace("handleLyricsWriting.request", { input: writerInput });

  const writerResult = await writeLyrics(deps.llm, writerInput, {
    signal: deps.signal,
  });

  trace("handleLyricsWriting.response", {
    sectionCount: writerResult.sections.length,
    ids: writerResult.sections.map((s) => s.id),
  });

  const linesById: Record<string, string[]> = {};
  for (const s of writerResult.sections) linesById[s.id] = s.lines;

  return {
    ...state,
    lyricsWriterResult: {
      document: sectionsToLyricsDocument(sections, linesById),
    },
  };
}

/**
 * Shared formatter for the versioned lyrics artifact — every arrangement
 * section becomes a Suno bracket metatag (`[Name: delta1, delta2]`), with
 * lyric lines under vocal sections and a bare marker under instrumental
 * ones, so the full arrangement (not just the sung parts) reaches Suno.
 */
function formatLyricsArtifact(
  sections: { id: string; name: string; deltas: string[] }[],
  linesById: Record<string, string[]>,
): string {
  return sections
    .map((s) => {
      const tagStr = s.deltas.length > 0 ? `: ${s.deltas.join(", ")}` : "";
      const header = `[${s.name}${tagStr}]`;
      const lines = linesById[s.id] ?? [];
      return lines.length > 0 ? `${header}\n${lines.join("\n")}` : header;
    })
    .join("\n\n");
}

// ── Stage: Versioning ─────────────────────────────────────────────────

async function handleVersioning(
  state: PipelineState,
  deps: PipelineDeps,
): Promise<PipelineState> {
  const { job, compiledJson } = state;
  if (!compiledJson)
    throw new Error("Pipeline state missing compiledJson before versioning");

  const compiled = safeJsonParse<Record<string, string>>(compiledJson, {});
  const lyricsMode = String(
    state.parsed?.inputs.lyricsMode ?? "strict_instrumental",
  );

  // Build the lyrics artifact. For full_lyrics jobs this carries the FULL
  // arrangement as Suno bracket metatags — vocal sections get their lines,
  // instrumental sections (Intro, Breakdown, ...) get a bracket-only marker
  // so Suno still reads the structure. For strict_instrumental jobs this
  // must stay empty: generateSunoPayload() infers `instrumental` from
  // whether this text is empty, and a non-empty prompt would flip a
  // deliberately-instrumental job to vocal. Instrumental structure is
  // instead carried in the style string (see compileStructureNote).
  let lyricsText = "";
  if (lyricsMode === "full_lyrics" && state.parsed) {
    const linesById: Record<string, string[]> = {};
    for (const s of state.lyricsWriterResult?.document?.sections ?? []) {
      const id = (s as LyricsSection).id;
      if (id) linesById[id] = s.lines ?? [];
    }
    lyricsText = formatLyricsArtifact(
      state.parsed.rawSections.map((s) => ({
        id: String(s.id ?? ""),
        name: String(s.name ?? ""),
        deltas: (s.deltas as string[]) ?? [],
      })),
      linesById,
    );
  }

  const title = compiled.title ?? "Untitled";
  const style = compiled.style ?? "";
  const excludedStyles = compiled.excludedStyles ?? "";

  trace("handleVersioning", {
    compiledTitle: title,
    compiledStyle: style,
    compiledExcludedStyles: excludedStyles,
    lyricsLength: lyricsText.length,
    lyricsPreview: lyricsText.slice(0, 500),
  });

  const artifacts: SunoArtifact[] = [
    { type: SunoArtifactType.Title, value: title, versionId: "" as VersionId },
    { type: SunoArtifactType.Style, value: style, versionId: "" as VersionId },
    {
      type: SunoArtifactType.Lyrics,
      value: lyricsText,
      versionId: "" as VersionId,
    },
  ];
  if (excludedStyles) {
    artifacts.push({
      type: SunoArtifactType.ExcludedStyles,
      value: excludedStyles,
      versionId: "" as VersionId,
    });
  }

  const version = createVersion(deps.db, job.id as JobId, artifacts, "final");
  await completeJob(deps.db, job.id as JobId);

  return { ...state, versionId: version.id };
}

// ── Main orchestrator ─────────────────────────────────────────────────

export async function runPipeline(
  jobId: string,
  deps: PipelineDeps,
  module: GenreModule,
): Promise<PipelineResult> {
  const controller = createAbortController(jobId);
  if (deps.signal) {
    if (deps.signal.aborted) {
      controller.abort(deps.signal.reason);
    } else {
      deps.signal.addEventListener(
        "abort",
        () => controller.abort(deps.signal!.reason),
        { once: true },
      );
    }
  }
  deps.signal = controller.signal;

  const job = await loadJob(deps.db, jobId as JobId);
  if (!job) {
    cleanupJob(jobId);
    return { success: false, jobId, versionId: null, error: "Job not found" };
  }
  if (job.status === "cancelled" || job.status === "completed") {
    cleanupJob(jobId);
    return {
      success: false,
      jobId,
      versionId: null,
      error: `Job is ${job.status}`,
    };
  }

  const initialState: PipelineState = {
    job,
    module,
    compiledJson: null,
    lyricsWriterResult: null,
    versionId: null,
  };

  let state = initialState;

  // Parse inputs once; cached in state.parsed for all stages
  state = { ...state, parsed: parsePipelineInputs(state.job, state.module) };

  trace("runPipeline.start", {
    jobId: state.job.id,
    genreId: state.job.genreId,
    presetId: state.job.presetId,
    status: state.job.status,
    inputs: readJobInputs(state.job.inputs),
  });

  if (state.job.status !== "in_progress") {
    const now = new Date().toISOString();
    await deps.db
      .update(schema.jobs)
      .set({ status: "in_progress", updatedAt: now })
      .where(eq(schema.jobs.id, state.job.id));
    state.job.status = "in_progress";
  }

  const stageHandlers: Record<
    string,
    (s: PipelineState, d: PipelineDeps) => Promise<PipelineState>
  > = {
    compilation: handleCompilation,
    lyrics_writing: handleLyricsWriting,
    versioning: handleVersioning,
  };

  const lastStage = STAGE_ORDER[STAGE_ORDER.length - 1];
  let currentStage: GenerationStage = "compilation";

  try {
    for (const stage of STAGE_ORDER) {
      currentStage = stage;

      if (deps.signal?.aborted) {
        await publish(deps.db, state.job.id, {
          stage,
          status: "error",
          error: "Cancelled",
        });
        cleanupJob(state.job.id);
        return {
          success: false,
          jobId: state.job.id,
          versionId: null,
          error: "Cancelled by user",
        };
      }

      const handler = stageHandlers[stage];
      if (!handler) throw new Error(`No handler for stage: ${stage}`);

      // Re-attempt loop: failStage() tracks attempts on the job row and
      // returns status "in_progress" while attempts remain, "failed" once
      // exhausted (or "cancelled" if a concurrent cancel won the race —
      // either way we stop). This makes the documented "stage errors get up
      // to 3 attempts" behavior real, instead of one try wrapped in a catch
      // that gave up immediately.
      let stageSucceeded = false;
      while (!stageSucceeded) {
        try {
          await publish(deps.db, state.job.id, { stage, status: "started" });
          state = await handler(state, deps);
          await publish(deps.db, state.job.id, { stage, status: "completed" });
          stageSucceeded = true;
        } catch (err) {
          if (deps.signal?.aborted) {
            await publish(deps.db, state.job.id, {
              stage,
              status: "error",
              error: "Cancelled",
            });
            cleanupJob(state.job.id);
            return {
              success: false,
              jobId: state.job.id,
              versionId: null,
              error: "Cancelled by user",
            };
          }

          const msg = err instanceof Error ? err.message : String(err);
          await publish(deps.db, state.job.id, {
            stage,
            status: "error",
            error: msg,
          });
          const updatedJob = await failStage(
            deps.db,
            state.job.id as JobId,
            msg,
          );
          state.job = updatedJob;

          if (updatedJob.status !== "in_progress") {
            // Attempts exhausted (failed) or cancelled concurrently — stop.
            cleanupJob(state.job.id);
            return {
              success: false,
              jobId: state.job.id,
              versionId: null,
              error: msg,
            };
          }
          await sleep(Math.min(500 * updatedJob.stageAttempt, 4000));
        }
      }

      const stageData: StageData = {
        compiledJson: state.compiledJson,
        lyricsWriterResult: state.lyricsWriterResult,
      };
      await savePipelineState(deps.db, state.job.id, stageData);

      if (stage !== lastStage) {
        const next = nextStage(stage);
        if (next) {
          state.job = await advanceStage(deps.db, state.job.id, next);
        }
      }
    }

    cleanupJob(state.job.id);
    return {
      success: true,
      jobId: state.job.id,
      versionId: state.versionId,
      error: null,
    };
  } catch (err) {
    // Infra-level failure outside a stage handler (e.g. publish/db errors) —
    // fail immediately, no attempt tracking or further attempts.
    const msg = err instanceof Error ? err.message : String(err);
    await publish(deps.db, state.job.id, {
      stage: currentStage,
      status: "error",
      error: msg,
    }).catch(() => {});
    await failJob(deps.db, state.job.id as JobId, msg).catch(() => {});
    cleanupJob(state.job.id);
    return { success: false, jobId: state.job.id, versionId: null, error: msg };
  }
}
