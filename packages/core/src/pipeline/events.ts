/**
 * In-memory event bus for pipeline progress.
 * Module-level singleton — subscriptions scoped per jobId.
 */

export interface PipelineEvent {
  jobId: string;
  stage: string;
  status: "started" | "completed" | "error";
  error?: string;
  timestamp: string;
}

type EventCallback = (event: PipelineEvent) => void;

const subscriptions = new Map<string, Set<EventCallback>>();

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

/** Publish an event for a job. */
export function publish(
  jobId: string,
  event: Omit<PipelineEvent, "jobId" | "timestamp">,
): void {
  const fullEvent: PipelineEvent = {
    jobId,
    timestamp: new Date().toISOString(),
    ...event,
  };
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
}

/** Remove all subscriptions for a job. */
export function unsubscribeAll(jobId: string): void {
  subscriptions.delete(jobId);
}
