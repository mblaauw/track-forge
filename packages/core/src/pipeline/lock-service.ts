import { eq, sql } from "drizzle-orm";
import type { Db } from "../db/index.js";
import { schema } from "../db/index.js";

const DEFAULT_TTL_MS = 300_000; // 5 min lease

export function createLockService(db: Db) {
  function lockKey(versionId: string, artifactType: string): string {
    return `${versionId}:${artifactType}`;
  }

  async function acquireLock(
    versionId: string,
    artifactType: string,
    owner: string,
    ttlMs: number = DEFAULT_TTL_MS,
  ): Promise<boolean> {
    const key = lockKey(versionId, artifactType);
    const now = Date.now();

    const existing = await db
      .select()
      .from(schema.artifactLocks)
      .where(eq(schema.artifactLocks.id, key))
      .limit(1);

    if (existing.length > 0) {
      const lock = existing[0]!;
      const expiresAt = new Date(lock.expiresAt).getTime();
      if (expiresAt > now && lock.lockedBy !== owner) return false;

      await db
        .update(schema.artifactLocks)
        .set({
          lockedBy: owner,
          acquiredAt: new Date(now).toISOString(),
          expiresAt: new Date(now + ttlMs).toISOString(),
        })
        .where(eq(schema.artifactLocks.id, key));

      return true;
    }

    await db.insert(schema.artifactLocks).values({
      id: key,
      versionId,
      artifactType,
      lockedBy: owner,
      acquiredAt: new Date(now).toISOString(),
      expiresAt: new Date(now + ttlMs).toISOString(),
    });

    return true;
  }

  async function releaseLock(versionId: string, artifactType: string): Promise<void> {
    const key = lockKey(versionId, artifactType);
    await db.delete(schema.artifactLocks).where(eq(schema.artifactLocks.id, key));
  }

  async function renewLock(
    versionId: string,
    artifactType: string,
    owner: string,
    ttlMs: number = DEFAULT_TTL_MS,
  ): Promise<boolean> {
    const key = lockKey(versionId, artifactType);

    const existing = await db
      .select()
      .from(schema.artifactLocks)
      .where(eq(schema.artifactLocks.id, key))
      .limit(1);

    const lock = existing[0];
    if (!lock || lock.lockedBy !== owner) return false;

    const now = new Date();
    await db
      .update(schema.artifactLocks)
      .set({ expiresAt: new Date(now.getTime() + ttlMs).toISOString() })
      .where(eq(schema.artifactLocks.id, key));

    return true;
  }

  async function cleanExpiredLocks(): Promise<number> {
    const now = new Date().toISOString();
    const result = await db
      .delete(schema.artifactLocks)
      .where(sql`expires_at < ${now}`);

    return result.changes ?? 0;
  }

  /**
   * Start a heartbeat loop that renews a lock every `intervalMs`.
   * Returns an `unsubscribe` function to stop the loop.
   */
  function startHeartbeat(
    versionId: string,
    artifactType: string,
    owner: string,
    intervalMs = DEFAULT_TTL_MS / 3,
  ): () => void {
    const key = lockKey(versionId, artifactType);
    const timer = setInterval(() => {
      renewLock(versionId, artifactType, owner).catch(() => {
        clearInterval(timer);
      });
    }, intervalMs);
    return () => clearInterval(timer);
  }

  return { acquireLock, releaseLock, renewLock, cleanExpiredLocks, startHeartbeat };
}

export type LockService = ReturnType<typeof createLockService>;
