import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadConfig } from "../src/config.js";

const ENV_KEYS = [
  "TRACK_FORGE_SUNO_BASE_URL",
  "TRACK_FORGE_SUNO_AUTH_TOKEN",
  "TRACK_FORGE_PUBLIC_BASE_URL",
  "TRACK_FORGE_DB_PATH",
  "TRACK_FORGE_LOG_LEVEL",
  "TRACK_FORGE_PORT",
  "TRACK_FORGE_HOST",
  "TRACK_FORGE_STATIC_DIR",
  "TRACK_FORGE_LLM_PROVIDER",
  "TRACK_FORGE_LLM_API_KEY",
  "TRACK_FORGE_LLM_BASE_URL",
  "TRACK_FORGE_LLM_MODEL",
] as const;

const saved: Record<string, string | undefined> = {};

function isolateEnv() {
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
}

function restoreEnv() {
  for (const k of ENV_KEYS) {
    if (saved[k] !== undefined) process.env[k] = saved[k];
    else delete process.env[k];
  }
}

describe("loadConfig", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "tf-config-test-"));
    isolateEnv();
  });

  afterEach(() => {
    restoreEnv();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns defaults when no config file exists and no env vars", () => {
    const cfg = loadConfig(tmpDir);
    expect(cfg.sunoBaseUrl).toBe("https://api.sunomusic.com");
    expect(cfg.dbPath).toBe("./data/track-forge.db");
    expect(cfg.port).toBe(3000);
  });

  it("reads values from config file", () => {
    writeFileSync(
      join(tmpDir, "track-forge.config.js"),
      `export default { port: 4000, logLevel: "debug" };`,
    );
    const cfg = loadConfig(tmpDir);
    expect(cfg.port).toBe(4000);
    expect(cfg.logLevel).toBe("debug");
  });

  it("env vars override config file", () => {
    process.env.TRACK_FORGE_PORT = "5000";
    process.env.TRACK_FORGE_LOG_LEVEL = "trace";

    writeFileSync(
      join(tmpDir, "track-forge.config.js"),
      `export default { port: 4000, logLevel: "debug" };`,
    );
    const cfg = loadConfig(tmpDir);
    expect(cfg.port).toBe(5000);
    expect(cfg.logLevel).toBe("trace");
  });

  it("accepts valid env overrides individually", () => {
    process.env.TRACK_FORGE_SUNO_BASE_URL = "https://override.example.com";
    const cfg = loadConfig(tmpDir);
    expect(cfg.sunoBaseUrl).toBe("https://override.example.com");
  });

  it("ignores invalid env int gracefully", () => {
    process.env.TRACK_FORGE_PORT = "abc";
    const cfg = loadConfig(tmpDir);
    expect(cfg.port).toBe(3000); // falls back to default
  });

  it("validates via ConfigSchema (rejects bad input)", () => {
    process.env.TRACK_FORGE_LOG_LEVEL = "bogus";
    expect(() => loadConfig(tmpDir)).toThrow();
  });
});
