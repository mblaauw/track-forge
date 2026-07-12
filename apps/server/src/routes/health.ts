import type { FastifyInstance } from "fastify";

export function registerHealthRoutes(server: FastifyInstance): void {
  server.get("/health", async () => ({ status: "ok", timestamp: new Date().toISOString() }));
}
