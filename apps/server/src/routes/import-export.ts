import type { FastifyInstance } from "fastify";
import { eq, inArray } from "drizzle-orm";
import type { Db } from "@track-forge/core";
import { schema } from "@track-forge/core";
import {
  ImportBundleSchema,
  type JobExport,
  type ExportBundle,
  type ImportResult,
} from "@track-forge/contracts";
import { getModule } from "../lib/modules.js";
import { findRowOr404 } from "../lib/db-utils.js";
import {
  validateParams,
  validateBody,
  IdParams,
  BulkExportBody,
} from "../lib/validate.js";

export interface ImportExportRouteDeps {
  db: Db;
}

export function registerImportExportRoutes(
  server: FastifyInstance,
  deps: ImportExportRouteDeps,
): void {
  const { db } = deps;

  // ── Export single project ─────────────────────────────────────────

  server.get("/api/projects/:id/export", async (req, reply) => {
    const { id } = validateParams(IdParams, req);

    const project = await findRowOr404(
      db,
      schema.projects,
      eq(schema.projects.id, id),
      "Project",
    );

    const projectJobs = await db
      .select()
      .from(schema.jobs)
      .where(eq(schema.jobs.projectId, id));

    const entries: JobExport[] = [];

    for (const job of projectJobs) {
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
      projects: [{ project: project as any, jobs: entries }],
    };

    return bundle;
  });

  // ── Export single job ─────────────────────────────────────────────

  server.get("/api/jobs/:id/export", async (req, reply) => {
    const { id } = validateParams(IdParams, req);

    const job = await findRowOr404(
      db,
      schema.jobs,
      eq(schema.jobs.id, id),
      "Job",
    );

    const versions = await db
      .select()
      .from(schema.versions)
      .where(eq(schema.versions.jobId, id))
      .orderBy(schema.versions.number);

    const bundle: ExportBundle = {
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      projects: [
        {
          project: {
            id: job.projectId ?? (("job-" + job.id) as any),
            name: job.name ?? "Exported Job",
            description: null,
            genreId: job.genreId as any,
            createdAt: job.createdAt,
            updatedAt: job.updatedAt,
          },
          jobs: [{ job: job as any, versions: versions as any[] }],
        },
      ],
    };

    return bundle;
  });

  // ── Bulk export ────────────────────────────────────────────────────

  server.post("/api/jobs/export", async (req, reply) => {
    const body = req.body
      ? validateBody(BulkExportBody, req)
      : { ids: undefined };
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
      projects: [
        {
          project: {
            id: "__bulk" as any,
            name: "Bulk Export",
            description: null,
            genreId: "__bulk" as any,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          jobs: entries,
        },
      ],
    };

    return bundle;
  });

  // ── Import ────────────────────────────────────────────────────────

  server.post("/api/projects/import", async (req, reply) => {
    const parsed = ImportBundleSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: "Invalid import bundle", details: parsed.error.issues });
    }
    const body = parsed.data;

    const result: ImportResult = { imported: 0, skipped: 0, errors: [] };
    let jobIdx = 0;

    for (const pe of body.projects ?? []) {
      try {
        const [existingProject] = await db
          .select()
          .from(schema.projects)
          .where(eq(schema.projects.id, pe.project.id))
          .limit(1);

        if (existingProject) {
          result.skipped++;
          continue;
        }

        const now = new Date().toISOString();

        await db.insert(schema.projects).values({
          id: pe.project.id,
          name: pe.project.name,
          description: pe.project.description ?? null,
          genreId: pe.project.genreId ?? null,
          createdAt: pe.project.createdAt ?? now,
          updatedAt: now,
        });

        for (const entry of pe.jobs ?? []) {
          const currentIdx = jobIdx++;

          if (!entry.job.genreId || !entry.job.presetId) {
            result.errors.push({
              index: currentIdx,
              message: `Missing required job fields in project ${pe.project.id}`,
            });
            continue;
          }

          const mod = getModule(entry.job.genreId);
          if (!mod) {
            result.errors.push({
              index: currentIdx,
              message: `Unknown genre: ${entry.job.genreId}`,
            });
            continue;
          }

          const [existingJob] = await db
            .select()
            .from(schema.jobs)
            .where(eq(schema.jobs.id, entry.job.id))
            .limit(1);

          if (existingJob) {
            result.skipped++;
            continue;
          }

          await db.insert(schema.jobs).values({
            id: entry.job.id,
            projectId: pe.project.id,
            name: entry.job.name ?? null,
            genreId: entry.job.genreId,
            presetId: entry.job.presetId,
            status: entry.job.status ?? "pending",
            currentStage: entry.job.currentStage ?? "compilation",
            reference: entry.job.reference ?? null,
            sourceHash: entry.job.sourceHash ?? null,
            inputs: entry.job.inputs ?? null,
            nlAdjustments: entry.job.nlAdjustments ?? null,
            findings: entry.job.findings ?? null,
            compiledJson: entry.job.compiledJson ?? null,
            stageData: entry.job.stageData ?? null,
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
                artifacts:
                  typeof v.artifacts === "string"
                    ? v.artifacts
                    : JSON.stringify(v.artifacts ?? []),
                stage: v.stage ?? null,
                parentVersionId: v.parentVersionId ?? null,
                finalizedAt: v.finalizedAt ?? null,
                createdAt: v.createdAt ?? now,
              });
            }
          }

          result.imported++;
        }
      } catch (err) {
        result.errors.push({
          index: jobIdx,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return reply.code(result.imported > 0 ? 201 : 200).send(result);
  });
}
