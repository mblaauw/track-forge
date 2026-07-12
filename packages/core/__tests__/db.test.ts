import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createDb } from "../src/db/index.js";
import { schema } from "../src/db/index.js";

describe("createDb", () => {
  let tmpDir: string;

  afterEach(() => {
    if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
  });

  it("creates SQLite file at given path", () => {
    tmpDir = mkdtempSync(join(tmpdir(), "tf-db-test-"));
    const dbPath = join(tmpDir, "test.db");
    const db = createDb(dbPath);
    expect(db).toBeDefined();
    expect(existsSync(dbPath)).toBe(true);

    const result = db.select().from(schema.jobs).all();
    expect(Array.isArray(result)).toBe(true);
  });

  it("creates in-memory database when given :memory:", () => {
    const db = createDb(":memory:");
    expect(db).toBeDefined();

    const result = db.select().from(schema.jobs).all();
    expect(Array.isArray(result)).toBe(true);
  });
});
