/**
 * Structured test logger — writes JSONL to file + color console.
 *
 * Each test gets its own log file at data/test-logs/<test-name>-<timestamp>.jsonl.
 * Console output uses colored level prefixes for at-a-glance reading.
 */

import { mkdirSync, appendFileSync } from "node:fs";
import { join, resolve } from "node:path";

// ── Level helpers ────────────────────────────────────────────────────────────

const LEVELS = ["trace", "debug", "info", "warn", "error", "fatal"] as const;
type Level = (typeof LEVELS)[number];

const LEVEL_COLORS: Record<Level, string> = {
  trace: "\x1b[90m", // grey
  debug: "\x1b[36m", // cyan
  info: "\x1b[32m", // green
  warn: "\x1b[33m", // yellow
  error: "\x1b[31m", // red
  fatal: "\x1b[35m", // magenta
};
const RESET = "\x1b[0m";

// ── Logger class ─────────────────────────────────────────────────────────────

export interface TestLoggerConfig {
  /** Test name (used for filename) */
  name: string;
  /** Log directory (default: data/test-logs) */
  dir?: string;
  /** Minimum level to write to console */
  consoleLevel?: Level;
  /** Minimum level to write to file */
  fileLevel?: Level;
}

export class TestLogger {
  private path: string;
  private consoleLevel: Level;
  private fileLevel: Level;
  private startTime: number;
  private entryCount = 0;

  constructor(config: TestLoggerConfig) {
    const dir = resolve(config.dir ?? "data/test-logs");
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    this.path = join(dir, `${config.name}-${ts}.jsonl`);
    this.consoleLevel = config.consoleLevel ?? "debug";
    this.fileLevel = config.fileLevel ?? "trace";
    this.startTime = Date.now();

    mkdirSync(dir, { recursive: true });

    this.writeEntry("logger", "trace", { message: "Logger initialized" });
  }

  // ── Public API ──────────────────────────────────────────────────────────

  trace(msg: string, data?: Record<string, unknown>): void {
    this.writeEntry("logger", "trace", { message: msg, ...data });
  }

  debug(msg: string, data?: Record<string, unknown>): void {
    this.writeEntry("logger", "debug", { message: msg, ...data });
  }

  info(msg: string, data?: Record<string, unknown>): void {
    this.writeEntry("logger", "info", { message: msg, ...data });
  }

  warn(msg: string, data?: Record<string, unknown>): void {
    this.writeEntry("logger", "warn", { message: msg, ...data });
  }

  error(msg: string, data?: Record<string, unknown>): void {
    this.writeEntry("logger", "error", { message: msg, ...data });
  }

  /** Log an API request (to be sent) */
  request(method: string, url: string, body?: unknown): void {
    this.writeEntry("api", "info", {
      direction: "request",
      method,
      url,
      body: body !== undefined ? this.truncate(body) : undefined,
    });
  }

  /** Log an API response (received) */
  response(
    method: string,
    url: string,
    status: number,
    body?: unknown,
    durationMs?: number,
  ): void {
    const level: Level = status >= 400 ? "warn" : "info";
    this.writeEntry("api", level, {
      direction: "response",
      method,
      url,
      status,
      body: body !== undefined ? this.truncate(body) : undefined,
      durationMs,
    });
  }

  /** Log a stage transition in the pipeline */
  stageTransition(
    stage: string,
    status: string,
    data?: Record<string, unknown>,
  ): void {
    this.writeEntry("pipeline", "info", {
      stage,
      status,
      ...data,
    });
  }

  /** Get the log file path */
  getLogPath(): string {
    return this.path;
  }

  /** Total entries written */
  getEntryCount(): number {
    return this.entryCount;
  }

  /** Elapsed milliseconds since creation */
  elapsed(): number {
    return Date.now() - this.startTime;
  }

  // ── Internal ────────────────────────────────────────────────────────────

  private shouldLog(level: Level, minLevel: Level): boolean {
    return LEVELS.indexOf(level) >= LEVELS.indexOf(minLevel);
  }

  private writeEntry(
    source: string,
    level: Level,
    data: Record<string, unknown>,
  ): void {
    this.entryCount++;
    const elapsed = Date.now() - this.startTime;
    const entry = {
      ts: new Date().toISOString(),
      elapsed,
      source,
      level,
      ...data,
    };

    // Console
    if (this.shouldLog(level, this.consoleLevel)) {
      const color = LEVEL_COLORS[level];
      const prefix = `${color}${level.toUpperCase().padEnd(5)}${RESET}`;
      const label = data.message ?? "";
      console.log(`${prefix} [${source}] ${label}`);
    }

    // File
    if (this.shouldLog(level, this.fileLevel)) {
      try {
        appendFileSync(this.path, JSON.stringify(entry) + "\n", "utf-8");
      } catch {
        // If file write fails, fall back to console error
        console.error("Failed to write log entry:", entry);
      }
    }
  }

  /** Truncate large objects for console readability */
  private truncate(obj: unknown): unknown {
    if (typeof obj === "string") {
      return obj.length > 2000 ? obj.slice(0, 2000) + "…" : obj;
    }
    if (obj && typeof obj === "object") {
      const str = JSON.stringify(obj);
      if (str.length > 4000) {
        return JSON.parse(str.slice(0, 4000) + "}");
      }
    }
    return obj;
  }
}
