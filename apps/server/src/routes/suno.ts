import type { FastifyInstance } from "fastify";
import { eq, desc } from "drizzle-orm";
import type { Db, SunoClient } from "@track-forge/core";
import {
  updateGeneration,
  getGeneration,
  listGenerations,
  storeGeneration,
  generateSunoPayload,
  schema,
} from "@track-forge/core";
import type { SunoArtifact } from "@track-forge/contracts";

export interface SunoRouteDeps {
  db: Db;
  suno: SunoClient;
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
    const body = req.body as Record<string, unknown>;
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
        req.log.error({ generationId, err }, "failed to update generation record");
      }
    }

    return reply.code(200).send({ received: true });
  });

  // ── Status proxy ─────────────────────────────────────────────────

  server.get("/api/suno/status/:id", async (req, reply) => {
    const { id } = req.params as { id: string };

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

  server.get("/api/suno/jobs/:jobId/generations", async (req, reply) => {
    const { jobId } = req.params as { jobId: string };

    const limit = parseInt(String((req.query as Record<string, string>).limit ?? "10"), 10);
    const records = await listGenerations(db, jobId, Math.min(limit, 50));
    return records;
  });

  // ── Retry failed generation ───────────────────────────────────────

  server.post("/api/suno/jobs/:jobId/generations/:id/retry", async (req, reply) => {
    const { jobId, id } = req.params as { jobId: string; id: string };

    // Find failed generation
    const failed = await getGeneration(db, id);
    if (!failed) {
      return reply.code(404).send({ error: "Generation not found" });
    }
    if (failed.status !== "error") {
      return reply.code(400).send({ error: "Only failed generations can be retried" });
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

    const artifacts = JSON.parse(latestVersion.artifacts as string) as SunoArtifact[];
    const getValue = (type: string) => artifacts.find((a) => a.type === type)?.value ?? "";

    // Build payload and submit
    const { request } = generateSunoPayload({
      title: getValue("title"),
      style: getValue("style"),
      excludedStyles: getValue("excluded_styles"),
      lyrics: getValue("lyrics"),
    });

    const result = await suno.submit(request);

    // Store new generation IDs
    for (const genId of result.ids) {
      await storeGeneration(db, {
        id: genId,
        jobId,
        versionId: latestVersion.id,
        status: "queued",
      });
    }

    req.log.info({ jobId, newIds: result.ids }, "generation retried");

    return {
      status: "retried",
      jobId,
      generationIds: result.ids,
    };
  });
}
