import type { FastifyInstance } from "fastify";
import type { Db } from "@track-forge/core";
import { subscribe, getJobEvents, type PipelineEvent } from "@track-forge/core";

function sseWrite(reply: import("http").ServerResponse, data: string): void {
  try {
    reply.write(data);
  } catch {
    /* client disconnected — ignore */
  }
}

export function registerEventRoutes(
  server: FastifyInstance,
  deps: { db: Db },
): void {
  const { db } = deps;

  // ── SSE: Job progress events (with history replay) ──────────────────

  server.get("/api/jobs/:id/events", async (req, reply) => {
    const { id } = req.params as { id: string };
    const headers = req.headers;
    const lastEventId = headers["last-event-id"]
      ? parseInt(headers["last-event-id"] as string, 10)
      : 0;

    // SSE headers
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    // Send initial connected event
    sseWrite(
      reply.raw,
      `event: connected\ndata: ${JSON.stringify({ jobId: id })}\n\n`,
    );

    // ── Register cleanup BEFORE any async work ───────────────────────
    let cleanup: (() => void) | null = null;
    const onClose = () => {
      if (cleanup) cleanup();
    };
    req.raw.on("close", onClose);

    // Replay history if Last-Event-ID is 0 (fresh connect) or specific (reconnect)
    const historyEvents = await getJobEvents(db, id, {
      limit: 50,
      afterSequence: lastEventId,
    });

    // If client disconnected during await, clean up and bail
    if (req.raw.destroyed) {
      req.raw.off("close", onClose);
      return;
    }

    for (const evt of historyEvents) {
      const data = JSON.stringify(evt);
      sseWrite(
        reply.raw,
        `id: ${evt.sequence}\nevent: progress\ndata: ${data}\n\n`,
      );
    }

    // Subscribe to live pipeline events
    const unsubscribe = subscribe(id, (event: PipelineEvent) => {
      const data = JSON.stringify(event);
      sseWrite(
        reply.raw,
        `id: ${event.sequence}\nevent: progress\ndata: ${data}\n\n`,
      );
    });

    // Keep alive ping every 15s
    const keepAlive = setInterval(() => {
      sseWrite(reply.raw, ": keepalive\n\n");
    }, 15000);

    cleanup = () => {
      unsubscribe();
      clearInterval(keepAlive);
    };
  });

  // ── History endpoint (paginated event log) ─────────────────────────

  server.get("/api/jobs/:id/events/history", async (req, reply) => {
    const { id } = req.params as { id: string };
    const query = req.query as {
      limit?: string;
      offset?: string;
      since?: string;
    };

    const limit = Math.min(parseInt(query.limit ?? "50", 10) || 50, 200);
    const offset = parseInt(query.offset ?? "0", 10) || 0;
    const since = query.since ? parseInt(query.since, 10) : 0;

    const events = await getJobEvents(db, id, {
      limit: limit + offset,
      afterSequence: since,
    });

    return reply.send(events.slice(offset));
  });
}
