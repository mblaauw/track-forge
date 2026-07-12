import type { FastifyInstance } from "fastify";
import { eq, desc, and } from "drizzle-orm";
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

  // ── Promote version to final ─────────────────────────────────────────

  server.post("/api/versions/:id/promote", async (req, reply) => {
    const { id } = req.params as { id: string };

    const [version] = await db
      .select()
      .from(schema.versions)
      .where(eq(schema.versions.id, id))
      .limit(1);

    if (!version) return reply.code(404).send({ error: "Version not found" });
    if (version.status === "final") {
      return reply.code(400).send({ error: "Version is already finalized" });
    }

    const now = new Date().toISOString();
    await db
      .update(schema.versions)
      .set({ status: "final", finalizedAt: now })
      .where(eq(schema.versions.id, id));

    const [updated] = await db
      .select()
      .from(schema.versions)
      .where(eq(schema.versions.id, id))
      .limit(1);

    return reply.code(200).send(updated);
  });

  // ── Rollback: create new version from previous version's artifacts ───

  server.post("/api/jobs/:jobId/versions/:versionId/rollback", async (req, reply) => {
    const { jobId, versionId } = req.params as { jobId: string; versionId: string };

    const [job] = await db
      .select()
      .from(schema.jobs)
      .where(eq(schema.jobs.id, jobId))
      .limit(1);

    if (!job) return reply.code(404).send({ error: "Job not found" });

    const [sourceVersion] = await db
      .select()
      .from(schema.versions)
      .where(eq(schema.versions.id, versionId))
      .limit(1);

    if (!sourceVersion) return reply.code(404).send({ error: "Source version not found" });

    const [maxVersion] = await db
      .select({ maxNumber: schema.versions.number })
      .from(schema.versions)
      .where(eq(schema.versions.jobId, jobId as string))
      .orderBy(desc(schema.versions.number))
      .limit(1);

    const nextNumber = (maxVersion?.maxNumber ?? 0) + 1;
    const newId = crypto.randomUUID();
    const now = new Date().toISOString();

    await db.insert(schema.versions).values({
      id: newId,
      jobId: jobId as string,
      status: "draft",
      number: nextNumber,
      artifacts: sourceVersion.artifacts,
      parentVersionId: versionId,
      createdAt: now,
    });

    const [created] = await db
      .select()
      .from(schema.versions)
      .where(eq(schema.versions.id, newId))
      .limit(1);

    return reply.code(201).send(created);
  });

  // ── Version tree ─────────────────────────────────────────────────────

  server.get("/api/jobs/:jobId/versions/tree", async (req, reply) => {
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
      .orderBy(schema.versions.number);

    const versionMap = new Map<string, typeof rows[0]>();
    const roots: typeof rows = [];

    for (const v of rows) {
      versionMap.set(v.id, v);
      if (!v.parentVersionId) {
        roots.push(v);
      }
    }

    function buildTree(parentId: string | null): unknown[] {
      return rows
        .filter((v) => v.parentVersionId === parentId)
        .map((v) => ({
          ...v,
          children: buildTree(v.id),
        }));
    }

    return buildTree(null);
  });
}
