import { createDb } from "@track-forge/core";
import type { Db } from "@track-forge/core";
import type { Config } from "@track-forge/contracts";

let _db: Db | null = null;

export function initDb(config: Config): Db {
  if (!_db) {
    _db = createDb(config.dbPath);
  }
  return _db;
}

export function getDb(): Db {
  if (!_db) throw new Error("DB not initialized. Call initDb() first.");
  return _db;
}
