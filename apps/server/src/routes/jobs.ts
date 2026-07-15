import type { FastifyInstance } from "fastify";
import { eq, desc } from "drizzle-orm";
import type { Db, LlmClient, SunoClient } from "@track-forge/core";
import {
  createJob,
  runPipeline,
  schema,
  resetJobStage,
  cancelJob,
  generateSunoPayload,
  abortJob,
  publish,
} from "@track-forge/core";
import type {
  GenerationStage,
  CriticFinding,
  SunoArtifact,
} from "@track-forge/contracts";
import type { PipelineDeps } from "@track-forge/core";
import type { Config } from "@track-forge/contracts";
import { getModuleOrThrow } from "../lib/modules.js";

export interface JobRouteDeps {
  db: Db;
  config: Config;
  llm: LlmClient;
  suno: SunoClient;
}

export function registerJobRoutes(
  server: FastifyInstance,
  deps: JobRouteDeps,
): void {
  const { db, config, llm, suno } = deps;

  // ── Create job ───────────────────────────────────────────────────────

  server.post("/api/jobs", async (req, reply) => {
    const body = req.body as Record<string, unknown>;
    const genreId = body.genreId as string | undefined;
    const presetId = body.presetId as string | undefined;
    const inputs = body.inputs ?? {};
    const reference = (body.reference as string) ?? null;
    const name = (body.name as string) ?? null;

    if (!genreId || !presetId) {
      return reply.code(400).send({ error: "genreId and presetId required" });
    }

    let mod;
    try {
      mod = getModuleOrThrow(genreId);
    } catch {
      return reply.code(404).send({ error: `Unknown genre: ${genreId}` });
    }

    const parsed = mod.inputSchema.safeParse(inputs);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: "Invalid inputs", details: parsed.error.issues });
    }

    const job = await createJob(
      db,
      genreId as never,
      presetId as never,
      JSON.stringify(inputs),
      reference,
      name,
    );

    return reply.code(201).send(job);
  });

  // ── List jobs ────────────────────────────────────────────────────────

  server.get("/api/jobs", async (req) => {
    const query = req.query as { limit?: string; offset?: string };
    const limit = Math.min(parseInt(query.limit ?? "20", 10) || 20, 100);
    const offset = parseInt(query.offset ?? "0", 10) || 0;

    const rows = await db
      .select()
      .from(schema.jobs)
      .orderBy(desc(schema.jobs.createdAt))
      .limit(limit)
      .offset(offset);

    return rows;
  });

  // ── Get job ──────────────────────────────────────────────────────────

  server.get("/api/jobs/:id", async (req, reply) => {
    const { id } = req.params as { id: string };

    const [job] = await db
      .select()
      .from(schema.jobs)
      .where(eq(schema.jobs.id, id))
      .limit(1);

    if (!job) return reply.code(404).send({ error: "Job not found" });
    return job;
  });

  // ── Rename job ───────────────────────────────────────────────────────

  server.patch("/api/jobs/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as Record<string, unknown>;
    const name = body.name as string | undefined;

    if (!name || typeof name !== "string") {
      return reply.code(400).send({ error: "name required" });
    }

    const [job] = await db
      .select()
      .from(schema.jobs)
      .where(eq(schema.jobs.id, id))
      .limit(1);

    if (!job) return reply.code(404).send({ error: "Job not found" });

    const now = new Date().toISOString();
    await db
      .update(schema.jobs)
      .set({ name, updatedAt: now })
      .where(eq(schema.jobs.id, id));

    const [updated] = await db
      .select()
      .from(schema.jobs)
      .where(eq(schema.jobs.id, id))
      .limit(1);

    return reply.code(200).send(updated);
  });

  // ── Favorite toggle ───────────────────────────────────────────────────

  server.patch("/api/jobs/:id/favorite", async (req, reply) => {
    const { id } = req.params as { id: string };

    const [job] = await db
      .select()
      .from(schema.jobs)
      .where(eq(schema.jobs.id, id))
      .limit(1);

    if (!job) return reply.code(404).send({ error: "Job not found" });

    const now = new Date().toISOString();
    await db
      .update(schema.jobs)
      .set({ isFavorite: !job.isFavorite, updatedAt: now })
      .where(eq(schema.jobs.id, id));

    const [updated] = await db
      .select()
      .from(schema.jobs)
      .where(eq(schema.jobs.id, id))
      .limit(1);

    return reply.code(200).send(updated);
  });

  // ── Update job inputs (autosave) ────────────────────────────────────

  server.patch("/api/jobs/:id/inputs", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as Record<string, unknown>;
    const inputs = body.inputs as Record<string, unknown> | undefined;
    const name = body.name as string | undefined;

    const [job] = await db
      .select()
      .from(schema.jobs)
      .where(eq(schema.jobs.id, id))
      .limit(1);

    if (!job) return reply.code(404).send({ error: "Job not found" });

    const now = new Date().toISOString();
    const update: Record<string, unknown> = { updatedAt: now };

    if (inputs !== undefined) update.inputs = JSON.stringify(inputs);
    if (name !== undefined) update.name = name;

    await db
      .update(schema.jobs)
      .set(update as any)
      .where(eq(schema.jobs.id, id));

    const [updated] = await db
      .select()
      .from(schema.jobs)
      .where(eq(schema.jobs.id, id))
      .limit(1);

    return reply.code(200).send(updated);
  });

  // ── Delete job ───────────────────────────────────────────────────────

  server.delete("/api/jobs/:id", async (req, reply) => {
    const { id } = req.params as { id: string };

    const [job] = await db
      .select()
      .from(schema.jobs)
      .where(eq(schema.jobs.id, id))
      .limit(1);

    if (!job) return reply.code(404).send({ error: "Job not found" });

    // Cascade delete: version IDs → artifactLocks, gen IDs → sunoTracks, then job
    // Get version IDs for this job to cascade
    const versionRows = await db
      .select({ id: schema.versions.id })
      .from(schema.versions)
      .where(eq(schema.versions.jobId, id));
    const versionIds = versionRows.map((r) => r.id);

    // Delete sunoTracks via generation IDs for this job
    const genRows = await db
      .select({ id: schema.generations.id })
      .from(schema.generations)
      .where(eq(schema.generations.jobId, id));
    const genIds = genRows.map((r) => r.id);

    if (genIds.length > 0) {
      for (const gid of genIds) {
        await db
          .delete(schema.sunoTracks)
          .where(eq(schema.sunoTracks.generationId, gid));
      }
    }
    if (versionIds.length > 0) {
      for (const vid of versionIds) {
        await db
          .delete(schema.artifactLocks)
          .where(eq(schema.artifactLocks.versionId, vid));
      }
    }

    await db.delete(schema.generations).where(eq(schema.generations.jobId, id));
    await db.delete(schema.versions).where(eq(schema.versions.jobId, id));
    await db
      .delete(schema.jobStageOutputs)
      .where(eq(schema.jobStageOutputs.jobId, id));
    await db.delete(schema.jobEvents).where(eq(schema.jobEvents.jobId, id));
    await db
      .delete(schema.criticFindings)
      .where(eq(schema.criticFindings.jobId, id));
    await db.delete(schema.adjustments).where(eq(schema.adjustments.jobId, id));
    await db.delete(schema.jobs).where(eq(schema.jobs.id, id));

    return reply.code(204).send();
  });

  // ── Set NL adjustments ──────────────────────────────────────────────

  server.patch("/api/jobs/:id/nl-adjustments", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as { nlAdjustments?: unknown } | undefined;
    let nlValue: string | null = null;
    if (body?.nlAdjustments !== undefined) {
      nlValue =
        typeof body.nlAdjustments === "string"
          ? body.nlAdjustments
          : JSON.stringify(body.nlAdjustments);
    }

    const [job] = await db
      .select()
      .from(schema.jobs)
      .where(eq(schema.jobs.id, id))
      .limit(1);

    if (!job) return reply.code(404).send({ error: "Job not found" });

    const now = new Date().toISOString();
    await db
      .update(schema.jobs)
      .set({ nlAdjustments: nlValue, updatedAt: now })
      .where(eq(schema.jobs.id, id));

    const [updated] = await db
      .select()
      .from(schema.jobs)
      .where(eq(schema.jobs.id, id))
      .limit(1);

    return reply.code(200).send(updated);
  });

  // ── Submit review: filter findings and continue to revision ──────────

  server.post("/api/jobs/:id/review", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as { findings?: CriticFinding[] } | undefined;

    const [job] = await db
      .select()
      .from(schema.jobs)
      .where(eq(schema.jobs.id, id))
      .limit(1);

    if (!job) return reply.code(404).send({ error: "Job not found" });
    if (job.status !== "in_progress" || job.currentStage !== "review") {
      return reply.code(400).send({ error: "Job must be at review stage" });
    }

    const finalFindings =
      body?.findings ?? (job.findings ? JSON.parse(job.findings) : []);
    const now = new Date().toISOString();

    await db
      .update(schema.jobs)
      .set({
        findings: JSON.stringify(finalFindings),
        currentStage: "revision",
        stageAttempt: 0,
        updatedAt: now,
      })
      .where(eq(schema.jobs.id, id));

    const mod = getModuleOrThrow(job.genreId);
    const pipelineDeps: PipelineDeps = { db, llm, suno, config };

    runPipeline(id, pipelineDeps, mod).catch((err) => {
      req.log.error({ jobId: id, err }, "review-continue error");
    });

    return reply.code(202).send({ status: "review_submitted", jobId: id });
  });

  // ── Replay: reset to stage and re-run ────────────────────────────────

  server.post("/api/jobs/:id/replay", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as { stage?: GenerationStage } | undefined;

    const [job] = await db
      .select()
      .from(schema.jobs)
      .where(eq(schema.jobs.id, id))
      .limit(1);

    if (!job) return reply.code(404).send({ error: "Job not found" });
    if (job.status !== "completed" && job.status !== "failed") {
      return reply
        .code(400)
        .send({ error: "Job must be completed or failed to replay" });
    }

    const stage = body?.stage ?? "ref_interpretation";
    await resetJobStage(db, id as any, stage);

    const mod = getModuleOrThrow(job.genreId);
    const pipelineDeps: PipelineDeps = { db, llm, suno, config };

    runPipeline(id, pipelineDeps, mod).catch((err) => {
      req.log.error({ jobId: id, err }, "replay error");
    });

    return reply.code(202).send({ status: "replaying", jobId: id, stage });
  });

  // ── Retry: retry failed stage ───────────────────────────────────────

  server.post("/api/jobs/:id/retry", async (req, reply) => {
    const { id } = req.params as { id: string };

    const [job] = await db
      .select()
      .from(schema.jobs)
      .where(eq(schema.jobs.id, id))
      .limit(1);

    if (!job) return reply.code(404).send({ error: "Job not found" });
    if (job.status !== "failed") {
      return reply.code(400).send({ error: "Job must be failed to retry" });
    }

    await resetJobStage(db, id as any, job.currentStage as GenerationStage);

    const mod = getModuleOrThrow(job.genreId);
    const pipelineDeps: PipelineDeps = { db, llm, suno, config };

    runPipeline(id, pipelineDeps, mod).catch((err) => {
      req.log.error({ jobId: id, err }, "retry error");
    });

    return reply.code(202).send({ status: "retrying", jobId: id });
  });

  // ── Cancel: stop running job ────────────────────────────────────────

  server.post("/api/jobs/:id/cancel", async (req, reply) => {
    const { id } = req.params as { id: string };

    const [job] = await db
      .select()
      .from(schema.jobs)
      .where(eq(schema.jobs.id, id))
      .limit(1);

    if (!job) return reply.code(404).send({ error: "Job not found" });

    // Abort in-flight pipeline work — must happen before DB update
    abortJob(id);

    // Signal cancellation via events then update DB (atomic)
    await db.transaction(async (tx) => {
      await publish(tx as any, id, { stage: "cancelled", status: "completed" });
      await cancelJob(tx as any, id as any);
    });

    return reply.code(200).send({ status: "cancelled", jobId: id });
  });

  // ── Start pipeline ───────────────────────────────────────────────────

  server.post("/api/jobs/:id/start", async (req, reply) => {
    const { id } = req.params as { id: string };

    const [job] = await db
      .select()
      .from(schema.jobs)
      .where(eq(schema.jobs.id, id))
      .limit(1);

    if (!job) return reply.code(404).send({ error: "Job not found" });
    if (job.status !== "pending") {
      return reply.code(400).send({ error: "Job not in pending status" });
    }

    const mod = getModuleOrThrow(job.genreId);
    const pipelineDeps: PipelineDeps = { db, llm, suno, config };

    // Background execution — fire and forget
    runPipeline(id, pipelineDeps, mod)
      .then((result) => {
        req.log.info(
          { jobId: id, success: result.success },
          "pipeline completed",
        );
      })
      .catch((err) => {
        req.log.error({ jobId: id, err }, "pipeline error");
      });

    return reply.code(202).send({ status: "started", jobId: id });
  });

  // ── Payload preview ──────────────────────────────────────────────────

  server.get("/api/jobs/:id/payload-preview", async (req, reply) => {
    const { id } = req.params as { id: string };

    const [job] = await db
      .select()
      .from(schema.jobs)
      .where(eq(schema.jobs.id, id))
      .limit(1);

    if (!job) return reply.code(404).send({ error: "Job not found" });

    // Extract compiled artifacts — prefer latest version, fallback to compiledJson
    const versions = await db
      .select()
      .from(schema.versions)
      .where(eq(schema.versions.jobId, id))
      .orderBy(desc(schema.versions.number))
      .limit(1);

    let title = "";
    let style = "";
    let excludedStyles = "";
    let lyrics = "";
    const latestVersion = versions[0];

    if (latestVersion) {
      const artifacts = JSON.parse(
        latestVersion.artifacts as string,
      ) as SunoArtifact[];
      for (const a of artifacts) {
        if (a.type === "title") title = a.value;
        else if (a.type === "style") style = a.value;
        else if (a.type === "excluded_styles") excludedStyles = a.value;
        else if (a.type === "lyrics") lyrics = a.value;
      }
    } else if (job.compiledJson != null) {
      const compiled = JSON.parse(job.compiledJson) as Record<string, string>;
      title = compiled.title ?? "";
      style = compiled.style ?? "";
      excludedStyles = compiled.excludedStyles ?? "";
      lyrics = compiled.lyrics ?? "";
    }

    // Resolve callback URL from config
    const callbackUrl = config.publicBaseUrl
      ? `${config.publicBaseUrl.replace(/\/+$/, "")}/api/suno/callback`
      : undefined;

    const result = generateSunoPayload({
      title,
      style,
      excludedStyles,
      lyrics,
      callbackUrl,
    });
    return { ...result, callbackUrl };
  });

  // ── List genres ──────────────────────────────────────────────────────

  server.get("/api/genres", async () => {
    const { listGenres } = await import("../lib/modules.js");
    return listGenres();
  });

  // ── Genre presets (from YAML config) ─────────────────────────────────

  server.get("/api/genres/:id/presets", async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      const { getPresets } = await import("../lib/genre-config.js");
      return getPresets(id);
    } catch {
      return reply.code(404).send({ error: `Unknown genre: ${id}` });
    }
  });

  // ── Genre tag categories (from YAML config) ──────────────────────────

  server.get("/api/genres/:id/tag-categories", async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      const { getTagCategories } = await import("../lib/genre-config.js");
      return getTagCategories(id);
    } catch {
      return reply.code(404).send({ error: `Unknown genre: ${id}` });
    }
  });

  // ── Style tag suggestions (LLM-powered) ───────────────────────────────

  server.post("/api/jobs/style-tag-suggestions", async (req, reply) => {
    const body = req.body as Record<string, unknown> | undefined;
    const genreId = body?.genreId as string | undefined;
    const presetId = body?.presetId as string | undefined;
    const reference = body?.reference as string | undefined;
    const bpm = body?.bpm as number | undefined;
    const key = body?.key as string | undefined;

    if (!genreId) return reply.code(400).send({ error: "genreId required" });

    let module: import("@track-forge/genre-core").GenreModule;
    try {
      const { getModuleOrThrow } = await import("../lib/modules.js");
      module = getModuleOrThrow(genreId);
    } catch {
      return reply.code(404).send({ error: `Unknown genre: ${genreId}` });
    }

    const promptTemplate = module.promptFragments?.style_tag_suggestions;
    if (!promptTemplate)
      return reply
        .code(400)
        .send({ error: "No tag suggestion prompt for this genre" });

    const context: Record<string, unknown> = {
      subgenre: presetId?.replace(/_/g, " ") ?? "",
      bpm: bpm ?? 120,
      key: key ?? "C",
      scale: "minor",
      mood: "",
      energy: 7,
      complexity: 5,
    };

    const prompt = Object.entries(context).reduce(
      (p, [k, v]) => p.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), String(v)),
      promptTemplate,
    );

    try {
      const result = await llm.complete({
        messages: [
          {
            role: "system",
            content:
              "You are a music production expert. Return ONLY valid JSON.",
          },
          { role: "user", content: prompt },
        ],
        maxTokens: 1024,
      });
      const content = result.content?.trim() ?? "";
      const jsonStart = content.indexOf("{");
      const jsonEnd = content.lastIndexOf("}");
      if (jsonStart === -1 || jsonEnd === -1) {
        return reply.code(200).send({ suggestions: [] });
      }
      const parsed = JSON.parse(content.slice(jsonStart, jsonEnd + 1));
      const suggestions = Object.entries(parsed).map(([category, tags]) => ({
        category,
        tags: Array.isArray(tags) ? tags.map(String) : [],
      }));
      return { suggestions };
    } catch {
      return { suggestions: [] };
    }
  });
}
