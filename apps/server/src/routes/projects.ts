import type { FastifyInstance } from "fastify";
import { eq, desc, sql, count } from "drizzle-orm";
import type { Db } from "@track-forge/core";
import { schema } from "@track-forge/core";
import type { Config } from "@track-forge/contracts";

export interface ProjectRouteDeps {
  db: Db;
  config: Config;
}

export function registerProjectRoutes(server: FastifyInstance, deps: ProjectRouteDeps): void {
  const { db } = deps;

  // ── Get project ────────────────────────────────────────────────────────

  server.get("/api/projects/:id", async (req, reply) => {
    const { id } = req.params as { id: string };

    const [project] = await db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.id, id))
      .limit(1);

    if (!project) return reply.code(404).send({ error: "Project not found" });
    return project;
  });

  // ── Project stats (aggregated across jobs) ──────────────────────────────

  server.get("/api/projects/:id/stats", async (req, reply) => {
    const { id } = req.params as { id: string };

    const [project] = await db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.id, id))
      .limit(1);

    if (!project) return reply.code(404).send({ error: "Project not found" });

    const [totalJobs] = await db
      .select({ value: sql<number>`count(*)` })
      .from(schema.jobs)
      .where(eq(schema.jobs.projectId, id));

    const [draftCount] = await db
      .select({ value: sql<number>`count(*)` })
      .from(schema.projectDrafts)
      .where(eq(schema.projectDrafts.projectId, id));

    const statusRows = await db
      .select({ status: schema.jobs.status, count: sql<number>`count(*)` })
      .from(schema.jobs)
      .where(eq(schema.jobs.projectId, id))
      .groupBy(schema.jobs.status);

    const [latestJob] = await db
      .select()
      .from(schema.jobs)
      .where(eq(schema.jobs.projectId, id))
      .orderBy(desc(schema.jobs.createdAt))
      .limit(1);

    return {
      totalJobs: Number(totalJobs?.value ?? 0),
      draftCount: Number(draftCount?.value ?? 0),
      jobsByStatus: Object.fromEntries(statusRows.map((r) => [r.status, Number(r.count)])),
      latestActivity: latestJob?.updatedAt ?? null,
    };
  });

  // ── Create project ─────────────────────────────────────────────────────

  server.post("/api/projects", async (req, reply) => {
    const body = req.body as Record<string, unknown>;
    const name = body.name as string | undefined;
    const description = (body.description as string) ?? null;
    const genreId = (body.genreId as string) ?? null;

    if (!name || typeof name !== "string") {
      return reply.code(400).send({ error: "name required" });
    }

    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    await db.insert(schema.projects).values({
      id,
      name,
      description,
      genreId,
      createdAt: now,
      updatedAt: now,
    });

    const [created] = await db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.id, id))
      .limit(1);

    return reply.code(201).send(created);
  });

  // ── Update project ─────────────────────────────────────────────────────

  server.patch("/api/projects/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as Record<string, unknown>;
    const name = body.name as string | undefined;
    const description = body.description as string | undefined | null;
    const genreId = body.genreId as string | undefined | null;

    const [project] = await db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.id, id))
      .limit(1);

    if (!project) return reply.code(404).send({ error: "Project not found" });

    const now = new Date().toISOString();
    const update: Record<string, unknown> = { updatedAt: now };

    if (name !== undefined) update.name = name;
    if (description !== undefined) update.description = description;
    if (genreId !== undefined) update.genreId = genreId;

    await db
      .update(schema.projects)
      .set(update as any)
      .where(eq(schema.projects.id, id));

    const [updated] = await db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.id, id))
      .limit(1);

    return reply.code(200).send(updated);
  });

  // ── Delete project ─────────────────────────────────────────────────────

  server.delete("/api/projects/:id", async (req, reply) => {
    const { id } = req.params as { id: string };

    const [project] = await db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.id, id))
      .limit(1);

    if (!project) return reply.code(404).send({ error: "Project not found" });

    // Cascade: delete drafts, jobs, and their children
    await db.delete(schema.projectDrafts).where(eq(schema.projectDrafts.projectId, id));

    const projectJobs = await db
      .select()
      .from(schema.jobs)
      .where(eq(schema.jobs.projectId, id));

    for (const job of projectJobs) {
      await db.delete(schema.versions).where(eq(schema.versions.jobId, job.id));
    }
    await db.delete(schema.jobs).where(eq(schema.jobs.projectId, id));
    await db.delete(schema.projects).where(eq(schema.projects.id, id));

    return reply.code(204).send();
  });

  // ── List drafts for project ────────────────────────────────────────────

  server.get("/api/projects/:id/drafts", async (req, reply) => {
    const { id } = req.params as { id: string };

    const [project] = await db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.id, id))
      .limit(1);

    if (!project) return reply.code(404).send({ error: "Project not found" });

    const rows = await db
      .select()
      .from(schema.projectDrafts)
      .where(eq(schema.projectDrafts.projectId, id))
      .orderBy(desc(schema.projectDrafts.createdAt));

    return rows;
  });

  // ── Get draft ──────────────────────────────────────────────────────────

  server.get("/api/drafts/:id", async (req, reply) => {
    const { id } = req.params as { id: string };

    const [draft] = await db
      .select()
      .from(schema.projectDrafts)
      .where(eq(schema.projectDrafts.id, id))
      .limit(1);

    if (!draft) return reply.code(404).send({ error: "Draft not found" });
    return draft;
  });

  // ── Create draft ───────────────────────────────────────────────────────

  server.post("/api/projects/:id/drafts", async (req, reply) => {
    const { id: projectId } = req.params as { id: string };
    const body = req.body as Record<string, unknown>;
    const genreId = body.genreId as string | undefined;
    const presetId = body.presetId as string | undefined;
    const inputs = (body.inputs as string) ?? null;
    const reference = (body.reference as string) ?? null;
    const rawNl = body.nlAdjustments;
    const nlAdjustments = typeof rawNl === "string" ? rawNl : rawNl ? JSON.stringify(rawNl) : null;

    const [project] = await db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.id, projectId))
      .limit(1);

    if (!project) return reply.code(404).send({ error: "Project not found" });
    if (!genreId || !presetId) {
      return reply.code(400).send({ error: "genreId and presetId required" });
    }

    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    await db.insert(schema.projectDrafts).values({
      id,
      projectId,
      genreId,
      presetId,
      inputs,
      reference,
      nlAdjustments,
      createdAt: now,
      updatedAt: now,
    });

    const [created] = await db
      .select()
      .from(schema.projectDrafts)
      .where(eq(schema.projectDrafts.id, id))
      .limit(1);

    return reply.code(201).send(created);
  });

  // ── Update draft ───────────────────────────────────────────────────────

  server.patch("/api/drafts/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as Record<string, unknown>;
    const genreId = body.genreId as string | undefined;
    const presetId = body.presetId as string | undefined;
    const inputs = body.inputs as string | undefined | null;
    const reference = body.reference as string | undefined | null;
    const rawNl = body.nlAdjustments;
    const nlAdjustments = rawNl === undefined ? undefined
      : rawNl === null ? null
      : typeof rawNl === "string" ? rawNl
      : JSON.stringify(rawNl);

    const [draft] = await db
      .select()
      .from(schema.projectDrafts)
      .where(eq(schema.projectDrafts.id, id))
      .limit(1);

    if (!draft) return reply.code(404).send({ error: "Draft not found" });

    const now = new Date().toISOString();
    const update: Record<string, unknown> = { updatedAt: now };

    if (genreId !== undefined) update.genreId = genreId;
    if (presetId !== undefined) update.presetId = presetId;
    if (inputs !== undefined) update.inputs = inputs;
    if (reference !== undefined) update.reference = reference;
    if (nlAdjustments !== undefined) update.nlAdjustments = nlAdjustments;

    await db
      .update(schema.projectDrafts)
      .set(update as any)
      .where(eq(schema.projectDrafts.id, id));

    const [updated] = await db
      .select()
      .from(schema.projectDrafts)
      .where(eq(schema.projectDrafts.id, id))
      .limit(1);

    return reply.code(200).send(updated);
  });

  // ── Delete draft ───────────────────────────────────────────────────────

  server.delete("/api/drafts/:id", async (req, reply) => {
    const { id } = req.params as { id: string };

    const [draft] = await db
      .select()
      .from(schema.projectDrafts)
      .where(eq(schema.projectDrafts.id, id))
      .limit(1);

    if (!draft) return reply.code(404).send({ error: "Draft not found" });

    await db.delete(schema.projectDrafts).where(eq(schema.projectDrafts.id, id));
    return reply.code(204).send();
  });

  // ── List jobs for project ──────────────────────────────────────────────

  server.get("/api/projects/:id/jobs", async (req, reply) => {
    const { id } = req.params as { id: string };

    const [project] = await db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.id, id))
      .limit(1);

    if (!project) return reply.code(404).send({ error: "Project not found" });

    const query = req.query as { limit?: string; offset?: string };
    const limit = Math.min(parseInt(query.limit ?? "50", 10) || 50, 100);
    const offset = parseInt(query.offset ?? "0", 10) || 0;

    const rows = await db
      .select()
      .from(schema.jobs)
      .where(eq(schema.jobs.projectId, id))
      .orderBy(desc(schema.jobs.createdAt))
      .limit(limit)
      .offset(offset);

    return rows;
  });
}
