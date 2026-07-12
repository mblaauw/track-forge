import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Config } from "@track-forge/contracts";
import { ConfigSchema } from "@track-forge/contracts";

const CONFIG_FILENAME = "track-forge.config.js";

/**
 * Load config from CWD/track-forge.config.js with env overrides.
 * Config file is gitignored, server-only.
 * Env vars take precedence:
 *   TRACK_FORGE_SUNO_BASE_URL
 *   TRACK_FORGE_SUNO_AUTH_TOKEN
 *   TRACK_FORGE_PUBLIC_BASE_URL
 *   TRACK_FORGE_DB_PATH
 *   TRACK_FORGE_LOG_LEVEL
 *   TRACK_FORGE_PORT
 *   TRACK_FORGE_HOST
 *   TRACK_FORGE_STATIC_DIR
 *   TRACK_FORGE_LLM_PROVIDER
 *   TRACK_FORGE_LLM_API_KEY
 *   TRACK_FORGE_LLM_MODEL
 */
export function loadConfig(cwd = process.cwd()): Config {
  const configPath = resolve(cwd, CONFIG_FILENAME);
  let fileConfig: Record<string, unknown> = {};

  if (existsSync(configPath)) {
    // Dynamic import of JS config file (must be ESM-compatible)
    // Using require in CJS or import() for ESM — we use readFile + eval
    // since the config is a plain JS object export in an ESM project.
    // We load it synchronously via a dynamic import workaround:
    fileConfig = readConfigFileSync(configPath);
  }

  const merged = {
    ...fileConfig,
    sunoBaseUrl: envStr("TRACK_FORGE_SUNO_BASE_URL") ?? fileConfig.sunoBaseUrl,
    sunoAuthToken: envStr("TRACK_FORGE_SUNO_AUTH_TOKEN") ?? fileConfig.sunoAuthToken,
    publicBaseUrl: envStr("TRACK_FORGE_PUBLIC_BASE_URL") ?? fileConfig.publicBaseUrl,
    dbPath: envStr("TRACK_FORGE_DB_PATH") ?? fileConfig.dbPath,
    logLevel: envStr("TRACK_FORGE_LOG_LEVEL") ?? fileConfig.logLevel,
    port: envInt("TRACK_FORGE_PORT") ?? fileConfig.port,
    host: envStr("TRACK_FORGE_HOST") ?? fileConfig.host,
    staticDir: envStr("TRACK_FORGE_STATIC_DIR") ?? fileConfig.staticDir,
    llmProvider: envStr("TRACK_FORGE_LLM_PROVIDER") ?? fileConfig.llmProvider,
    llmApiKey: envStr("TRACK_FORGE_LLM_API_KEY") ?? fileConfig.llmApiKey,
    llmModel: envStr("TRACK_FORGE_LLM_MODEL") ?? fileConfig.llmModel,
  };

  return ConfigSchema.parse(merged);
}

function envStr(key: string): string | undefined {
  return process.env[key] ?? undefined;
}

function envInt(key: string): number | undefined {
  const v = process.env[key];
  if (v === undefined) return undefined;
  const n = Number.parseInt(v, 10);
  return Number.isNaN(n) ? undefined : n;
}

/**
 * Read an ESM config file synchronously using dynamic import workaround.
 * The config file exports a default object: `export default { ... }`.
 */
function readConfigFileSync(path: string): Record<string, unknown> {
  const code = readFileSync(path, "utf-8");
  // Strip ESM export for synchronous eval
  const stripped = code
    .replace(/^export\s+default\s+/, "return ")
    .replace(/;\s*$/, "");
  const fn = new Function(stripped);
  const result = fn();
  if (typeof result !== "object" || result === null) {
    return {};
  }
  return result as Record<string, unknown>;
}
