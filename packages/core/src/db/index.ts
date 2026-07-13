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

  // ── Auto-create tables ────────────────────────────────────────────

  sqlite.exec(`CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    genre_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS project_drafts (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id),
    genre_id TEXT NOT NULL,
    preset_id TEXT NOT NULL,
    inputs TEXT,
    reference TEXT,
    nl_adjustments TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    project_id TEXT REFERENCES projects(id),
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
    stage_data TEXT,
    stage_attempt INTEGER NOT NULL DEFAULT 0,
    error TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    is_favorite INTEGER NOT NULL DEFAULT 0
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
  try { sqlite.exec(`ALTER TABLE jobs ADD COLUMN stage_data TEXT`); } catch {}
  try { sqlite.exec(`ALTER TABLE jobs ADD COLUMN project_id TEXT`); } catch {}
  try { sqlite.exec(`ALTER TABLE jobs ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0`); } catch {}
  try { sqlite.exec(`ALTER TABLE generations ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0`); } catch {}
  try { sqlite.exec(`ALTER TABLE generations ADD COLUMN seed INTEGER`); } catch {}

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
    updated_at TEXT NOT NULL,
    is_favorite INTEGER NOT NULL DEFAULT 0,
    seed INTEGER
  )`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS job_stage_outputs (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL REFERENCES jobs(id),
    stage TEXT NOT NULL,
    output_json TEXT NOT NULL,
    prompt_manifest_json TEXT,
    completed_at TEXT NOT NULL
  )`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS job_events (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL REFERENCES jobs(id),
    sequence INTEGER NOT NULL,
    stage TEXT,
    status TEXT NOT NULL,
    data TEXT,
    error TEXT,
    timestamp TEXT NOT NULL
  )`);
  // Migrate: add sequence column to existing tables
  try { sqlite.exec(`ALTER TABLE job_events ADD COLUMN sequence INTEGER`); } catch {}
  // Backfill sequence for existing rows (order by timestamp)
  try { sqlite.exec(`UPDATE job_events SET sequence = rowid WHERE sequence IS NULL`); } catch {}
  sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_job_events_job_sequence ON job_events(job_id, sequence)`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS critic_findings (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL REFERENCES jobs(id),
    stage TEXT NOT NULL,
    severity TEXT NOT NULL,
    field TEXT NOT NULL,
    message TEXT NOT NULL,
    patch_type TEXT,
    suggested_value TEXT,
    applied INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  )`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS adjustments (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL REFERENCES jobs(id),
    instruction TEXT NOT NULL,
    target_stage TEXT,
    applied INTEGER NOT NULL DEFAULT 0,
    result_hash TEXT,
    created_at TEXT NOT NULL,
    applied_at TEXT
  )`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS artifact_locks (
    id TEXT PRIMARY KEY,
    version_id TEXT NOT NULL REFERENCES versions(id),
    artifact_type TEXT NOT NULL,
    locked_by TEXT NOT NULL,
    acquired_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  )`);
  sqlite.exec(`CREATE TABLE IF NOT EXISTS suno_tracks (
    id TEXT PRIMARY KEY,
    generation_id TEXT NOT NULL REFERENCES generations(id),
    "index" INTEGER NOT NULL,
    audio_url TEXT,
    image_url TEXT,
    video_url TEXT,
    duration INTEGER,
    title TEXT,
    created_at TEXT NOT NULL
  )`);

  return db;
}

export { schema };
