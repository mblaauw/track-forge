import type { FastifyInstance } from "fastify";
import { eq, desc } from "drizzle-orm";
import type { Db } from "@track-forge/core";
import { schema } from "@track-forge/core";

export interface VersionRouteDeps {
  db: Db;
}

// ── In-memory lock store ─────────────────────────────────────────────

interface ArtifactLock {
  artifactType: string;
  lockedAt: string;
}

const locks = new Map<string, ArtifactLock>();

function lockKey(versionId: string, artifactType: string): string {
  return `${versionId}:${artifactType}`;
}

function acquireLock(versionId: string, artifactType: string): boolean {
  const key = lockKey(versionId, artifactType);
  if (locks.has(key)) return false;
  locks.set(key, { artifactType, lockedAt: new Date().toISOString() });
  return true;
}

function releaseLock(versionId: string, artifactType: string): void {
  locks.delete(lockKey(versionId, artifactType));
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

  // ── Update artifact (with lock) ──────────────────────────────────────

  server.patch("/api/versions/:id/artifacts", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as { artifactType: string; value: string } | undefined;

    if (!body?.artifactType || body.value === undefined) {
      return reply.code(400).send({ error: "artifactType and value required" });
    }

    const [version] = await db
      .select()
      .from(schema.versions)
      .where(eq(schema.versions.id, id))
      .limit(1);

    if (!version) return reply.code(404).send({ error: "Version not found" });
    if (version.status === "final") {
      return reply.code(400).send({ error: "Cannot edit a finalized version" });
    }

    // Try to acquire lock
    if (!acquireLock(id, body.artifactType)) {
      return reply.code(423).send({ error: `Artifact "${body.artifactType}" is locked` });
    }

    try {
      const artifacts = JSON.parse(version.artifacts) as Array<{ type: string; value: string; versionId?: string }>;
      const idx = artifacts.findIndex((a) => a.type === body.artifactType);
      if (idx === -1) {
        artifacts.push({ type: body.artifactType, value: body.value });
      } else {
        const prev = artifacts[idx] as { type: string; value: string; versionId?: string } | undefined;
        artifacts[idx] = { type: body.artifactType, value: body.value, versionId: prev?.versionId };
      }

      const now = new Date().toISOString();
      await db
        .update(schema.versions)
        .set({ artifacts: JSON.stringify(artifacts) })
        .where(eq(schema.versions.id, id));

      const [updated] = await db
        .select()
        .from(schema.versions)
        .where(eq(schema.versions.id, id))
        .limit(1);

      return reply.code(200).send(updated);
    } finally {
      releaseLock(id, body.artifactType);
    }
  });
}
