import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";

export type Db = BetterSQLite3Database<typeof schema>;

/** Expose underlying sqlite instance for raw operations */
export function getSqlite(db: Db): Database.Database {
  return (db as any).$client as Database.Database;
}

/**
 * Open SQLite DB, enable WAL mode, auto-create tables, return Drizzle handle.
 */
export function createDb(dbPath: string): Db {
  const sqlite = new Database(dbPath);

  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("busy_timeout = 5000");
  sqlite.pragma("foreign_keys = ON");

  const db = drizzle(sqlite, { schema });

  // Auto-create tables if they don't exist
  sqlite.exec(`CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    name TEXT,
    genre_id TEXT NOT NULL,
    preset_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    current_stage TEXT NOT NULL DEFAULT 'ref_interpretation',
    reference TEXT,
    source_hash TEXT,
    inputs TEXT,
    nl_adjustments TEXT,
    findings TEXT,
    compiled_json TEXT,
    stage_attempt INTEGER NOT NULL DEFAULT 0,
    error TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS versions (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL REFERENCES jobs(id),
    status TEXT NOT NULL DEFAULT 'draft',
    number INTEGER NOT NULL,
    artifacts TEXT NOT NULL DEFAULT '[]',
    stage TEXT,
    parent_version_id TEXT,
    finalized_at TEXT,
    created_at TEXT NOT NULL
  )`);

  // ── Migrate existing databases ──────────────────────────────────────

  try { sqlite.exec(`ALTER TABLE versions ADD COLUMN stage TEXT`); } catch {}
  try { sqlite.exec(`ALTER TABLE versions ADD COLUMN parent_version_id TEXT`); } catch {}
  sqlite.exec(`CREATE TABLE IF NOT EXISTS generations (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL REFERENCES jobs(id),
    version_id TEXT REFERENCES versions(id),
    status TEXT NOT NULL DEFAULT 'queued',
    audio_url TEXT,
    image_url TEXT,
    video_url TEXT,
    duration INTEGER,
    generated_title TEXT,
    style TEXT,
    error TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);

  return db;
}

export { schema };
