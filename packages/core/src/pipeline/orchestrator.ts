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
import type { PipelineDeps, PipelineState, PipelineResult } from "./types.js";
import { eq } from "drizzle-orm";
import { schema, getSqlite } from "../db/index.js";
import {
  loadJob,
  advanceStage,
  failJob,
  failStage,
  savePipelineState,
  createVersion,
} from "./job-service.js";
import type { StageData } from "./job-service.js";
import { renderSunoStyle } from "./style-compiler.js";
import { sunoAdapter } from "../suno/adapter.js";
import { buildLyricsBrief, enrichResolved } from "./intent-bridge.js";
import { resolveSongIntent } from "@track-forge/song-intent";
import { freezeIntentRevision } from "../intent-revisions/index.js";
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

// ── Stage: Compilation ────────────────────────────────────────────────

async function handleCompilation(
  state: PipelineState,
  deps: PipelineDeps,
): Promise<PipelineState> {
  // Resolve from the frozen intent revision (not re-parsing job.inputs).
  // Caller guarantees state.frozenIntent is set before stages run.
  const frozen = state.frozenIntent!;

  // Derive preset labels from the frozen intent's styles + module presets
  const presetLabels = frozen.styles
    .map((s) => {
      const p = state.module.presets?.find((pr) => pr.id === s.presetId);
      return p ? p.name : "";
    })
    .filter(Boolean);

  const materialized = { intent: frozen, provenance: {}, warnings: [] };
  const resolved = enrichResolved(
    resolveSongIntent(materialized),
    state.module.name,
    presetLabels,
  );

  // Conflict policy: error-severity conflicts block compilation.
  const errorConflicts = (resolved.conflicts ?? []).filter(
    (c: { severity?: string }) => c.severity === "error",
  );
  if (errorConflicts.length > 0) {
    throw new Error(
      `Compilation blocked by ${errorConflicts.length} error conflict(s): ${errorConflicts.map((c: { message: string }) => c.message).join("; ")}`,
    );
  }

  const compiled = renderSunoStyle(resolved);

  // Produce prompt fragments via the adapter for fragment-aware truncation
  // and compilation record persistence.
  const compiledArtifacts = sunoAdapter.render(resolved);
  const compiledFragments = {
    style: compiledArtifacts.styleFragments,
    lyrics: compiledArtifacts.lyricsFragments,
    exclusions: compiledArtifacts.exclusionFragments,
  };

  trace("handleCompilation", {
    genreName: resolved.genreName,
    presetLabels: resolved.presetLabels,
    descriptorCount: resolved.descriptors.length,
    descriptors: resolved.descriptors,
    compiledActiveCount: compiled.activeCount,
    compiledStyle: compiled.style,
    fromFrozenIntent: true,
    fragmentCount: {
      style: compiledFragments.style.length,
      lyrics: compiledFragments.lyrics.length,
      exclusions: compiledFragments.exclusions.length,
    },
  });

  // Exclusions come from the resolver (which adds vocal exclusions for
  // strict_instrumental mode automatically). Deduplicate by lowercase.
  const seen = new Set<string>();
  const negativeTags: string[] = [];
  for (const tag of resolved.exclusions) {
    const lower = tag.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      negativeTags.push(tag);
    }
  }

  const title = resolved.identity.title || "Untitled";
  const vocalDescription = resolved.vocals.type ?? "";
  const compiledJson = JSON.stringify({
    title,
    style: compiled.style,
    excludedStyles: negativeTags.join(", "),
    lyrics: "",
    bpm: resolved.bpm,
    key: resolved.key ?? undefined,
    vocalDescription,
    vocalGender: deriveVocalGender(vocalDescription),
    negativeTags,
    titleCandidates: [title],
  });

  return { ...state, compiledJson, resolved, compiledFragments };
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
  // Always use the resolved intent from compilation stage
  const resolved = state.resolved!;
  if (!resolved)
    throw new Error("Pipeline state missing resolved intent in lyrics_writing");

  if (!resolved.vocals.hasLeadVocal) {
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

  // Build section inputs from the resolved arrangement (frozen intent source)
  const sections: LyricsWriterSectionInput[] =
    resolved.arrangement.sections.map((s) => ({
      id: s.id,
      name: s.name,
      bars: s.bars,
      fn: s.fn ?? "establish",
      deltas: s.deltas ?? [],
      vocal: s.vocal as LyricsWriterSectionInput["vocal"] | undefined,
      purpose: undefined,
      pocket: undefined,
    }));

  // Pre-generated lyrics from the "Generate lyrics" UI button — stored as
  // a side-channel alongside the frozen intent. Falls back to empty.
  const lyricLines = state.preGeneratedLyrics;
  if (lyricLines && Object.keys(lyricLines).length > 0) {
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
    return {
      ...state,
      lyricsWriterResult: { document: { sections: [], metadata: {} } },
    };
  }

  const writerInput = buildLyricsBrief(
    resolved,
    vocalSections,
    state.module.lyricsGuidance,
  );

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
  const resolved = state.resolved;
  const lyricsMode = resolved?.vocals.mode ?? "strict_instrumental";

  // Build the lyrics artifact. For full_lyrics jobs this carries the FULL
  // arrangement as Suno bracket metatags — vocal sections get their lines,
  // instrumental sections (Intro, Breakdown, ...) get a bracket-only marker
  // so Suno still reads the structure. For strict_instrumental jobs this
  // must stay empty: generateSunoPayload() infers `instrumental` from
  // whether this text is empty, and a non-empty prompt would flip a
  // deliberately-instrumental job to vocal. Instrumental structure is
  // instead carried in the style string (see compileStructureNote).
  let lyricsText = "";
  if (lyricsMode === "full_lyrics") {
    const linesById: Record<string, string[]> = {};
    for (const s of state.lyricsWriterResult?.document?.sections ?? []) {
      const id = (s as LyricsSection).id;
      if (id) linesById[id] = s.lines ?? [];
    }
    // Sections come from the resolved intent (frozen revision source), never
    // from the legacy rawSections bag — the orchestrator no longer reads that.
    const srcSections = resolved?.arrangement.sections ?? [];
    lyricsText = formatLyricsArtifact(
      srcSections.map((s) => ({
        id: String(s.id ?? ""),
        name: String(s.name ?? ""),
        deltas: Array.isArray(s.deltas) ? (s.deltas as string[]) : [],
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

  // All versioning operations (version creation, compilation record, version
  // linking, job completion) run in a single SQLite transaction. Failure in
  // any step fails the whole stage → retry loop kicks in. No error is swallowed.
  const sqlite = getSqlite(deps.db);
  const result = sqlite.transaction(() => {
    const version = createVersion(deps.db, job.id as JobId, artifacts, "final");
    const now = new Date().toISOString();
    let compilationId: string | undefined;

    // Create immutable compilation record linking intent revision → rendered artifacts.
    if (state.intentRevisionId) {
      compilationId = `${state.intentRevisionId}-comp`;
      sqlite
        .prepare(
          `INSERT INTO compilations (id, intent_revision_id, compiler_version, adapter_version, model_version, resolved_intent_json, decisions_json, warnings_json, fragments_json, style, lyrics, excluded_styles, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          compilationId,
          state.intentRevisionId,
          "1.0.0",
          "1.0.0",
          null,
          state.resolved ? JSON.stringify(state.resolved) : null,
          state.resolved?.decisions
            ? JSON.stringify(state.resolved.decisions)
            : null,
          state.resolved?.conflicts
            ? JSON.stringify(state.resolved.conflicts)
            : null,
          state.compiledFragments
            ? JSON.stringify(state.compiledFragments)
            : null,
          style,
          lyricsText,
          excludedStyles,
          now,
        );

      // Link the version to the intent revision and compilation.
      sqlite
        .prepare(
          "UPDATE versions SET intent_revision_id = ?, compilation_id = ? WHERE id = ?",
        )
        .run(state.intentRevisionId, compilationId, version.id);
    }

    // Mark the job as completed — only after version + compilation are persisted.
    sqlite
      .prepare(
        "UPDATE jobs SET status = 'completed', current_stage = 'completed', updated_at = ? WHERE id = ?",
      )
      .run(now, job.id);

    return { versionId: version.id as VersionId, compilationId };
  })();

  return { ...state, ...result };
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

  // Extract pre-generated lyrics from legacy inputs (side-channel, not part of SongIntent)
  const jobInputs = readJobInputs(job.inputs);
  const preGeneratedLyrics: Record<string, string[]> | undefined =
    jobInputs.lyricLines && jobInputs.lyricsGenerated === true
      ? (jobInputs.lyricLines as Record<string, string[]>)
      : undefined;

  const initialState: PipelineState = {
    job,
    module,
    compiledJson: null,
    lyricsWriterResult: null,
    versionId: null,
    preGeneratedLyrics,
  };

  let state = initialState;

  // NOTE: parsePipelineInputs is no longer called — stages consume
  // state.frozenIntent and state.resolved, not the legacy input bag.

  trace("runPipeline.start", {
    jobId: state.job.id,
    genreId: state.job.genreId,
    presetId: state.job.presetId,
    status: state.job.status,
    hasPreGeneratedLyrics: !!preGeneratedLyrics,
  });

  if (state.job.status !== "in_progress") {
    const now = new Date().toISOString();
    await deps.db
      .update(schema.jobs)
      .set({ status: "in_progress", updatedAt: now })
      .where(eq(schema.jobs.id, state.job.id));
    state.job.status = "in_progress";
  }

  // Freeze an immutable intent revision before the pipeline runs.
  // This also returns the migrated intent — stages consume this instead of
  // re-parsing the legacy job.inputs blob.
  const frozen = await freezeIntentRevision(
    deps.db,
    state.job.id,
    state.job.genreId,
    state.job.presetId,
    state.job.inputs,
    { name: state.job.name, reference: state.job.reference },
  );
  state.intentRevisionId = frozen.revisionId;
  state.frozenIntent = frozen.intent;

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
