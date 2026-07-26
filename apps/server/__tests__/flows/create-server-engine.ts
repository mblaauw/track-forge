/**
 * Creates a fully wired TestEngine with all server routes registered.
 *
 * Usage:
 *   const engine = await createServerEngine("my-test");
 *   const res = await engine.api.createJob({ genreId: "edm", presetId: "...", inputs: { ... } });
 *   await engine.cleanup();
 */

import {
  TestEngine,
  createMockLlm,
  createMockSuno,
} from "@track-forge/test-support";
import type { TestEngineInstance } from "@track-forge/test-support";
import type { Config } from "@track-forge/contracts";

import { registerHealthRoutes } from "../../src/routes/health.js";
import { registerJobRoutes } from "../../src/routes/jobs.js";
import { registerVersionRoutes } from "../../src/routes/versions.js";
import { registerSunoRoutes } from "../../src/routes/suno.js";
import { registerEventRoutes } from "../../src/routes/events.js";
import { registerImportExportRoutes } from "../../src/routes/import-export.js";
import { registerPreviewStyleRoutes } from "../../src/routes/preview-style.js";
import { registerLyricsRoutes } from "../../src/routes/lyrics.js";

export async function createServerEngine(
  name: string,
  configOverrides?: Partial<Config>,
): Promise<TestEngineInstance> {
  // Route handlers check SUNO_DRY_RUN at request time to skip real Suno calls
  process.env.SUNO_DRY_RUN = "true";
  const engine = TestEngine.create({ name, configOverrides });

  const llm = createMockLlm();
  const suno = createMockSuno() as any;

  registerHealthRoutes(engine.server);
  registerJobRoutes(engine.server, {
    db: engine.db,
    config: engine.config as Config,
    llm,
    suno,
  });
  registerVersionRoutes(engine.server, {
    db: engine.db,
    suno,
    config: engine.config as Config,
  });
  registerSunoRoutes(engine.server, {
    db: engine.db,
    suno,
    config: engine.config as Config,
  });
  registerEventRoutes(engine.server, { db: engine.db });
  registerImportExportRoutes(engine.server, { db: engine.db });
  registerPreviewStyleRoutes(engine.server, { db: engine.db });
  registerLyricsRoutes(engine.server, { db: engine.db, llm });

  await engine.ready();
  return engine;
}
