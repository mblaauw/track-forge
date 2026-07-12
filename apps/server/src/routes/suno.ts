import type { FastifyInstance } from "fastify";

/**
 * Suno webhook callback handler.
 *
 * Receives generation completion callbacks from Suno API.
 * The body contains generation status and results.
 * Currently logs and acknowledges — future versions will
 * update job/version records automatically.
 */
export function registerSunoRoutes(server: FastifyInstance): void {
  server.post("/api/suno/callback", async (req, reply) => {
    const body = req.body as Record<string, unknown>;
    const generationId = body.id ?? body.generation_id;

    req.log.info({ generationId, status: body.status }, "Suno callback received");

    // Acknowledge receipt
    return reply.code(200).send({ received: true });
  });
}
