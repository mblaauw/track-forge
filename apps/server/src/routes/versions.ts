import type { FastifyInstance } from "fastify";
import { eq, desc, sql } from "drizzle-orm";
import type { Db, LockService } from "@track-forge/core";
import { schema } from "@track-forge/core";
import { findRowOr404 } from "../lib/db-utils.js";
import {
  validateBody,
  validateParams,
  IdParams,
  JobIdParams,
  UpdateArtifactsBody,
  CreateTakeBody,
} from "../lib/validate.js";

export interface VersionRouteDeps {
  db: Db;
  lockService: LockService;
}

export function registerVersionRoutes(
  server: FastifyInstance,
  deps: VersionRouteDeps,
): void {
  const { db, lockService } = deps;

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

  // ── Update artifact (with lock) ──────────────────────────────────────

  server.patch("/api/versions/:id/artifacts", async (req, reply) => {
    const { id } = validateParams(IdParams, req);
    const body = validateBody(UpdateArtifactsBody, req);

    const version = await findRowOr404(
      db,
      schema.versions,
      eq(schema.versions.id, id),
      "Version",
    );
    if (version.status === "final") {
      return reply.code(400).send({ error: "Cannot edit a finalized version" });
    }

    const owner = `server:${process.pid}`;
    const acquired = await lockService.acquireLock(
      id,
      body.artifactType,
      owner,
    );
    if (!acquired) {
      return reply
        .code(423)
        .send({ error: `Artifact "${body.artifactType}" is locked` });
    }

    try {
      let artifacts: Array<{ type: string; value: string; versionId?: string }>;
      try {
        artifacts = JSON.parse(version.artifacts);
      } catch {
        artifacts = [];
      }
      const idx = artifacts.findIndex((a) => a.type === body.artifactType);
      if (idx === -1) {
        artifacts.push({ type: body.artifactType, value: body.value });
      } else {
        const prev = artifacts[idx] as
          { type: string; value: string; versionId?: string } | undefined;
        artifacts[idx] = {
          type: body.artifactType,
          value: body.value,
          versionId: prev?.versionId,
        };
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
      await lockService.releaseLock(id, body.artifactType);
    }
  });

  // ── Promote version to final ─────────────────────────────────────────

  server.post("/api/versions/:id/promote", async (req, reply) => {
    const { id } = validateParams(IdParams, req);

    const version = await findRowOr404(
      db,
      schema.versions,
      eq(schema.versions.id, id),
      "Version",
    );
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

  server.post(
    "/api/jobs/:jobId/versions/:versionId/rollback",
    async (req, reply) => {
      const { jobId, versionId } = req.params as {
        jobId: string;
        versionId: string;
      };

      const job = await findRowOr404(
        db,
        schema.jobs,
        eq(schema.jobs.id, jobId),
        "Job",
      );

      const sourceVersion = await findRowOr404(
        db,
        schema.versions,
        eq(schema.versions.id, versionId),
        "Source version",
      );

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
    },
  );

  // ── Version tree ─────────────────────────────────────────────────────

  server.get("/api/jobs/:jobId/versions/tree", async (req, reply) => {
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
      .orderBy(schema.versions.number);

    const childrenMap = new Map<string | null, typeof rows>();

    for (const v of rows) {
      const parentKey = v.parentVersionId ?? null;
      if (!childrenMap.has(parentKey)) {
        childrenMap.set(parentKey, []);
      }
      childrenMap.get(parentKey)!.push(v);
    }

    function buildTree(parentId: string | null): unknown[] {
      const children = childrenMap.get(parentId) ?? [];
      return children.map((v) => ({
        ...v,
        children: buildTree(v.id),
      }));
    }

    return buildTree(null);
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

    const now = new Date().toISOString();
    const genId = crypto.randomUUID();

    await db.insert(schema.generations).values({
      id: genId,
      jobId: version.jobId,
      versionId: id,
      status: "queued",
      createdAt: now,
      updatedAt: now,
    });

    const [created] = await db
      .select()
      .from(schema.generations)
      .where(eq(schema.generations.id, genId))
      .limit(1);

    return reply.code(201).send(created);
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
