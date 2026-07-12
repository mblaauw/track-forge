import type { FastifyInstance } from "fastify";
import { subscribe, type PipelineEvent } from "@track-forge/core";

export function registerEventRoutes(server: FastifyInstance): void {
  // ── SSE: Job progress events ────────────────────────────────────────

  server.get("/api/jobs/:id/events", async (req, reply) => {
    const { id } = req.params as { id: string };

    // SSE headers
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    // Send initial connected event
    reply.raw.write(`event: connected\ndata: ${JSON.stringify({ jobId: id })}\n\n`);

    // Subscribe to pipeline events
    const unsubscribe = subscribe(id, (event: PipelineEvent) => {
      const data = JSON.stringify(event);
      reply.raw.write(`event: progress\ndata: ${data}\n\n`);
    });

    // Keep alive ping every 15s
    const keepAlive = setInterval(() => {
      reply.raw.write(": keepalive\n\n");
    }, 15000);

    // Cleanup on disconnect
    req.raw.on("close", () => {
      unsubscribe();
      clearInterval(keepAlive);
    });
  });
}
