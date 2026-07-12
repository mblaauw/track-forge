import { describe, it, expect } from "vitest";
import Fastify from "fastify";
import { registerHealthRoutes } from "../src/routes/health.js";

describe("Health route", () => {
  it("GET /health returns status ok", async () => {
    const server = Fastify();
    registerHealthRoutes(server);
    await server.ready();

    const res = await server.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.status).toBe("ok");
    expect(body.timestamp).toBeDefined();

    await server.close();
  });
});
