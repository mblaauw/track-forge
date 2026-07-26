import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as yaml from "js-yaml";
import {
  migrateLegacyJob,
  SongIntentV1Schema,
  hashIntent,
  defaultSongIntent,
} from "../src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const GENRE_DIR = join(__dirname, "..", "..", "..", "config", "genres");

// Discover every (genre, preset) pair from disk — single source of truth.
function loadAllPresets(): { genreId: string; preset: any }[] {
  const result: { genreId: string; preset: any }[] = [];
  for (const genreId of readdirSync(GENRE_DIR)) {
    const dir = join(GENRE_DIR, genreId);
    if (!statSync(dir).isDirectory()) continue;
    for (const file of readdirSync(dir).sort()) {
      if (!file.endsWith(".yaml") || file === "base.yaml") continue;
      const raw = readFileSync(join(dir, file), "utf-8");
      const parsed = yaml.load(raw) as {
        id: string;
        name: string;
        values?: Record<string, unknown>;
      };
      if (parsed && parsed.id && parsed.values) {
        result.push({ genreId, preset: parsed });
      }
    }
  }
  return result;
}

describe("migrateLegacyJob: all presets", () => {
  const presets = loadAllPresets();

  it("discovers 41 presets", () => {
    expect(presets.length).toBe(41);
  });

  for (const { genreId, preset } of presets) {
    it(`migrates ${genreId}/${preset.id} losslessly`, () => {
      const legacyInputs = JSON.stringify(preset.values);
      const { intent, hash } = migrateLegacyJob({
        genreId,
        presetId: preset.id,
        inputs: legacyInputs,
      });

      // Round-trip parses cleanly against the strict schema.
      const parsed = SongIntentV1Schema.parse(intent);

      // Round-trip hash is stable.
      expect(hashIntent(parsed)).toBe(hash);

      // Primary style was inferred.
      expect(intent.styles).toHaveLength(1);
      expect(intent.styles[0]).toMatchObject({
        genreId,
        presetId: preset.id,
        role: "primary",
        strength: 3,
      });

      // Carries preset values that were originally present.
      const v = preset.values as Record<string, unknown>;
      if (typeof v.bpm === "number") expect(intent.musical.bpm).toBe(v.bpm);
      if (typeof v.energy === "number")
        expect(intent.musical.energy).toBe(v.energy);
      if (Array.isArray(v.characteristics))
        expect(intent.musical.characteristics).toEqual(
          v.characteristics.map(String),
        );
    });
  }

  it("hash is deterministic across repeated migrations", () => {
    const hashes = presets.map(
      ({ genreId, preset }) =>
        migrateLegacyJob({
          genreId,
          presetId: preset.id,
          inputs: JSON.stringify(preset.values),
        }).hash,
    );
    const first = [...hashes];
    const second = presets.map(
      ({ genreId, preset }) =>
        migrateLegacyJob({
          genreId,
          presetId: preset.id,
          inputs: JSON.stringify(preset.values),
        }).hash,
    );
    expect(second).toEqual(first);
  });
});
