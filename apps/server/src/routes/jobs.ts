import type { FastifyInstance } from "fastify";
import { eq, desc, sql, inArray } from "drizzle-orm";
import type { Db } from "@track-forge/core";
import type { LlmRequest, LlmResponse } from "@track-forge/core";
import {
  createJob,
  runPipeline,
  schema,
  cancelJob,
  abortJob,
  publish,
} from "@track-forge/core";
import type { PipelineDeps } from "@track-forge/core";
import type { Config, JobId } from "@track-forge/contracts";
import { getModuleOrThrow, listGenres } from "../lib/modules.js";
import {
  getPresets,
  getTagCategories,
  getDescriptorDefaults,
} from "../lib/genre-config.js";
import { findRowOr404, parsePagination } from "../lib/db-utils.js";
import {
  validateBody,
  validateQuery,
  validateParams,
  IdParams,
  GenreIdParams,
  PaginationQuery,
  CreateJobBody,
  UpdateJobNameBody,
  UpdateJobInputsBody,
} from "../lib/validate.js";

export interface JobRouteDeps {
  db: Db;
  config: Config;
  llm: { complete(req: LlmRequest): Promise<LlmResponse> };
  suno: {
    submit(
      req: unknown,
    ): Promise<{ taskId: string; callbackConfigured: boolean }>;
    waitForCompletion(id: string): Promise<unknown>;
  };
}

export function registerJobRoutes(
  server: FastifyInstance,
  deps: JobRouteDeps,
): void {
  const { db, config, llm, suno } = deps;

  function dispatchPipeline(
    jobId: string,
    genreId: string,
    log: { error: (obj: Record<string, unknown>, msg: string) => void },
    label: string,
  ): void {
    const mod = getModuleOrThrow(genreId);
    const pipelineDeps: PipelineDeps = { db, llm, config };

    runPipeline(jobId, pipelineDeps, mod).catch((err) => {
      log.error({ jobId, err }, `${label} error`);
    });
  }

  // ── Create job ───────────────────────────────────────────────────────

  server.post("/api/jobs", async (req, reply) => {
    const { genreId, presetId, inputs, reference, name } = validateBody(
      CreateJobBody,
      req,
    );

    let mod;
    try {
      mod = getModuleOrThrow(genreId);
    } catch {
      return reply.code(404).send({ error: `Unknown genre: ${genreId}` });
    }

    // Merge preset values into inputs before validation so genre-specific
    // fields like subgenre, soundscape, flowPattern are populated from the
    // preset YAML config when the frontend only sends common fields.
    const presetValues =
      getPresets(genreId).find((p) => p.id === presetId)?.values ?? {};
    const merged = { ...presetValues, ...inputs };

    const parsed = mod.inputSchema.safeParse(merged);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: "Invalid inputs", details: parsed.error.issues });
    }

    const job = await createJob(
      db,
      genreId as never,
      presetId as never,
      JSON.stringify(merged),
      reference ?? null,
      name ?? null,
    );

    return reply.code(201).send(job);
  });

  // ── List jobs ────────────────────────────────────────────────────────

  server.get("/api/jobs", async (req) => {
    const query = validateQuery(PaginationQuery, req);
    const { limit, offset } = parsePagination(
      { limit: String(query.limit ?? 20), offset: String(query.offset ?? 0) },
      { limit: 20, maxLimit: 100 },
    );

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
    const { id } = validateParams(IdParams, req);

    const job = await findRowOr404(
      db,
      schema.jobs,
      eq(schema.jobs.id, id),
      "Job",
    );
    return job;
  });

  // ── Rename job ───────────────────────────────────────────────────────

  server.patch("/api/jobs/:id", async (req, reply) => {
    const { id } = validateParams(IdParams, req);
    const { name } = validateBody(UpdateJobNameBody, req);

    const job = await findRowOr404(
      db,
      schema.jobs,
      eq(schema.jobs.id, id),
      "Job",
    );

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
    const { id } = validateParams(IdParams, req);

    const now = new Date().toISOString();
    await db
      .update(schema.jobs)
      .set({
        isFavorite: sql`NOT ${schema.jobs.isFavorite}`,
        updatedAt: now,
      })
      .where(eq(schema.jobs.id, id));

    const [updated] = await db
      .select()
      .from(schema.jobs)
      .where(eq(schema.jobs.id, id))
      .limit(1);

    if (!updated) {
      return reply.code(404).send({ error: "Job not found" });
    }

    return reply.code(200).send(updated);
  });

  // ── Update job inputs (autosave) ────────────────────────────────────

  server.patch("/api/jobs/:id/inputs", async (req, reply) => {
    const { id } = validateParams(IdParams, req);
    const { inputs, name } = validateBody(UpdateJobInputsBody, req);

    const job = await findRowOr404(
      db,
      schema.jobs,
      eq(schema.jobs.id, id),
      "Job",
    );

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
    const { id } = validateParams(IdParams, req);

    const job = await findRowOr404(
      db,
      schema.jobs,
      eq(schema.jobs.id, id),
      "Job",
    );

    // Cascade delete: generations → sunoTracks, then versions, then job
    const versionRows = await db
      .select({ id: schema.versions.id })
      .from(schema.versions)
      .where(eq(schema.versions.jobId, id));
    const versionIds = versionRows.map((r) => r.id);

    const genRows = await db
      .select({ id: schema.generations.id })
      .from(schema.generations)
      .where(eq(schema.generations.jobId, id));
    const genIds = genRows.map((r) => r.id);

    await db.transaction(async (tx) => {
      if (genIds.length > 0) {
        await tx
          .delete(schema.sunoTracks)
          .where(inArray(schema.sunoTracks.generationId, genIds));
      }

      await tx
        .delete(schema.generations)
        .where(eq(schema.generations.jobId, id));
      await tx.delete(schema.versions).where(eq(schema.versions.jobId, id));
      await tx.delete(schema.jobEvents).where(eq(schema.jobEvents.jobId, id));
      await tx.delete(schema.jobs).where(eq(schema.jobs.id, id));
    });

    return reply.code(204).send();
  });

  // ── Cancel: stop running job ────────────────────────────────────────

  server.post("/api/jobs/:id/cancel", async (req, reply) => {
    const { id } = validateParams(IdParams, req);

    const job = await findRowOr404(
      db,
      schema.jobs,
      eq(schema.jobs.id, id),
      "Job",
    );

    // Abort in-flight pipeline work — must happen before DB update
    abortJob(id);

    // Signal cancellation via events then update DB (atomic)
    const sqlite = (db as any).$client;
    sqlite.transaction(() => {
      const now = new Date().toISOString();
      sqlite
        .prepare(
          "INSERT INTO job_events (id, job_id, sequence, stage, status, timestamp) VALUES (?, ?, (SELECT COALESCE(MAX(sequence), 0) + 1 FROM job_events WHERE job_id = ?), ?, ?, ?)",
        )
        .run(crypto.randomUUID(), id, id, "cancelled", "cancelled", now);
      sqlite
        .prepare(
          "UPDATE jobs SET status = 'cancelled', error = 'Cancelled by user', updated_at = ? WHERE id = ?",
        )
        .run(now, id);
    })();

    // Notify in-memory subscribers
    publish(db, id, { stage: "cancelled", status: "cancelled" }).catch(
      () => {},
    );

    return reply.code(200).send({ status: "cancelled", jobId: id });
  });

  // ── Start pipeline ───────────────────────────────────────────────────

  server.post("/api/jobs/:id/start", async (req, reply) => {
    const { id } = validateParams(IdParams, req);

    const job = await findRowOr404(
      db,
      schema.jobs,
      eq(schema.jobs.id, id),
      "Job",
    );
    if (job.status !== "pending") {
      return reply.code(400).send({ error: "Job not in pending status" });
    }

    const now = new Date().toISOString();
    await db
      .update(schema.jobs)
      .set({ status: "in_progress", updatedAt: now })
      .where(eq(schema.jobs.id, id));

    dispatchPipeline(id, job.genreId, req.log, "start");

    return reply.code(202).send({ status: "started", jobId: id });
  });

  // ── List genres ──────────────────────────────────────────────────────

  server.get("/api/genres", async () => {
    return listGenres();
  });

  // ── Genre presets (from YAML config) ─────────────────────────────────

  server.get("/api/genres/:id/presets", async (req, reply) => {
    const { id } = validateParams(GenreIdParams, req);
    try {
      return getPresets(id);
    } catch {
      return reply.code(404).send({ error: `Unknown genre: ${id}` });
    }
  });

  // ── Genre tag categories (from YAML config) ──────────────────────────

  server.get("/api/genres/:id/tag-categories", async (req, reply) => {
    const { id } = validateParams(GenreIdParams, req);
    try {
      return getTagCategories(id);
    } catch {
      return reply.code(404).send({ error: `Unknown genre: ${id}` });
    }
  });

  // ── Genre descriptor defaults ────────────────────────────────────────

  server.get("/api/genres/:id/descriptor-defaults", async (req, reply) => {
    const { id } = validateParams(GenreIdParams, req);
    try {
      return getDescriptorDefaults(id);
    } catch {
      return reply.code(404).send({ error: `Unknown genre: ${id}` });
    }
  });

  // ── End of job routes ──────────────────────────────────────────────
}
