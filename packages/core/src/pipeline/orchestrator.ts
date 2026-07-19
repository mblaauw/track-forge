import {
  GenerationStage,
  SunoArtifactType,
  type JobId,
  type VersionId,
  type SunoArtifact,
  type LyricsWriterResult,
} from "@track-forge/contracts";
import type { GenreModule } from "@track-forge/genre-core";
import type { PipelineDeps, PipelineState, PipelineResult } from "./types.js";
import { eq } from "drizzle-orm";
import { schema } from "../db/index.js";
import {
  loadJob,
  advanceStage,
  failJob,
  completeJob,
  savePipelineState,
  createVersion,
} from "./job-service.js";
import type { StageData } from "./job-service.js";
import { compileStylePrompt } from "./style-compiler.js";
import { buildSunoContext } from "./suno-context.js";
import { publish } from "./events.js";
import { createAbortController, cleanupJob } from "./job-abort-controller.js";
import { safeJsonParse, readJobInputs } from "../json-utils.js";

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

function parsePipelineInputs(job: PipelineState["job"], module: PipelineState["module"]) {
  const inputs = readJobInputs(job.inputs) ?? {};
  const presetIds = (inputs.presetIds as string[]) ?? [];
  const presetLabels = presetIds.map((id) => {
    const p = (module.presets ?? []).find((pr) => pr.id === id);
    return p ? p.name : "";
  }).filter(Boolean);

  const rawDescriptors = (inputs.tags as Array<Record<string, unknown>>) ?? [];
  const descriptors = rawDescriptors
    .filter((d) => !d.muted)
    .map((d) => ({
      label: String(d.label ?? ""),
      cat: String(d.cat ?? ""),
      weight: Number(d.weight ?? 0),
    }));

  const rawSections = (inputs.sections as Array<Record<string, unknown>>) ?? [];
  return { inputs, presetIds, presetLabels, descriptors, rawSections };
}

// ── Stage: Compilation ────────────────────────────────────────────────

async function handleCompilation(
  state: PipelineState,
  deps: PipelineDeps,
): Promise<PipelineState> {
  const { inputs, presetLabels, descriptors, rawSections } = parsePipelineInputs(state.job, state.module);
  const genreName = state.module.name;

  const bpm = Number(inputs.bpm ?? 128);
  const key = String(inputs.key ?? "C");
  const scale = (inputs.scale ?? "minor") as "major" | "minor";
  const lyricsMode = String(inputs.lyricsMode ?? "strict_instrumental") as
    "full_lyrics" | "strict_instrumental" | "guided_instrumental";

  const sections = rawSections.map((s) => ({
    name: String(s.name ?? ""),
    fn: String(s.fn ?? "establish"),
  }));

  const vocalSections = rawSections.filter((s: Record<string, unknown>) => {
    const deltas = (s.deltas as string[]) ?? [];
    if (deltas.some((d) => d.toLowerCase() === "instrumental")) return false;
    if (
      deltas.some(
        (d) =>
          d.toLowerCase() === "vocal focus" || d.toLowerCase() === "catchy",
      )
    )
      return true;
    return /verse|chorus|hook|pre-chorus|refrain|bridge|drop/i.test(
      String(s.name ?? ""),
    );
  });
  const vocalType =
    vocalSections.length > 0
      ? String((vocalSections[0]!.vocal as Record<string, unknown>)?.type ?? "")
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
  });

  const title = String(inputs.title ?? "Untitled");
  const negativeTags: string[] = [];
  if (lyricsMode !== "full_lyrics") {
    negativeTags.push("vocals", "singing", "lyrics", "voice");
  }

  const compiledJson = JSON.stringify({
    title,
    style: compiled.style,
    excludedStyles: negativeTags.join(", "),
    lyrics: "",
    bpm,
    key,
    vocalDescription: vocalType ?? "",
    negativeTags,
    titleCandidates: [title],
  });

  return { ...state, compiledJson };
}

// ── Stage: Lyrics Writing ─────────────────────────────────────────────

async function handleLyricsWriting(
  state: PipelineState,
  deps: PipelineDeps,
): Promise<PipelineState> {
  const { inputs, presetLabels, descriptors, rawSections } = parsePipelineInputs(state.job, state.module);
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

  const sections = rawSections.map((s) => ({
    section: String(s.name ?? ""),
    bars: Number(s.bars ?? 8),
    fn: String(s.fn ?? "establish") as
      | "establish"
      | "introduce"
      | "escalate"
      | "contrast"
      | "remove"
      | "peak"
      | "resolve",
    deltas: (s.deltas as string[]) ?? [],
    tags: (s.tags as string[]) ?? [],
    vocal: s.vocal as
      | {
          type: string;
          delivery: string;
          energy: number;
          adlibs: boolean;
          harmonies: boolean;
        }
      | undefined,
  }));

  const vocalType = sections.find((s) => {
    const d = s.deltas.map((dd) => dd.toLowerCase());
    if (d.includes("instrumental")) return false;
    if (d.includes("vocal focus") || d.includes("catchy")) return true;
    return /verse|chorus|hook|pre-chorus|refrain|bridge|drop/i.test(s.section);
  })?.vocal?.type;

  const sunoContext = buildSunoContext({
    genreName,
    presetLabels,
    descriptors,
    bpm: Number(inputs.bpm ?? 128),
    key: String(inputs.key ?? "C"),
    scale: (inputs.scale ?? "minor") as "major" | "minor",
    sections,
    lyricsMode: lyricsMode as
      "full_lyrics" | "strict_instrumental" | "guided_instrumental",
    vocalType,
    lyricTopic: String(inputs.lyricTopic ?? ""),
    lyricThemes: (inputs.lyricThemes as string[]) ?? [],
    lyricAngle: String(inputs.lyricAngle ?? ""),
  });

  const prompt = `You are a songwriter. Write lyrics for this song following the structure and style described below. Return ONLY valid JSON matching this schema:
{"document":{"sections":[{"type":"verse","lines":["line 1","line 2"]}]}}

Context:
${sunoContext}`;

  const response = await deps.llm.complete({
    messages: [{ role: "user", content: prompt }],
    temperature: 0.8,
    maxTokens: 4096,
    signal: deps.signal,
  });

  let lyricsDoc: any = { sections: [], metadata: {} };
  try {
    const parsed = JSON.parse(response.content);
    if (parsed.document?.sections) {
      lyricsDoc = parsed.document;
    } else if (parsed.sections) {
      lyricsDoc = { sections: parsed.sections, metadata: {} };
    }
  } catch {
    lyricsDoc = {
      sections: [
        {
          type: "verse",
          lines: response.content.split("\n").filter(Boolean),
          bars: 8,
          tags: [],
          instrumental: false,
        },
      ],
      metadata: {},
    };
  }

  return {
    ...state,
    lyricsWriterResult: { document: lyricsDoc },
  };
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

  // Build lyrics from writer result
  let lyricsText = "";
  if (state.lyricsWriterResult?.document?.sections) {
    const doc = state.lyricsWriterResult.document;
    lyricsText = doc.sections
      .map((s) => `[${s.type}]\n${(s.lines ?? []).join("\n")}`)
      .join("\n\n");
  }

  const title = compiled.title ?? "Untitled";
  const style = compiled.style ?? "";
  const excludedStyles = compiled.excludedStyles ?? "";

  const artifacts: SunoArtifact[] = [
    { type: SunoArtifactType.Title, value: title, versionId: "" as VersionId },
    { type: SunoArtifactType.Style, value: style, versionId: "" as VersionId },
    { type: SunoArtifactType.Lyrics, value: lyricsText, versionId: "" as VersionId },
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

      await publish(deps.db, state.job.id, {
        stage,
        status: "started",
      });
      state = await handler(state, deps);
      await publish(deps.db, state.job.id, {
        stage,
        status: "completed",
      });

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
    const msg = (err as Error).message ?? String(err);
    await publish(deps.db, state.job.id, {
      stage: currentStage,
      status: "error",
      error: msg,
    });
    await failJob(deps.db, state.job.id as JobId, msg);
    cleanupJob(state.job.id);
    return { success: false, jobId: state.job.id, versionId: null, error: msg };
  }
}
