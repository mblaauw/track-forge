import type { Db } from "../db/index.js";
import { schema } from "../db/index.js";
import { eq, desc, lt, sql } from "drizzle-orm";
import type { JobEvent, GenerationStage } from "@track-forge/contracts";
import { randomUUID } from "node:crypto";

// ── Public interfaces ──────────────────────────────────────────────────

export interface PipelineEvent {
  jobId: string;
  sequence: number;
  stage: string;
  status: "started" | "completed" | "error" | "cancelled";
  error?: string;
  timestamp: string;
}

type EventCallback = (event: PipelineEvent) => void;

// ── In-memory subscriptions (live delivery) ────────────────────────────

const subscriptions = new Map<string, Set<EventCallback>>();

const EVENT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/** Module-level sequence counter for no-DB mode (testing). */
let seqCounter = 0;

/** Subscribe to events for a job. Returns unsubscribe function. */
export function subscribe(jobId: string, cb: EventCallback): () => void {
  if (!subscriptions.has(jobId)) {
    subscriptions.set(jobId, new Set());
  }
  subscriptions.get(jobId)!.add(cb);
  return () => {
    subscriptions.get(jobId)?.delete(cb);
    if (subscriptions.get(jobId)?.size === 0) {
      subscriptions.delete(jobId);
    }
  };
}

/**
 * Publish a pipeline event — persists to DB (if db provided) and dispatches to in-memory subscribers.
 */
export async function publish(
  db: Db | undefined,
  jobId: string,
  event: Omit<PipelineEvent, "jobId" | "timestamp" | "sequence">,
): Promise<PipelineEvent> {
  const timestamp = new Date().toISOString();
  let nextSeq = 1;

  if (db) {
    const maxSeq = await db
      .select({ max: sql<number>`COALESCE(MAX(sequence), 0)` })
      .from(schema.jobEvents)
      .where(eq(schema.jobEvents.jobId, jobId));

    nextSeq = (maxSeq[0]?.max ?? 0) + 1;

    await db.insert(schema.jobEvents).values({
      id: randomUUID(),
      jobId,
      sequence: nextSeq,
      stage: event.stage ?? null,
      status: event.status,
      data: null,
      error: event.error ?? null,
      timestamp,
    });
  } else {
    // No DB — use a module-local counter for sequence
    nextSeq = ++seqCounter;
  }

  const fullEvent: PipelineEvent = {
    jobId,
    sequence: nextSeq,
    timestamp,
    ...event,
  };

  // Dispatch to in-memory subscribers
  const subs = subscriptions.get(jobId);
  if (subs) {
    for (const cb of subs) {
      try {
        cb(fullEvent);
      } catch {
        // Swallow callback errors
      }
    }
  }

  return fullEvent;
}

/** Get recent events for a job (for replay). */
export async function getJobEvents(
  db: Db,
  jobId: string,
  options?: { limit?: number; afterSequence?: number },
): Promise<JobEvent[]> {
  const limit = options?.limit ?? 50;
  const afterSequence = options?.afterSequence ?? 0;

  const query = db
    .select()
    .from(schema.jobEvents)
    .where(eq(schema.jobEvents.jobId, jobId))
    .orderBy(desc(schema.jobEvents.sequence))
    .limit(limit);

  const rows = afterSequence > 0
    ? await db
        .select()
        .from(schema.jobEvents)
        .where(
          sql`${schema.jobEvents.jobId} = ${jobId} AND ${schema.jobEvents.sequence} > ${afterSequence}`,
        )
        .orderBy(schema.jobEvents.sequence)
    : await query;

  // Reverse to chronological order
  return rows.reverse() as unknown as JobEvent[];
}

/** Remove all in-memory subscriptions for a job. */
export function unsubscribeAll(jobId: string): void {
  subscriptions.delete(jobId);
}

/** Reset internal counters (for testing). */
export function resetTestCounters(): void {
  seqCounter = 0;
}
