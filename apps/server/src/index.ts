import Fastify from "fastify";
import pino from "pino";
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
registerEventRoutes(server);
registerImportExportRoutes(server, { db });

const start = async () => {
  try {
    await server.listen({ port: config.port, host: "0.0.0.0" });
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
