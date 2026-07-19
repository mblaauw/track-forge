import { readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as yaml from "js-yaml";

interface PresetValue {
  [key: string]: unknown;
}

interface GenrePresetYaml {
  id: string;
  name: string;
  description: string;
  values: PresetValue;
}

interface TagCategoryYaml {
  id: string;
  name: string;
  color: string;
  suggestions: string[];
}

interface SongStructureSectionYaml {
  section: string;
  bars: number | { base: number; per_energy?: number; per_complexity?: number };
  tags: string[];
}

export interface GenreConfigYaml {
  name: string;
  color: string;
  subgenre_count: string;
  tag_categories: TagCategoryYaml[];
  presets: GenrePresetYaml[];
  song_structure?: SongStructureSectionYaml[];
  taxonomy?: unknown;
}

const ROOT = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "..",
  "config",
);
const GENRE_DIR = join(ROOT, "genres");

interface CacheEntry {
  mtime: number;
  data: GenreConfigYaml;
}

const cache = new Map<string, CacheEntry>();

function loadYaml(id: string): GenreConfigYaml {
  const filePath = join(GENRE_DIR, `${id}.yaml`);

  const cached = cache.get(id);
  if (cached) {
    try {
      const currentMtime = statSync(filePath).mtimeMs;
      if (currentMtime <= cached.mtime) return cached.data;
    } catch {
      // if stat fails, fall through to re-read
    }
  }

  try {
    const raw = readFileSync(filePath, "utf-8");
    const parsed = yaml.load(raw) as GenreConfigYaml;
    cache.set(id, { mtime: statSync(filePath).mtimeMs, data: parsed });
    return parsed;
  } catch (err) {
    throw new Error(
      `Failed to load genre config for "${id}": ${(err as Error).message}`,
    );
  }
}

export const ALL_GENRE_IDS = ["edm", "hiphop", "ambient"] as const;

export function listGenreConfigs(): {
  id: string;
  name: string;
  color: string;
  subgenre_count: string;
}[] {
  const ids = ALL_GENRE_IDS;
  return ids.map((id) => {
    const cfg = loadYaml(id);
    return {
      id,
      name: cfg.name,
      color: cfg.color,
      subgenre_count: cfg.subgenre_count,
    };
  });
}

export function getPresets(id: string): GenrePresetYaml[] {
  return loadYaml(id).presets;
}

export function getTagCategories(id: string): TagCategoryYaml[] {
  return loadYaml(id).tag_categories;
}

export function getSongStructure(id: string): SongStructureSectionYaml[] {
  return loadYaml(id).song_structure ?? [];
}

export function getTaxonomy(id: string): unknown {
  return loadYaml(id).taxonomy ?? null;
}

/** Force reload on next access. */
export function clearCache(): void {
  cache.clear();
}

/** Number of cached entries (for diagnostics). */
export function cacheSize(): number {
  return cache.size;
}
