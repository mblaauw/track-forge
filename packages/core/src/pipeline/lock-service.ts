import { eq, sql } from "drizzle-orm";
import type { Db } from "../db/index.js";
import { schema, getSqlite } from "../db/index.js";

const DEFAULT_TTL_MS = 300_000; // 5 min lease

export function createLockService(db: Db) {
  function lockKey(versionId: string, artifactType: string): string {
    return `${versionId}:${artifactType}`;
  }

  function acquireLock(
    versionId: string,
    artifactType: string,
    owner: string,
    ttlMs: number = DEFAULT_TTL_MS,
  ): boolean {
    const key = lockKey(versionId, artifactType);
    const now = Date.now();
    const sqlite = getSqlite(db);

    return sqlite.transaction(() => {
      const existing = sqlite
        .prepare("SELECT * FROM artifact_locks WHERE id = ?")
        .get(key) as
        { id: string; expiresAt: string; lockedBy: string } | undefined;

      if (existing) {
        const expiresAt = new Date(existing.expiresAt).getTime();
        if (expiresAt > now && existing.lockedBy !== owner) return false;

        sqlite
          .prepare(
            "UPDATE artifact_locks SET locked_by = ?, acquired_at = ?, expires_at = ? WHERE id = ?",
          )
          .run(
            owner,
            new Date(now).toISOString(),
            new Date(now + ttlMs).toISOString(),
            key,
          );

        return true;
      }

      sqlite
        .prepare(
          "INSERT INTO artifact_locks (id, version_id, artifact_type, locked_by, acquired_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .run(
          key,
          versionId,
          artifactType,
          owner,
          new Date(now).toISOString(),
          new Date(now + ttlMs).toISOString(),
        );

      return true;
    })() as boolean;
  }

  async function releaseLock(
    versionId: string,
    artifactType: string,
  ): Promise<void> {
    const key = lockKey(versionId, artifactType);
    await db
      .delete(schema.artifactLocks)
      .where(eq(schema.artifactLocks.id, key));
  }

  async function cleanExpiredLocks(): Promise<number> {
    const now = new Date().toISOString();
    const result = await db
      .delete(schema.artifactLocks)
      .where(sql`expires_at < ${now}`);

    return result.changes ?? 0;
  }

  return {
    acquireLock,
    releaseLock,
    cleanExpiredLocks,
  };
}

export type LockService = ReturnType<typeof createLockService>;
