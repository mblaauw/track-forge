import Fastify from "fastify";
import pino from "pino";
import { existsSync, readFileSync } from "node:fs";
import { resolve, extname, sep } from "node:path";
import { initConfig } from "./lib/config.js";
import { initDb } from "./lib/db.js";
import {
  SunoClient,
  createSunoClientConfig,
  createLlmClient,
} from "@track-forge/core";
import { registerHealthRoutes } from "./routes/health.js";
import { registerJobRoutes } from "./routes/jobs.js";
import { registerVersionRoutes } from "./routes/versions.js";
import { registerSunoRoutes } from "./routes/suno.js";
import { registerEventRoutes } from "./routes/events.js";
import { registerImportExportRoutes } from "./routes/import-export.js";
import { registerPreviewStyleRoutes } from "./routes/preview-style.js";
import { registerLyricsRoutes } from "./routes/lyrics.js";
import { ApiError } from "./lib/db-utils.js";
import { getSqlite } from "@track-forge/core";
import { validateGenreConfigs } from "./lib/modules.js";

const config = initConfig();
const logger = pino({ level: config.logLevel });
const db = initDb(config);
const sunoCfg = createSunoClientConfig(config);
const suno = new SunoClient(sunoCfg, config, logger.child({ module: "suno" }));
const llm = createLlmClient(config, logger.child({ module: "llm" }));

const server = Fastify({ logger: { level: config.logLevel } });

server.setErrorHandler((error: unknown, _request, reply) => {
  if (error instanceof ApiError) {
    return reply.code(error.statusCode).send({ error: error.message });
  }
  const fastifyErr = error as {
    validation?: unknown[];
    statusCode?: number;
    message?: string;
  };
  if (fastifyErr.validation) {
    return reply
      .code(400)
      .send({ error: "Validation error", details: fastifyErr.validation });
  }
  const status = fastifyErr.statusCode ?? 500;
  return reply
    .code(status)
    .send({ error: fastifyErr.message ?? "Internal server error" });
});

if (config.logLevel !== "fatal") {
  validateGenreConfigs({ warn: (msg) => logger.warn(msg) });
}

registerHealthRoutes(server);
registerJobRoutes(server, { db, config, llm, suno });
registerVersionRoutes(server, { db, suno, config });
registerSunoRoutes(server, { db, suno, config });
registerEventRoutes(server, { db });
registerImportExportRoutes(server, { db });
registerPreviewStyleRoutes(server, { db });
registerLyricsRoutes(server, { db, llm });

// ── Startup sweep: reset jobs stuck in_progress after crash ──────────
const sqlite = getSqlite(db);
const stuck = sqlite
  .prepare("SELECT COUNT(*) AS cnt FROM jobs WHERE status = 'in_progress'")
  .get() as { cnt: number } | undefined;
if (stuck && stuck.cnt > 0) {
  const now = new Date().toISOString();
  sqlite
    .prepare(
      "UPDATE jobs SET status = 'failed', error = 'Interrupted by server restart', updated_at = ? WHERE status = 'in_progress'",
    )
    .run(now);
  logger.warn(
    { count: stuck.cnt },
    "Reset stuck in_progress jobs after restart",
  );
}

const start = async () => {
  try {
    const host = config.host || "127.0.0.1";
    if (host === "0.0.0.0") {
      logger.warn(
        "Binding to 0.0.0.0 — accessible from all network interfaces. For dev safety, set host to 127.0.0.1",
      );
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
    logger.warn(
      { staticDir: config.staticDir },
      "Static dir not found — GUI won't be served",
    );
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
      const prefix = staticPath + sep;
      if (!filePath.startsWith(prefix)) {
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

// ── Graceful shutdown ────────────────────────────────────────────────

function shutdown(signal: string) {
  logger.info({ signal }, "Shutting down");
  server.close().catch(() => {});
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  logger.error({ err: reason }, "Unhandled promise rejection — continuing");
});
process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "Uncaught exception — shutting down");
  shutdown("uncaughtException");
});
