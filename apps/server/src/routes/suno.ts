import type { FastifyInstance } from "fastify";
import type { Db, SunoClient } from "@track-forge/core";
import type { Config } from "@track-forge/contracts";
import {
  updateGeneration,
  getGeneration,
  listGenerations,
  storeTracks,
  publish,
} from "@track-forge/core";
import {
  validateBody,
  validateParams,
  validateQuery,
  JobIdParams,
  SunoCallbackBody,
  PaginationQuery,
} from "../lib/validate.js";

export interface SunoRouteDeps {
  db: Db;
  suno: SunoClient;
  config: Config;
}

/**
 * Suno webhook callback handler + generations list.
 *
 * Callback envelope (sunoapi.org / kie.ai contract):
 *   { code: 200, msg: "...", data: { callbackType, task_id, data: [track...] } }
 * `callbackType` is one of "text" | "first" | "complete" — only "complete"
 * (or a non-200 `code`) is terminal. Intermediate callbacks just move the
 * generation to "processing" so the UI doesn't look stuck.
 */
export function registerSunoRoutes(
  server: FastifyInstance,
  deps: SunoRouteDeps,
): void {
  const { db } = deps;

  // ── Callback webhook ──────────────────────────────────────────────

  server.post("/api/suno/callback", async (req, reply) => {
    const body = validateBody(SunoCallbackBody, req);
    const envelope = (body.data ?? {}) as Record<string, unknown>;
    const taskId = String(
      envelope.task_id ??
        envelope.taskId ??
        body.id ??
        body.generation_id ??
        "",
    );
    const callbackType = String(envelope.callbackType ?? "complete");
    const code = Number(body.code ?? 200);
    const rawTracks = Array.isArray(envelope.data)
      ? (envelope.data as Record<string, unknown>[])
      : [];

    req.log.info(
      { taskId, callbackType, code, trackCount: rawTracks.length },
      "Suno callback received",
    );

    if (!taskId) {
      return reply.code(200).send({ received: true });
    }

    const isError = code !== 200 || callbackType === "error";
    const isTerminal = isError || callbackType === "complete";

    // Intermediate callbacks ("text"/"first") only move status forward —
    // no completion SSE event, no track storage yet.
    if (!isTerminal) {
      await updateGeneration(db, taskId, { status: "processing" }).catch(
        () => {},
      );
      return reply.code(200).send({ received: true });
    }

    // Idempotency guard: the background poller in versions.ts may already
    // have resolved this generation (or vice versa). Whichever writer gets
    // here first wins; the other becomes a no-op.
    const existing = await getGeneration(db, taskId).catch(() => null);
    if (
      existing &&
      (existing.status === "completed" || existing.status === "error")
    ) {
      return reply.code(200).send({ received: true });
    }

    const firstTrack = rawTracks[0];
    const data: Record<string, unknown> = {
      status: isError ? "error" : "completed",
    };
    if (isError) {
      data.error = String(body.msg ?? "Suno generation failed");
    } else if (firstTrack) {
      if (firstTrack.audio_url) data.audioUrl = String(firstTrack.audio_url);
      if (firstTrack.image_url) data.imageUrl = String(firstTrack.image_url);
      if (firstTrack.video_url) data.videoUrl = String(firstTrack.video_url);
      if (firstTrack.duration != null)
        data.duration = Number(firstTrack.duration);
      if (firstTrack.title) data.generatedTitle = String(firstTrack.title);
      if (firstTrack.tags) data.style = String(firstTrack.tags);
    }

    try {
      await updateGeneration(db, taskId, data as any);
      req.log.info(
        { taskId, status: data.status },
        "generation record updated",
      );
    } catch (err) {
      req.log.error({ taskId, err }, "failed to update generation record");
    }

    if (!isError && rawTracks.length > 0) {
      storeTracks(
        db,
        taskId,
        rawTracks.map((t, idx) => ({
          id: String(t.id ?? `${taskId}-${idx}`),
          index: idx,
          audioUrl: t.audio_url as string | undefined,
          imageUrl: t.image_url as string | undefined,
          videoUrl: t.video_url as string | undefined,
          duration: t.duration as number | undefined,
          title: t.title as string | undefined,
        })),
      );
    }

    // Emit synthetic SSE events for the forge strip's bar 8
    try {
      const gen = await getGeneration(db, taskId);
      if (gen?.jobId) {
        await publish(db, gen.jobId, {
          stage: isError ? "suno_render_error" : "suno_render_complete",
          status: isError ? "error" : "completed",
          error: isError ? (data.error as string) : undefined,
          message: isError ? undefined : "Suno render completed",
        });
      }
    } catch {
      // event emission is best-effort
    }

    return reply.code(200).send({ received: true });
  });

  // ── List generations for job ──────────────────────────────────────

  server.get("/api/suno/jobs/:jobId/generations", async (req) => {
    const { jobId } = validateParams(JobIdParams, req);
    const query = validateQuery(PaginationQuery, req);
    const limit = query.limit ?? 10;
    const records = await listGenerations(db, jobId, Math.min(limit, 50));
    return records;
  });
}
