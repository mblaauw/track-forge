import type { FastifyInstance } from "fastify";
import { eq, desc } from "drizzle-orm";
import type { Db, SunoClient } from "@track-forge/core";
import type { Config } from "@track-forge/contracts";
import {
  updateGeneration,
  getGeneration,
  listGenerations,
  storeGeneration,
  generateSunoPayload,
  publish,
  schema,
} from "@track-forge/core";
import type { SunoArtifact } from "@track-forge/contracts";
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
 * Suno webhook callback handler + status proxy.
 */
export function registerSunoRoutes(
  server: FastifyInstance,
  deps: SunoRouteDeps,
): void {
  const { db, suno } = deps;

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

  // ── Status proxy ─────────────────────────────────────────────────

  server.get("/api/suno/status/:id", async (req, reply) => {
    const { id } = validateParams(IdParams, req);

    try {
      const feedItem = await suno.getGenerationStatus(id);
      return feedItem;
    } catch (err) {
      req.log.error({ generationId: id, err }, "status fetch failed");
      return reply.code(502).send({
        error: "Failed to fetch generation status from Suno",
      });
    }
  });

  // ── List generations for job ──────────────────────────────────────

  server.get("/api/suno/jobs/:jobId/generations", async (req) => {
    const { jobId } = validateParams(JobIdParams, req);
    const query = validateQuery(PaginationQuery, req);
    const limit = query.limit ?? 10;
    const records = await listGenerations(db, jobId, Math.min(limit, 50));
    return records;
  });

  // ── Retry failed generation ───────────────────────────────────────

  server.post(
    "/api/suno/jobs/:jobId/generations/:id/retry",
    async (req, reply) => {
      const { jobId, id } = req.params as { jobId: string; id: string };

      // Find failed generation
      const failed = await getGeneration(db, id);
      if (!failed) {
        return reply.code(404).send({ error: "Generation not found" });
      }
      if (failed.status !== "error") {
        return reply
          .code(400)
          .send({ error: "Only failed generations can be retried" });
      }

      // Find the job to get latest version artifacts
      const versions = await db
        .select()
        .from(schema.versions)
        .where(eq(schema.versions.jobId, jobId))
        .orderBy(desc(schema.versions.number))
        .limit(1);

      const latestVersion = versions[0];
      if (!latestVersion) {
        return reply.code(400).send({ error: "No version found for this job" });
      }

      const artifacts: SunoArtifact[] = (() => {
        try {
          return JSON.parse(latestVersion.artifacts);
        } catch {
          return [];
        }
      })();
      const getValue = (type: string) =>
        artifacts.find((a) => a.type === type)?.value ?? "";

      // Build payload and submit
      const callbackUrl = deps.config.publicBaseUrl
        ? `${deps.config.publicBaseUrl.replace(/\/+$/, "")}/api/suno/callback`
        : undefined;

      const { request } = generateSunoPayload({
        title: getValue("title"),
        style: getValue("style"),
        excludedStyles: getValue("excluded_styles"),
        lyrics: getValue("lyrics"),
        callbackUrl,
      });

      let result: { taskId: string };
      try {
        result = await suno.submit(request);
      } catch (err) {
        req.log.error({ jobId, err }, "retry submission to Suno failed");
        return reply.code(502).send({ error: "Failed to submit to Suno" });
      }

      // Store task as generation record (individual song IDs come from polling)
      await storeGeneration(db, {
        id: result.taskId,
        jobId,
        versionId: latestVersion.id,
        status: "queued",
      });

      req.log.info(
        { jobId, taskId: result.taskId },
        "generation task submitted",
      );

      return {
        status: "retried",
        jobId,
        taskId: result.taskId,
      };
    },
  );
}
