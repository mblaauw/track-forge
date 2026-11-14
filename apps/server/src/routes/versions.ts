import type { FastifyInstance } from "fastify";
import { eq, desc, sql } from "drizzle-orm";
import type { Db, SunoClient, RenderHints } from "@track-forge/core";
import type { Config } from "@track-forge/contracts";
import {
  SunoRenderSettingsSchema,
  estimateDurationSec,
} from "@track-forge/contracts";
import {
  schema,
  publish,
  SunoApiError,
  deriveRenderHints,
  generateSunoPayload,
  payloadToLog,
  storeGeneration,
  updateGeneration,
  getGeneration,
  storeTracks,
  trace,
} from "@track-forge/core";
import type { SunoArtifact } from "@track-forge/contracts";
import { findRowOr404 } from "../lib/db-utils.js";
import {
  validateBody,
  validateParams,
  IdParams,
  JobIdParams,
} from "../lib/validate.js";

export interface VersionRouteDeps {
  db: Db;
  suno: SunoClient;
  config: Config;
}

export function registerVersionRoutes(
  server: FastifyInstance,
  deps: VersionRouteDeps,
): void {
  const { db } = deps;

  // ── List versions for a job ──────────────────────────────────────────

  server.get("/api/jobs/:jobId/versions", async (req, reply) => {
    const { jobId } = validateParams(JobIdParams, req);

    const job = await findRowOr404(
      db,
      schema.jobs,
      eq(schema.jobs.id, jobId),
      "Job",
    );

    const rows = await db
      .select()
      .from(schema.versions)
      .where(eq(schema.versions.jobId, jobId))
      .orderBy(desc(schema.versions.number));

    return rows;
  });

  // ── Get version by ID ────────────────────────────────────────────────

  server.get("/api/versions/:id", async (req, reply) => {
    const { id } = validateParams(IdParams, req);

    const version = await findRowOr404(
      db,
      schema.versions,
      eq(schema.versions.id, id),
      "Version",
    );
    return version;
  });

  // ── Takes (generations scoped to a version, with tracks) ────────────

  server.get("/api/versions/:id/takes", async (req, reply) => {
    const { id } = validateParams(IdParams, req);

    const version = await findRowOr404(
      db,
      schema.versions,
      eq(schema.versions.id, id),
      "Version",
    );

    const generations = await db
      .select()
      .from(schema.generations)
      .where(eq(schema.generations.versionId, id))
      .orderBy(desc(schema.generations.createdAt));

    // Attach tracks to each generation
    const sqlite = (db as any).$client;
    const genIds = generations.map((g: any) => g.id);
    const result: unknown[] = [];

    for (const gen of generations) {
      const tracks = sqlite
        .prepare(
          'SELECT * FROM suno_tracks WHERE generation_id = ? ORDER BY "index" ASC',
        )
        .all((gen as any).id);
      result.push({ ...gen, tracks });
    }

    return result;
  });

  server.post("/api/versions/:id/takes", async (req, reply) => {
    const { id } = validateParams(IdParams, req);

    const version = await findRowOr404(
      db,
      schema.versions,
      eq(schema.versions.id, id),
      "Version",
    );

    // Parse version artifacts
    const artifacts: SunoArtifact[] = (() => {
      try {
        return JSON.parse(version.artifacts);
      } catch {
        return [];
      }
    })();
    const getValue = (type: string) =>
      artifacts.find((a) => a.type === type)?.value ?? "";

    // Build callback URL
    const callbackUrl = deps.config.publicBaseUrl
      ? new URL("/api/suno/callback", deps.config.publicBaseUrl).toString()
      : undefined;

    // Per-take settings (model variant, variety, sliders). An empty body
    // is valid and means "render with the defaults".
    const parsedSettings = SunoRenderSettingsSchema.safeParse(req.body ?? {});
    if (!parsedSettings.success) {
      return reply.code(400).send({
        error: `Invalid render settings: ${parsedSettings.error.message}`,
      });
    }
    const settings = parsedSettings.data;

    // Emit suno_render start
    await publish(db, version.jobId, {
      stage: "suno_render",
      status: "started",
      message: "Queued for Suno generation",
    }).catch(() => {});

    // Duration and vocal gender come from the song itself, not the take.
    const hints = await loadRenderHints(db, version);

    let built: ReturnType<typeof generateSunoPayload>;
    try {
      built = generateSunoPayload({
        title: getValue("title"),
        style: getValue("style"),
        excludedStyles: getValue("excluded_styles"),
        lyrics: getValue("lyrics"),
        callbackUrl,
        modelVersion: settings.model ?? deps.config.sunoModel,
        vocalGender: hints.vocalGender,
        durationSec: hints.durationSec,
        settings,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await publish(db, version.jobId, {
        stage: "suno_render_error",
        status: "error",
        error: message,
      }).catch(() => {});
      return reply.code(422).send({ error: message });
    }
    const { request, warnings } = built;
    const payloadWarnings =
      warnings.length > 0 ? JSON.stringify(warnings) : undefined;
    // What this take was actually rendered with — shown on the take card
    // so v6 / wild / mini takes of one version can be told apart.
    const renderSettings = JSON.stringify({
      model: request.model,
      variety: request.variety,
      weirdness: request.weirdnessConstraint,
      styleInfluence: request.styleWeight,
      duration: request.duration,
    });
    if (warnings.length > 0) {
      req.log.warn({ versionId: id, warnings }, "suno payload adjusted");
    }

    trace("sunoPayload", {
      versionId: id,
      jobId: version.jobId,
      rawArtifacts: artifacts,
      request,
    });

    const dryRunVal = process.env.SUNO_DRY_RUN;
    req.log.info({ SUNO_DRY_RUN: dryRunVal }, "dry run check");
    const skipSuno = dryRunVal === "true";
    if (skipSuno) {
      req.log.info(
        { request: payloadToLog(request) },
        "SUNO_DRY_RUN=true — storing dry-run generation",
      );
      // Suffixed with a random id — a version can be taken more than once
      // (re-render), and "dry-" + versionId alone collides on the second take.
      const dryRunId = `dry-${id}-${crypto.randomUUID().slice(0, 8)}`;
      const title = getValue("title") || "Dry Run";
      const style = getValue("style") || "";
      const lyrics = getValue("lyrics") || "";
      await storeGeneration(db, {
        id: dryRunId,
        jobId: version.jobId,
        versionId: id,
        status: "completed",
        generatedTitle: title,
        style,
        lyrics,
        duration: request.duration ?? 30,
        payloadWarnings,
        renderSettings,
      });
      storeTracks(db, dryRunId, [
        {
          id: dryRunId + "-t0",
          index: 0,
          title,
          duration: request.duration ?? 30,
        },
      ]);
      await publish(db, version.jobId, {
        stage: "suno_render_complete",
        status: "completed",
        message: "Suno render completed (dry run)",
      }).catch(() => {});
      const [created] = await db
        .select()
        .from(schema.generations)
        .where(eq(schema.generations.id, dryRunId))
        .limit(1);
      return reply.code(201).send(created);
    }

    let result: { taskId: string; callbackConfigured: boolean };
    try {
      result = await deps.suno.submit(request);
    } catch (err) {
      req.log.error(
        { versionId: id, jobId: version.jobId, err },
        "suno submit failed",
      );
      // SunoApiError carries a plain reason (out of credits, rate limited,
      // maintenance…) that is safe to show; anything else stays generic.
      const reason =
        err instanceof SunoApiError ? err.reason : "Failed to submit to Suno";
      await publish(db, version.jobId, {
        stage: "suno_render_error",
        status: "error",
        error: reason,
      }).catch(() => {});
      return reply.code(502).send({ error: reason });
    }

    // Store generation record with Suno's taskId
    await storeGeneration(db, {
      id: result.taskId,
      jobId: version.jobId,
      versionId: id,
      status: "queued",
      payloadWarnings,
      renderSettings,
    });

    // Return the created generation immediately
    const [created] = await db
      .select()
      .from(schema.generations)
      .where(eq(schema.generations.id, result.taskId))
      .limit(1);

    await reply.code(201).send(created);

    // Background poll: wait for Suno to finish, then update record + emit SSE
    if (result.taskId) {
      deps.suno
        .waitForCompletion(result.taskId)
        .then(async (item) => {
          // The callback webhook (POST /api/suno/callback) may have already
          // resolved this generation — whichever writer gets here first
          // wins, so a late poll doesn't overwrite a terminal state or
          // double-publish the completion event.
          const current = await getGeneration(db, result.taskId).catch(
            () => null,
          );
          if (
            current &&
            (current.status === "completed" || current.status === "error")
          ) {
            return;
          }

          await updateGeneration(db, result.taskId, {
            status: item.status,
            error: item.status === "error" ? item.error : undefined,
            audioUrl: item.audioUrl,
            imageUrl: item.imageUrl,
            videoUrl: item.videoUrl,
            duration: item.duration,
            generatedTitle: item.title,
            style: item.style,
            lyrics: item.lyrics,
          }).catch(() => {});
          // Store all tracks from the generation (typically 2 per Suno task)
          if (item.tracks && item.tracks.length > 0) {
            storeTracks(db, result.taskId, item.tracks);
          }
          if (item.status === "error") {
            await publish(db, version.jobId, {
              stage: "suno_render_error",
              status: "error",
              error: item.error ?? "Suno generation failed",
            }).catch(() => {});
            return;
          }
          await publish(db, version.jobId, {
            stage: "suno_render_complete",
            status: "completed",
            message: "Suno render completed",
          }).catch(() => {});
        })
        .catch(async (err: Error) => {
          req.log.error({ taskId: result.taskId, err }, "Suno poll failed");
          await updateGeneration(db, result.taskId, {
            status: "error",
            error: err.message,
          }).catch(() => {});
          await publish(db, version.jobId, {
            stage: "suno_render_error",
            status: "error",
            error: err.message,
          }).catch(() => {});
        });
    }
  });

  server.patch("/api/takes/:id/favorite", async (req, reply) => {
    const { id } = validateParams(IdParams, req);

    const now = new Date().toISOString();
    await db
      .update(schema.generations)
      .set({
        isFavorite: sql`NOT ${schema.generations.isFavorite}`,
        updatedAt: now,
      })
      .where(eq(schema.generations.id, id));

    const [updated] = await db
      .select()
      .from(schema.generations)
      .where(eq(schema.generations.id, id))
      .limit(1);

    if (!updated) {
      return reply.code(404).send({ error: "Take not found" });
    }

    return reply.code(200).send(updated);
  });
}

/**
 * Duration + vocal gender for a version. Read from the immutable
 * compilation record (the resolved intent the artifacts were rendered
 * from); versions forged before compilations existed fall back to the
 * compiled JSON the pipeline left on the job.
 */
async function loadRenderHints(
  db: Db,
  version: { jobId: string; compilationId: string | null },
): Promise<Partial<RenderHints>> {
  if (version.compilationId) {
    const [compilation] = await db
      .select()
      .from(schema.compilations)
      .where(eq(schema.compilations.id, version.compilationId))
      .limit(1);
    if (compilation?.resolvedIntentJson) {
      try {
        return deriveRenderHints(JSON.parse(compilation.resolvedIntentJson));
      } catch {
        // fall through to the job-level record
      }
    }
  }

  const [job] = await db
    .select()
    .from(schema.jobs)
    .where(eq(schema.jobs.id, version.jobId))
    .limit(1);
  let hints: Partial<RenderHints> = {};
  try {
    // stageData is `{ compiledJson: "<json string>", … }`; the legacy
    // compiled_json column holds that inner JSON directly.
    const stage = job?.stageData ? JSON.parse(job.stageData) : null;
    const inner: unknown = stage?.compiledJson ?? job?.compiledJson;
    const compiled = (typeof inner === "string" ? JSON.parse(inner) : inner) as
      { vocalGender?: "m" | "f"; durationSec?: number } | null | undefined;
    hints = {
      vocalGender: compiled?.vocalGender,
      durationSec: compiled?.durationSec,
    };
  } catch {
    // fall through to the job inputs
  }

  // Jobs compiled before durations were recorded: the arrangement is still
  // in the job inputs, so the length can be worked out from there.
  if (!hints.durationSec && job?.inputs) {
    try {
      const inputs = JSON.parse(job.inputs) as {
        bpm?: unknown;
        sections?: unknown;
      };
      if (typeof inputs.bpm === "number" && Array.isArray(inputs.sections)) {
        const duration = estimateDurationSec(
          inputs.bpm,
          inputs.sections.map((sec) => ({
            bars: Number((sec as { bars?: unknown })?.bars) || 0,
          })),
        );
        if (duration > 0) hints.durationSec = duration;
      }
    } catch {
      // inputs unreadable — the payload builder warns about the gap
    }
  }
  return hints;
}
