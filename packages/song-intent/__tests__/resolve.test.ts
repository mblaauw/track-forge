import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as yaml from "js-yaml";
import {
  resolveSongIntent,
  materializeIntent,
  type PresetCatalog,
  type SongIntentDraft,
  type MaterializedIntent,
  type StyleInfluence,
} from "../src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const GENRE_DIR = join(__dirname, "..", "..", "..", "config", "genres");

function resolve(draft: SongIntentDraft, catalog: PresetCatalog) {
  const materialized = materializeIntent(draft, catalog);
  return resolveSongIntent(materialized);
}

// ── Helper: load presets from disk ────────────────────────────────────

function loadAllPresets(): {
  genreId: string;
  preset: Record<string, unknown>;
}[] {
  const result: { genreId: string; preset: Record<string, unknown> }[] = [];
  for (const genreId of readdirSync(GENRE_DIR)) {
    const dir = join(GENRE_DIR, genreId);
    if (!statSync(dir).isDirectory()) continue;
    for (const file of readdirSync(dir).sort()) {
      if (!file.endsWith(".yaml") || file === "base.yaml") continue;
      const raw = readFileSync(join(dir, file), "utf-8");
      const parsed = yaml.load(raw) as Record<string, unknown> | undefined;
      if (
        parsed &&
        typeof parsed.id === "string" &&
        parsed.values &&
        typeof parsed.values === "object"
      ) {
        result.push({ genreId, preset: parsed });
      }
    }
  }
  return result;
}

function catalogFrom(
  presets: { genreId: string; preset: Record<string, unknown> }[],
): PresetCatalog {
  const map = new Map(presets.map((p) => [p.preset.id as string, p.preset]));
  return {
    getPreset(_gid: string, pid: string) {
      const p = map.get(pid);
      if (!p) return undefined;
      return {
        name: String(p.name ?? pid),
        values: (p.values ?? {}) as Record<string, unknown>,
      };
    },
  };
}

// ── 1. All 41 presets resolve cleanly ─────────────────────────────────

describe("resolveSongIntent: all presets", () => {
  const allPresets = loadAllPresets();
  const catalog = catalogFrom(allPresets);

  it(`resolves ${allPresets.length} presets without warnings`, () => {
    for (const { genreId, preset } of allPresets) {
      const draft: SongIntentDraft = {
        selectedStyles: [
          {
            genreId,
            presetId: String(preset.id),
            role: "primary",
            strength: 3,
          },
        ],
        userValues: {},
      };
      const result = resolve(draft, catalog);
      expect(result.conflicts).toHaveLength(0);
      expect(result.bpm).toBeGreaterThanOrEqual(40);
      expect(result.bpm).toBeLessThanOrEqual(220);
      expect(Array.isArray(result.traits)).toBe(true);
    }
  });

  it(`resolves every preset in <5ms (benchmark)`, () => {
    const start = performance.now();
    const iterations = allPresets.length;
    for (const { genreId, preset } of allPresets) {
      const draft: SongIntentDraft = {
        selectedStyles: [
          {
            genreId,
            presetId: String(preset.id),
            role: "primary",
            strength: 3,
          },
        ],
        userValues: {},
      };
      resolve(draft, catalog);
    }
    const elapsed = performance.now() - start;
    const perPreset = elapsed / iterations;
    expect(perPreset).toBeLessThan(5);
  });
});

// ── 2. Derivation rules ───────────────────────────────────────────────

describe("resolveSongIntent: derivation rules", () => {
  const noopCatalog: PresetCatalog = { getPreset: () => undefined };

  it("rule 1: strict_instrumental → no lead vocal, instrumental trait", () => {
    const draft: SongIntentDraft = {
      selectedStyles: [],
      userValues: {
        vocals: { mode: "strict_instrumental", sections: [] },
        musical: { characteristics: [], descriptors: [] },
        lyrics: { themes: [], imageAnchors: [] },
      },
    };
    const result = resolve(draft, noopCatalog);
    expect(result.vocals.hasLeadVocal).toBe(false);
    expect(result.lyrics.shouldWrite).toBe(false);
    expect(result.traits.some((t) => t.name === "instrumental")).toBe(true);
  });

  it("rule 1: full_lyrics → has lead vocal", () => {
    const draft: SongIntentDraft = {
      selectedStyles: [],
      userValues: {
        vocals: { mode: "full_lyrics", sections: [] },
        musical: { characteristics: [], descriptors: [] },
        lyrics: { themes: [], imageAnchors: [] },
      },
    };
    const result = resolve(draft, noopCatalog);
    expect(result.vocals.hasLeadVocal).toBe(true);
    expect(result.lyrics.shouldWrite).toBe(true);
  });

  it("rule 2: high energy + multiple peaks → increasing peak arc", () => {
    const draft: SongIntentDraft = {
      selectedStyles: [],
      userValues: {
        musical: { energy: 8, characteristics: [], descriptors: [] },
        vocals: { mode: "strict_instrumental", sections: [] },
        lyrics: { themes: [], imageAnchors: [] },
        arrangement: {
          source: "custom",
          sections: [
            {
              id: "s1",
              name: "Intro",
              bars: 8,
              fn: "establish",
              deltas: [],
              tags: [],
            },
            {
              id: "s2",
              name: "Build",
              bars: 8,
              fn: "introduce",
              deltas: [],
              tags: [],
            },
            {
              id: "s3",
              name: "Drop",
              bars: 16,
              fn: "peak",
              deltas: [],
              tags: [],
            },
            {
              id: "s4",
              name: "Breakdown",
              bars: 8,
              fn: "remove",
              deltas: [],
              tags: [],
            },
            {
              id: "s5",
              name: "Build 2",
              bars: 8,
              fn: "escalate",
              deltas: [],
              tags: [],
            },
            {
              id: "s6",
              name: "Drop 2",
              bars: 16,
              fn: "peak",
              deltas: [],
              tags: [],
            },
          ],
        },
      },
    };
    const result = resolve(draft, noopCatalog);
    expect(result.arrangement.arcs).toHaveLength(1);
    expect(result.arrangement.arcs[0]?.label).toBe("increasing peak");
    expect(result.arrangement.arcs[0]?.sections).toHaveLength(2);
    expect(result.traits.some((t) => t.name === "increasing-peak-arc")).toBe(
      true,
    );
  });

  it("rule 2: low energy + multiple peaks → NO increasing peak arc", () => {
    const draft: SongIntentDraft = {
      selectedStyles: [],
      userValues: {
        musical: { energy: 3, characteristics: [], descriptors: [] },
        vocals: { mode: "strict_instrumental", sections: [] },
        lyrics: { themes: [], imageAnchors: [] },
        arrangement: {
          source: "custom",
          sections: [
            {
              id: "s1",
              name: "Drop",
              bars: 16,
              fn: "peak",
              deltas: [],
              tags: [],
            },
            {
              id: "s2",
              name: "Drop 2",
              bars: 16,
              fn: "peak",
              deltas: [],
              tags: [],
            },
          ],
        },
      },
    };
    const result = resolve(draft, noopCatalog);
    expect(result.arrangement.arcs).toHaveLength(0);
  });

  it("rule 3: intimate vocal + dense arrangement → creative tension trait", () => {
    const draft: SongIntentDraft = {
      selectedStyles: [],
      userValues: {
        vocals: { mode: "full_lyrics", type: "female_lead", sections: [] },
        musical: { characteristics: [], descriptors: [] },
        lyrics: { themes: [], imageAnchors: [] },
        arrangement: {
          source: "custom",
          sections: [
            {
              id: "s1",
              name: "Verse",
              bars: 16,
              fn: "introduce",
              deltas: [],
              tags: ["full groove"],
              vocal: {
                type: "female_lead",
                delivery: "intimate",
                energy: 3,
                adlibs: false,
                harmonies: false,
              },
            },
          ],
        },
      },
    };
    const result = resolve(draft, noopCatalog);
    const hasTension = result.traits.some(
      (t) => t.name === "vocal-arrangement-tension",
    );
    expect(hasTension).toBe(true);
  });

  it("rule 4: multiple primary styles → error conflict", () => {
    const draft: SongIntentDraft = {
      selectedStyles: [
        { genreId: "edm", presetId: "a", role: "primary", strength: 3 },
        { genreId: "edm", presetId: "b", role: "primary", strength: 3 },
      ],
      userValues: {
        musical: { characteristics: [], descriptors: [] },
        vocals: { mode: "strict_instrumental", sections: [] },
        lyrics: { themes: [], imageAnchors: [] },
      },
    };
    const result = resolve(draft, noopCatalog);
    expect(
      result.conflicts.some((c) => c.message.includes("Multiple primary")),
    ).toBe(true);
    expect(result.conflicts.some((c) => c.severity === "error")).toBe(true);
  });
});

// ── 3. Edge cases ─────────────────────────────────────────────────────

describe("resolveSongIntent: edge cases", () => {
  const noopCatalog: PresetCatalog = { getPreset: () => undefined };

  it("has decisions for derived arcs", () => {
    const draft: SongIntentDraft = {
      selectedStyles: [],
      userValues: {
        musical: { energy: 9, characteristics: [], descriptors: [] },
        vocals: { mode: "strict_instrumental", sections: [] },
        lyrics: { themes: [], imageAnchors: [] },
        arrangement: {
          source: "custom",
          sections: [
            {
              id: "s1",
              name: "Drop",
              bars: 16,
              fn: "peak",
              deltas: [],
              tags: [],
            },
            {
              id: "s2",
              name: "Drop 2",
              bars: 16,
              fn: "peak",
              deltas: [],
              tags: [],
            },
          ],
        },
      },
    };
    const result = resolve(draft, noopCatalog);
    expect(result.decisions.length).toBeGreaterThanOrEqual(1);
    expect(result.decisions[0]?.message).toContain("increasing-peak");
  });
});
