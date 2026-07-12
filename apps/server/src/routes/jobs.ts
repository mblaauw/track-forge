import type { FastifyInstance } from "fastify";
import { eq, desc } from "drizzle-orm";
import type { Db, LlmClient, SunoClient } from "@track-forge/core";
import { createJob, runPipeline, schema } from "@track-forge/core";
import type { PipelineDeps } from "@track-forge/core";
import type { Config } from "@track-forge/contracts";
import { getModuleOrThrow } from "../lib/modules.js";

export interface JobRouteDeps {
  db: Db;
  config: Config;
  llm: LlmClient;
  suno: SunoClient;
}

export function registerJobRoutes(server: FastifyInstance, deps: JobRouteDeps): void {
  const { db, config, llm, suno } = deps;

  // ── Create job ───────────────────────────────────────────────────────

  server.post("/api/jobs", async (req, reply) => {
    const body = req.body as Record<string, unknown>;
    const genreId = body.genreId as string | undefined;
    const presetId = body.presetId as string | undefined;
    const inputs = body.inputs ?? {};
    const reference = (body.reference as string) ?? null;

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
      return reply.code(400).send({ error: "Invalid inputs", details: parsed.error.issues });
    }

    const job = await createJob(
      db,
      genreId as never,
      presetId as never,
      JSON.stringify(inputs),
      reference,
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
        req.log.info({ jobId: id, success: result.success }, "pipeline completed");
      })
      .catch((err) => {
        req.log.error({ jobId: id, err }, "pipeline error");
      });

    return reply.code(202).send({ status: "started", jobId: id });
  });

  // ── List genres ──────────────────────────────────────────────────────

  server.get("/api/genres", async () => {
    const { listGenres } = await import("../lib/modules.js");
    return listGenres();
  });
}
