import { writeFileSync } from "node:fs";
import type { FastifyInstance } from "fastify";
import { eq, desc, sql } from "drizzle-orm";
import type { Db, SunoClient } from "@track-forge/core";
import type { Config } from "@track-forge/contracts";
import {
  schema,
  publish,
  generateSunoPayload,
  storeGeneration,
  updateGeneration,
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

  // ── Takes (generations scoped to a version) ─────────────────────────

  server.get("/api/versions/:id/takes", async (req, reply) => {
    const { id } = validateParams(IdParams, req);

    const version = await findRowOr404(
      db,
      schema.versions,
      eq(schema.versions.id, id),
      "Version",
    );

    const rows = await db
      .select()
      .from(schema.generations)
      .where(eq(schema.generations.versionId, id))
      .orderBy(desc(schema.generations.createdAt));

    return rows;
  });

  server.post("/api/versions/:id/takes", async (req, reply) => {
    const { id } = validateParams(IdParams, req);

    const version = await findRowOr404(
      db,
      schema.versions,
      eq(schema.versions.id, id),
      "Version",
    );

    // Emit suno_render start
    await publish(db, version.jobId, {
      stage: "suno_render",
      status: "started",
      message: "Queued for Suno generation",
    }).catch(() => {});

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

    const { request } = generateSunoPayload({
      title: getValue("title"),
      style: getValue("style"),
      excludedStyles: getValue("excluded_styles"),
      lyrics: getValue("lyrics"),
      callbackUrl,
    });

    trace("sunoPayload", {
      versionId: id,
      jobId: version.jobId,
      rawArtifacts: artifacts,
      request,
    });
    writeFileSync("LLM_SUNO_IN.md", JSON.stringify(request, null, 2));

    const dryRunVal = process.env.SUNO_DRY_RUN;
    req.log.info({ SUNO_DRY_RUN: dryRunVal }, "dry run check");
    const skipSuno = dryRunVal === "true";
    if (skipSuno) {
      req.log.info("SUNO_DRY_RUN=true — skipping Suno submit");
      await publish(db, version.jobId, {
        stage: "suno_render_complete",
        status: "completed",
        message: "Suno render completed (dry run)",
      }).catch(() => {});
      return reply.code(201).send({
        id: "dry-run-" + id,
        jobId: version.jobId,
        versionId: id,
        status: "completed",
      });
    }

    let result: { taskId: string; callbackConfigured: boolean };
    try {
      result = await deps.suno.submit(request);
    } catch (err) {
      req.log.error(
        { versionId: id, jobId: version.jobId, err },
        "suno submit failed",
      );
      await publish(db, version.jobId, {
        stage: "suno_render_error",
        status: "error",
        error: "Failed to submit to Suno",
      }).catch(() => {});
      return reply.code(502).send({ error: "Failed to submit to Suno" });
    }

    // Store generation record with Suno's taskId
    await storeGeneration(db, {
      id: result.taskId,
      jobId: version.jobId,
      versionId: id,
      status: "queued",
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
          await updateGeneration(db, result.taskId, {
            status: item.status,
            audioUrl: item.audioUrl,
            imageUrl: item.imageUrl,
            videoUrl: item.videoUrl,
            duration: item.duration,
            generatedTitle: item.title,
            style: item.style,
          }).catch(() => {});
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
