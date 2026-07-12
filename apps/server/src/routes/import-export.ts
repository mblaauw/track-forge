import type { FastifyInstance } from "fastify";
import { eq, inArray } from "drizzle-orm";
import type { Db } from "@track-forge/core";
import { schema } from "@track-forge/core";
import type { JobExport, ExportBundle, ImportResult } from "@track-forge/contracts";
import { getModule } from "../lib/modules.js";

export interface ImportExportRouteDeps {
  db: Db;
}

export function registerImportExportRoutes(server: FastifyInstance, deps: ImportExportRouteDeps): void {
  const { db } = deps;

  // ── Export single job ─────────────────────────────────────────────

  server.get("/api/jobs/:id/export", async (req, reply) => {
    const { id } = req.params as { id: string };

    const [job] = await db
      .select()
      .from(schema.jobs)
      .where(eq(schema.jobs.id, id))
      .limit(1);

    if (!job) return reply.code(404).send({ error: "Job not found" });

    const versions = await db
      .select()
      .from(schema.versions)
      .where(eq(schema.versions.jobId, id))
      .orderBy(schema.versions.number);

    const bundle: ExportBundle = {
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      jobs: [{ job: job as any, versions: versions as any[] }],
    };

    return bundle;
  });

  // ── Bulk export ───────────────────────────────────────────────────

  server.post("/api/jobs/export", async (req, reply) => {
    const body = req.body as { ids?: string[] } | undefined;
    const ids = body?.ids;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return reply.code(400).send({ error: "ids array required" });
    }

    const jobs = await db
      .select()
      .from(schema.jobs)
      .where(inArray(schema.jobs.id, ids));

    if (jobs.length === 0) {
      return reply.code(404).send({ error: "No jobs found" });
    }

    const entries: JobExport[] = [];

    for (const job of jobs) {
      const versions = await db
        .select()
        .from(schema.versions)
        .where(eq(schema.versions.jobId, job.id))
        .orderBy(schema.versions.number);

      entries.push({ job: job as any, versions: versions as any[] });
    }

    const bundle: ExportBundle = {
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      jobs: entries,
    };

    return bundle;
  });

  // ── Import ────────────────────────────────────────────────────────

  server.post("/api/jobs/import", async (req, reply) => {
    const body = req.body as ExportBundle | undefined;

    if (!body || body.formatVersion !== 1) {
      return reply.code(400).send({ error: "Invalid or missing formatVersion. Expected 1." });
    }

    if (!Array.isArray(body.jobs) || body.jobs.length === 0) {
      return reply.code(400).send({ error: "jobs array required" });
    }

    const result: ImportResult = { imported: 0, skipped: 0, errors: [] };

    for (let i = 0; i < body.jobs.length; i++) {
      const entry = body.jobs[i]!;

      try {
        if (!entry.job || !entry.job.genreId || !entry.job.presetId) {
          throw new Error("Missing required job fields (genreId, presetId)");
        }

        const mod = getModule(entry.job.genreId);
        if (!mod) {
          throw new Error(`Unknown genre: ${entry.job.genreId}`);
        }

        if (entry.job.inputs) {
          try {
            const parsed = JSON.parse(entry.job.inputs);
            const validated = mod.inputSchema.safeParse(parsed);
            if (!validated.success) {
              throw new Error(`Invalid inputs for genre ${entry.job.genreId}: ${validated.error.message}`);
            }
          } catch (e) {
            if (e instanceof SyntaxError) {
              throw new Error("Invalid JSON in inputs field");
            }
            throw e;
          }
        }

        const [existing] = await db
          .select()
          .from(schema.jobs)
          .where(eq(schema.jobs.id, entry.job.id))
          .limit(1);

        if (existing) {
          result.skipped++;
          continue;
        }

        const now = new Date().toISOString();

        await db.insert(schema.jobs).values({
          id: entry.job.id,
          name: entry.job.name ?? null,
          genreId: entry.job.genreId,
          presetId: entry.job.presetId,
          status: entry.job.status ?? "pending",
          currentStage: entry.job.currentStage ?? "ref_interpretation",
          reference: entry.job.reference ?? null,
          sourceHash: entry.job.sourceHash ?? null,
          inputs: entry.job.inputs ?? null,
          nlAdjustments: entry.job.nlAdjustments ?? null,
          findings: entry.job.findings ?? null,
          compiledJson: entry.job.compiledJson ?? null,
          stageAttempt: entry.job.stageAttempt ?? 0,
          error: entry.job.error ?? null,
          createdAt: entry.job.createdAt ?? now,
          updatedAt: now,
        });

        if (Array.isArray(entry.versions)) {
          for (const v of entry.versions) {
            await db.insert(schema.versions).values({
              id: v.id,
              jobId: entry.job.id,
              status: v.status ?? "draft",
              number: v.number,
              artifacts: typeof v.artifacts === "string" ? v.artifacts : JSON.stringify(v.artifacts ?? []),
              stage: v.stage ?? null,
              parentVersionId: v.parentVersionId ?? null,
              finalizedAt: v.finalizedAt ?? null,
              createdAt: v.createdAt ?? now,
            });
          }
        }

        result.imported++;
      } catch (err) {
        result.errors.push({
          index: i,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return reply.code(result.imported > 0 ? 201 : 200).send(result);
  });
}
