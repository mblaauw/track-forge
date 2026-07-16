import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createDb, schema } from "@track-forge/core";
import { eq } from "drizzle-orm";
import type { Db } from "@track-forge/core";
import {
  ApiError,
  findRowOr404,
  safeParse,
  parsePagination,
} from "../src/lib/db-utils.js";

describe("ApiError", () => {
  it("sets statusCode and message", () => {
    const err = new ApiError(404, "not found");
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe("not found");
    expect(err.name).toBe("ApiError");
  });

  it("is instanceof Error", () => {
    expect(new ApiError(500, "oops")).toBeInstanceOf(Error);
  });
});

describe("findRowOr404", () => {
  let db: Db;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "tf-dbutils-"));
    db = createDb(join(tmpDir, "test.db"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns the row when found", async () => {
    const now = new Date().toISOString();
    const [inserted] = await db
      .insert(schema.projects)
      .values({
        id: "test-find-row",
        name: "Test",
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    const row = await findRowOr404(
      db,
      schema.projects,
      eq(schema.projects.id, inserted.id),
      "Project",
    );

    expect(row).toBeDefined();
    expect(row.id).toBe("test-find-row");
    expect(row.name).toBe("Test");
  });

  it("throws ApiError(404) when not found", async () => {
    await expect(
      findRowOr404(
        db,
        schema.projects,
        eq(schema.projects.id, "nonexistent"),
        "Project",
      ),
    ).rejects.toThrow(ApiError);

    await expect(
      findRowOr404(
        db,
        schema.projects,
        eq(schema.projects.id, "nonexistent"),
        "Project",
      ),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: "Project not found",
    });
  });
});

describe("safeParse", () => {
  it("parses valid JSON", () => {
    expect(safeParse('{"a":1}', {})).toEqual({ a: 1 });
  });

  it("returns fallback for null", () => {
    expect(safeParse(null, [])).toEqual([]);
  });

  it("returns fallback for undefined", () => {
    expect(safeParse(undefined, "default")).toBe("default");
  });

  it("returns fallback for invalid JSON", () => {
    expect(safeParse("{broken", 0)).toBe(0);
  });

  it("returns fallback for empty string", () => {
    expect(safeParse("", {})).toEqual({});
  });
});

describe("parsePagination", () => {
  it("uses defaults when no query params", () => {
    const result = parsePagination({});
    expect(result).toEqual({ limit: 50, offset: 0 });
  });

  it("parses limit and offset from query", () => {
    const result = parsePagination({ limit: "10", offset: "20" });
    expect(result).toEqual({ limit: 10, offset: 20 });
  });

  it("clamps limit to maxLimit", () => {
    const result = parsePagination({ limit: "999" }, { maxLimit: 50 });
    expect(result.limit).toBe(50);
  });

  it("applies custom defaults", () => {
    const result = parsePagination({}, { limit: 10, offset: 5, maxLimit: 200 });
    expect(result).toEqual({ limit: 10, offset: 5 });
  });

  it("falls back to default limit for NaN", () => {
    const result = parsePagination({ limit: "abc" });
    expect(result.limit).toBe(50);
  });

  it("falls back to default offset for NaN", () => {
    const result = parsePagination({ offset: "xyz" });
    expect(result.offset).toBe(0);
  });

  it("handles negative values by falling back to defaults", () => {
    const result = parsePagination({ limit: "-5", offset: "-1" });
    expect(result.limit).toBe(50);
    expect(result.offset).toBe(0);
  });
});
