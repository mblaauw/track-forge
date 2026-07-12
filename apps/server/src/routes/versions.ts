import type { FastifyInstance } from "fastify";
import { eq, desc } from "drizzle-orm";
import type { Db } from "@track-forge/core";
import { schema } from "@track-forge/core";

export interface VersionRouteDeps {
  db: Db;
}

export function registerVersionRoutes(server: FastifyInstance, deps: VersionRouteDeps): void {
  const { db } = deps;

  // ── List versions for a job ──────────────────────────────────────────

  server.get("/api/jobs/:jobId/versions", async (req, reply) => {
    const { jobId } = req.params as { jobId: string };

    const [job] = await db
      .select()
      .from(schema.jobs)
      .where(eq(schema.jobs.id, jobId))
      .limit(1);

    if (!job) return reply.code(404).send({ error: "Job not found" });

    const rows = await db
      .select()
      .from(schema.versions)
      .where(eq(schema.versions.jobId, jobId))
      .orderBy(desc(schema.versions.number));

    return rows;
  });

  // ── Get version by ID ────────────────────────────────────────────────

  server.get("/api/versions/:id", async (req, reply) => {
    const { id } = req.params as { id: string };

    const [version] = await db
      .select()
      .from(schema.versions)
      .where(eq(schema.versions.id, id))
      .limit(1);

    if (!version) return reply.code(404).send({ error: "Version not found" });
    return version;
  });
}
