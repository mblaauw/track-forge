import Fastify from "fastify";
import pino from "pino";
import { initConfig } from "./lib/config.js";
import { initDb } from "./lib/db.js";
import { SunoClient, createSunoClientConfig, createLlmClient } from "@track-forge/core";
import { registerHealthRoutes } from "./routes/health.js";
import { registerJobRoutes } from "./routes/jobs.js";
import { registerVersionRoutes } from "./routes/versions.js";
import { registerSunoRoutes } from "./routes/suno.js";
import { registerEventRoutes } from "./routes/events.js";

const config = initConfig();
const logger = pino({ level: config.logLevel });
const db = initDb(config);
const sunoCfg = createSunoClientConfig(config);
const suno = new SunoClient(sunoCfg, config, logger.child({ module: "suno" }));
const llm = createLlmClient(config);

const server = Fastify({ logger });

registerHealthRoutes(server);
registerJobRoutes(server, { db, config, llm, suno });
registerVersionRoutes(server, { db });
registerSunoRoutes(server);
registerEventRoutes(server);

const start = async () => {
  try {
    await server.listen({ port: config.port, host: "0.0.0.0" });
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
