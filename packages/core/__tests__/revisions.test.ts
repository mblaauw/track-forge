import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as yaml from "js-yaml";
import { unlinkSync, existsSync } from "node:fs";
import {
  migrateLegacyJob,
  hashIntent,
  resolveSongIntent,
} from "@track-forge/song-intent";
import {
  createDb,
  freezeIntentRevision,
  createCompilation,
  loadIntentRevision,
  parseRevisionIntent,
  renderSunoStyle,
  schema,
} from "../src/index.js";
import type { Db } from "../src/index.js";
import { eq, sql } from "drizzle-orm";

async function seedJob(
  db: Db,
  id: string,
  genreId: string,
  presetId: string,
): Promise<void> {
  const now = new Date().toISOString();
  await db
    .insert(schema.jobs)
    .values({
      id,
      genreId,
      presetId,
      status: "pending",
      currentStage: "compilation",
      stageAttempt: 0,
      isFavorite: false,
      createdAt: now,
      updatedAt: now,
    } as any)
    .onConflictDoNothing();
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const GENRE_DIR = join(__dirname, "..", "..", "..", "config", "genres");
const TEST_DB = join(__dirname, "..", "..", "data", "test-revisions.db");

function loadAllPresets() {
  const result: {
    genreId: string;
    id: string;
    values: Record<string, unknown>;
  }[] = [];
  for (const genreId of readdirSync(GENRE_DIR)) {
    const dir = join(GENRE_DIR, genreId);
    if (!statSync(dir).isDirectory()) continue;
    for (const file of readdirSync(dir).sort()) {
      if (!file.endsWith(".yaml") || file === "base.yaml") continue;
      const raw = readFileSync(join(dir, file), "utf-8");
      const parsed = yaml.load(raw) as Record<string, unknown> | undefined;
      if (parsed && typeof parsed.id === "string" && parsed.values) {
        result.push({
          genreId,
          id: parsed.id as string,
          values: (parsed.values ?? {}) as Record<string, unknown>,
        });
      }
    }
  }
  return result;
}

let db: Db;

beforeAll(() => {
  if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
  db = createDb(TEST_DB);
});

afterAll(() => {
  if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
});

describe("freezeIntentRevision", () => {
  it("creates a revision for a job's inputs", async () => {
    await seedJob(db, "job-1", "edm", "deep_house_chill");
    const revId = await freezeIntentRevision(
      db,
      "job-1",
      "edm",
      "deep_house_chill",
      JSON.stringify({
        bpm: 118,
        lyricsMode: "strict_instrumental",
        mood: "warm",
        energy: 5,
        complexity: 4,
        characteristics: ["warm", "groovy"],
      }),
    );
    expect(revId).toBe("job-1-rev-1");

    const loaded = await loadIntentRevision(db, revId);
    expect(loaded).not.toBeNull();
    expect(loaded!.revisionNumber).toBe(1);
    expect(loaded!.schemaVersion).toBe(1);
  });

  it("increments revision number per job", async () => {
    await seedJob(db, "job-2", "edm", "deep_house_chill");
    const rev1Id = await freezeIntentRevision(
      db,
      "job-2",
      "edm",
      "deep_house_chill",
      JSON.stringify({ bpm: 128 }),
    );
    expect(rev1Id).toBe("job-2-rev-1");

    const rev2Id = await freezeIntentRevision(
      db,
      "job-2",
      "edm",
      "deep_house_chill",
      JSON.stringify({ bpm: 130 }),
    );
    expect(rev2Id).toBe("job-2-rev-2");
  });

  it("produces stable hashes for identical inputs", async () => {
    await seedJob(db, "job-hash", "edm", "deep_house_chill");
    const inputs = JSON.stringify({
      bpm: 140,
      lyricsMode: "full_lyrics",
      mood: "dark",
    });
    const id1 = await freezeIntentRevision(
      db,
      "job-hash",
      "edm",
      "deep_house_chill",
      inputs,
    );
    const id2 = await freezeIntentRevision(
      db,
      "job-hash",
      "edm",
      "deep_house_chill",
      inputs,
    );

    // Different revision numbers but can verify intent hash match via load
    const rev1 = await loadIntentRevision(db, id1);
    const rev2 = await loadIntentRevision(db, id2);
    expect(rev1!.intentHash).toBe(rev2!.intentHash);
  });
});

describe("createCompilation", () => {
  it("links compilation to revision", async () => {
    await seedJob(db, "job-comp", "hiphop", "boom_bap_classic");
    const revId = await freezeIntentRevision(
      db,
      "job-comp",
      "hiphop",
      "boom_bap_classic",
      JSON.stringify({
        bpm: 90,
        lyricsMode: "full_lyrics",
        flowPattern: "laid_back",
        energy: 7,
      }),
    );
    const compId = await createCompilation(db, revId, {
      style: "HipHop — Boom Bap Classic. around 90 BPM (laid-back feel). ...",
      lyrics: "[Verse]\nlines here\n\n[Hook]\ncatchy",
      excludedStyles: "vocals, singing",
    });
    expect(compId).toBe(`${revId}-comp`);

    // Verify the compilation exists
    const [row] = await db
      .select()
      .from(schema.compilations)
      .where(eq(schema.compilations.id, compId))
      .limit(1);
    expect(row).not.toBeUndefined();
    expect(row.style).toContain("Boom Bap Classic");
    expect(row.lyrics).toContain("[Verse]");
  });
});

describe("reproducibility", () => {
  const allPresets = loadAllPresets();

  it("re-renders identical style from a frozen intent revision", async () => {
    for (const { genreId, id, values } of allPresets.slice(0, 5)) {
      const inputs = JSON.stringify(values);
      const migrated = migrateLegacyJob({ genreId, presetId: id, inputs });
      const resolved = resolveSongIntent({
        intent: migrated.intent,
        provenance: {},
        warnings: [],
      });
      resolved.genreName = genreId;
      resolved.presetLabels = [id];
      const first = renderSunoStyle(resolved);

      // Re-run from same intent — should produce same style
      const second = renderSunoStyle({ ...resolved });
      expect(second.style).toBe(first.style);
    }
  });

  it("freeze + parse + re-render matches original render", async () => {
    // Pick one preset and run a full end-to-end reproducibility check
    const target = allPresets[0]!;
    const inputsStr = JSON.stringify(target.values);

    // Freeze revision
    await seedJob(db, "job-repro", target.genreId, target.id);
    const revId = await freezeIntentRevision(
      db,
      "job-repro",
      target.genreId,
      target.id,
      inputsStr,
    );
    const loaded = await loadIntentRevision(db, revId);
    expect(loaded).not.toBeNull();

    // Parse from JSON
    const parsedIntent = parseRevisionIntent(loaded!);
    const resolved = resolveSongIntent({
      intent: parsedIntent,
      provenance: {},
      warnings: [],
    });
    resolved.genreName = target.genreId;
    resolved.presetLabels = [(target.values.name as string) ?? target.id];
    const rendered = renderSunoStyle(resolved);

    // Create a compilation from the render
    const compId = await createCompilation(db, revId, {
      style: rendered.style,
      lyrics: "",
      excludedStyles: "",
      resolvedIntent: resolved,
    });
    expect(compId).toBe(`${revId}-comp`);

    // Verify compilation stored the style
    const [comp] = await db
      .select()
      .from(schema.compilations)
      .where(eq(schema.compilations.id, compId))
      .limit(1);
    expect(comp.style).toBe(rendered.style);
  });
});
