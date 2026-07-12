import Fastify from "fastify";
import pino from "pino";
import { existsSync, readFileSync } from "node:fs";
import { resolve, extname } from "node:path";
import { initConfig } from "./lib/config.js";
import { initDb } from "./lib/db.js";
import { SunoClient, createSunoClientConfig, createLlmClient, createLockService } from "@track-forge/core";
import { registerHealthRoutes } from "./routes/health.js";
import { registerJobRoutes } from "./routes/jobs.js";
import { registerVersionRoutes } from "./routes/versions.js";
import { registerSunoRoutes } from "./routes/suno.js";
import { registerProjectRoutes } from "./routes/projects.js";
import { registerEventRoutes } from "./routes/events.js";
import { registerImportExportRoutes } from "./routes/import-export.js";

const config = initConfig();
const logger = pino({ level: config.logLevel });
const db = initDb(config);
const sunoCfg = createSunoClientConfig(config);
const suno = new SunoClient(sunoCfg, config, logger.child({ module: "suno" }));
const llm = createLlmClient(config);

const server = Fastify({ logger });
const lockService = createLockService(db);

// ── Periodic lock cleanup ──────────────────────────────────────────

const LOCK_CLEANUP_INTERVAL = 30_000;
const cleanupTimer = setInterval(() => {
  lockService.cleanExpiredLocks().catch(() => {});
}, LOCK_CLEANUP_INTERVAL);

registerHealthRoutes(server);
registerProjectRoutes(server, { db, config });
registerJobRoutes(server, { db, config, llm, suno });
registerVersionRoutes(server, { db, lockService });
registerSunoRoutes(server, { db, suno });
registerEventRoutes(server, { db });
registerImportExportRoutes(server, { db });

const start = async () => {
  try {
    const host = config.host || "127.0.0.1";
    if (host === "0.0.0.0") {
      logger.warn("Binding to 0.0.0.0 — accessible from all network interfaces. For dev safety, set host to 127.0.0.1");
    }
    await server.listen({ port: config.port, host });
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

// ── Static GUI serving (production) ─────────────────────────────────

if (config.staticDir) {
  const staticPath = resolve(config.staticDir);
  if (!existsSync(staticPath)) {
    logger.warn({ staticDir: config.staticDir }, "Static dir not found — GUI won't be served");
  } else {
    const MIME: Record<string, string> = {
      ".html": "text/html; charset=utf-8",
      ".js": "application/javascript",
      ".css": "text/css",
      ".png": "image/png",
      ".svg": "image/svg+xml",
      ".ico": "image/x-icon",
      ".json": "application/json",
      ".woff2": "font/woff2",
    };

    server.get("/*", async (req, reply) => {
      // Normalize path, default to index.html for SPA
      let url = new URL(req.url, "http://localhost").pathname;
      if (url === "/" || !extname(url)) url = "/index.html";
      const filePath = resolve(staticPath, "." + url);

      // Security: ensure resolved path stays within staticDir
      if (!filePath.startsWith(staticPath)) {
        return reply.code(403).send("Forbidden");
      }

      if (!existsSync(filePath)) {
        // SPA fallback — serve index.html
        const index = resolve(staticPath, "index.html");
        if (!existsSync(index)) return reply.code(404).send("Not found");
        const content = readFileSync(index, "utf-8");
        return reply.type("text/html; charset=utf-8").send(content);
      }

      const ext = extname(filePath);
      const type = MIME[ext] ?? "application/octet-stream";
      const content = readFileSync(filePath);
      return reply.type(type).send(content);
    });

    logger.info({ staticDir: staticPath }, "Serving static GUI");
  }
}

start();
