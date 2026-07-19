import type { FastifyInstance } from "fastify";
import type { Db, SunoClient } from "@track-forge/core";
import type { Config } from "@track-forge/contracts";
import {
  updateGeneration,
  getGeneration,
  listGenerations,
  publish,
} from "@track-forge/core";
import {
  validateBody,
  validateParams,
  validateQuery,
  IdParams,
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
 */
export function registerSunoRoutes(
  server: FastifyInstance,
  deps: SunoRouteDeps,
): void {
  const { db } = deps;

  // ── Callback webhook ──────────────────────────────────────────────

  server.post("/api/suno/callback", async (req, reply) => {
    const body = validateBody(SunoCallbackBody, req);
    const generationId = String(body.id ?? body.generation_id ?? "");
    const status = String(body.status ?? "processing");

    req.log.info({ generationId, status }, "Suno callback received");

    if (generationId) {
      const data: Record<string, unknown> = { status };

      if (body.audio_url) data.audioUrl = String(body.audio_url);
      if (body.image_url) data.imageUrl = String(body.image_url);
      if (body.video_url) data.videoUrl = String(body.video_url);
      if (body.duration != null) data.duration = Number(body.duration);
      if (body.title) data.generatedTitle = String(body.title);
      if (body.style) data.style = String(body.style);
      if (body.error) data.error = String(body.error);

      try {
        await updateGeneration(db, generationId, data as any);
        req.log.info({ generationId, status }, "generation record updated");
      } catch (err) {
        req.log.error(
          { generationId, err },
          "failed to update generation record",
        );
      }

      // Emit synthetic SSE events for the forge strip's bar 8
      try {
        const gen = await getGeneration(db, generationId);
        if (gen?.jobId) {
          const isError = status === "error" || status === "failed";
          await publish(db, gen.jobId, {
            stage: isError ? "suno_render_error" : "suno_render_complete",
            status: isError ? "error" : "completed",
            error: isError
              ? ((data.error as string) ?? "Suno render failed")
              : undefined,
            message: isError ? undefined : "Suno render completed",
          });
        }
      } catch {
        // event emission is best-effort
      }
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
