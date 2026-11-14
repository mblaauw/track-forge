import type { FastifyInstance } from "fastify";
import type { Db } from "@track-forge/core";
import {
  subscribe,
  getJobEvents,
  formatSseEvent,
  type PipelineEvent,
} from "@track-forge/core";
import { validateParams, IdParams } from "../lib/validate.js";

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
    const { id } = validateParams(IdParams, req);
    const headers = req.headers;
    // Replay starts after the later of two cursors: `Last-Event-ID`, which
    // the browser sends when it reconnects, and `?after=`, which the client
    // sets to the cursor returned by POST /start so a fresh subscription
    // sees only that run's events (EventSource cannot set headers itself).
    const headerCursor = parseInt(String(headers["last-event-id"] ?? ""), 10);
    const queryCursor = parseInt(
      String((req.query as { after?: string }).after ?? ""),
      10,
    );
    const lastEventId = Math.max(
      Number.isFinite(headerCursor) ? headerCursor : 0,
      Number.isFinite(queryCursor) ? queryCursor : 0,
      0,
    );

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

    // ── Subscribe BEFORE history fetch (no race gap) ────────────────
    let isLive = false;
    const buffer: PipelineEvent[] = [];

    const pipeOrBuffer = (event: PipelineEvent) => {
      if (isLive) {
        sseWrite(reply.raw, formatSseEvent(event));
      } else {
        buffer.push(event);
      }
    };

    const unsubscribe = subscribe(id, pipeOrBuffer);

    let cleanup: (() => void) | null = null;
    const onClose = () => {
      if (cleanup) cleanup();
    };
    req.raw.on("close", onClose);

    // Replay history
    const historyEvents = await getJobEvents(db, id, {
      limit: 50,
      afterSequence: lastEventId,
    });

    if (req.raw.destroyed) {
      unsubscribe();
      req.raw.off("close", onClose);
      return;
    }

    for (const evt of historyEvents) {
      sseWrite(reply.raw, formatSseEvent(evt as unknown as PipelineEvent));
    }

    // Drain buffer — skip events already covered by history
    const maxHistorySeq =
      historyEvents.length > 0
        ? historyEvents[historyEvents.length - 1]!.sequence
        : lastEventId;
    for (const buffered of buffer) {
      if (buffered.sequence > maxHistorySeq) {
        sseWrite(reply.raw, formatSseEvent(buffered));
      }
    }

    // Switch to live piping
    isLive = true;

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
    const { id } = validateParams(IdParams, req);
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
