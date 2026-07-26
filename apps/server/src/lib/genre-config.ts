import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as yaml from "js-yaml";
import type { SongStructureSection } from "@track-forge/genre-core";

interface PresetValue {
  [key: string]: unknown;
}

interface GenrePresetYaml {
  id: string;
  name: string;
  description: string;
  values: PresetValue;
  /** Optional preset-specific arrangement structure — overrides genre base.yaml. */
  song_structure?: SongStructureSection[];
  /** CamelCase alias for API consumers (mapped at return time). */
  songStructure?: SongStructureSection[];
}

export interface GenreConfigYaml {
  name: string;
  color: string;

  song_structure?: SongStructureSection[];
  descriptor_categories?: {
    cat: string;
    label: string;
    hue: string;
    chips: string[];
  }[];
  descriptor_defaults?: { label: string; cat: string; weight: number }[];
  lyric_themes?: string[];
  section_functions?: string[];
  delta_palette?: string[];
  section_palette?: string[];
  vocal_presets?: {
    type: string;
    delivery_style: string;
    default_energy: number;
  }[];
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
const LYRIC_PROMPTS_DIR = join(ROOT, "lyrics-prompts");
const SHARED_PATH = join(ROOT, "shared.yaml");

interface VocalPresetTypeDef {
  id: string;
  label: string;
}

interface SharedConfigYaml {
  section_functions?: string[];
  delta_palette?: string[];
  vocal_preset_types?: VocalPresetTypeDef[];
}

let sharedCache: { mtime: number; data: SharedConfigYaml } | null = null;

function loadShared(): SharedConfigYaml {
  if (sharedCache) {
    try {
      const currentMtime = statSync(SHARED_PATH).mtimeMs;
      if (currentMtime <= sharedCache.mtime) return sharedCache.data;
    } catch {
      // if stat fails, fall through to re-read
    }
  }
  try {
    const raw = readFileSync(SHARED_PATH, "utf-8");
    const parsed = (yaml.load(raw) as SharedConfigYaml) ?? {};
    sharedCache = { mtime: statSync(SHARED_PATH).mtimeMs, data: parsed };
    return parsed;
  } catch {
    return {};
  }
}

// ── Genre base config (base.yaml) cache ───────────────────────────
interface CacheEntry {
  mtime: number;
  data: GenreConfigYaml;
}

const cache = new Map<string, CacheEntry>();

function basePath(id: string): string {
  return join(GENRE_DIR, id, "base.yaml");
}

function loadYaml(id: string): GenreConfigYaml {
  const filePath = basePath(id);

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
    const shared = loadShared();
    parsed.section_functions ??= shared.section_functions;
    parsed.delta_palette ??= shared.delta_palette;

    // Resolve vocal preset type ids → full labels from shared definitions
    const vocalTypeMap = new Map(
      (shared.vocal_preset_types ?? []).map((vt) => [vt.id, vt.label]),
    );
    if (parsed.vocal_presets) {
      for (const vp of parsed.vocal_presets) {
        vp.type = vocalTypeMap.get(vp.type) ?? vp.type;
      }
    }

    cache.set(id, {
      mtime: statSync(filePath).mtimeMs,
      data: parsed,
    });
    return parsed;
  } catch (err) {
    throw new Error(
      `Failed to load genre config for "${id}": ${(err as Error).message}`,
    );
  }
}

// ── Presets cache ─────────────────────────────────────────────────
interface PresetsCacheEntry {
  mtimes: Map<string, number>;
  data: GenrePresetYaml[];
}

const presetsCache = new Map<string, PresetsCacheEntry>();

function presetsDir(id: string): string {
  return join(GENRE_DIR, id);
}

function loadPresets(id: string): GenrePresetYaml[] {
  const dir = presetsDir(id);
  const cached = presetsCache.get(id);

  try {
    const presetFiles = readdirSync(dir)
      .filter((f) => f.endsWith(".yaml") && f !== "base.yaml")
      .sort();

    // Check if cache is still fresh
    if (cached) {
      let fresh = true;
      const currentMtimes = new Map<string, number>();
      for (const f of presetFiles) {
        try {
          currentMtimes.set(f, statSync(join(dir, f)).mtimeMs);
        } catch {
          fresh = false;
          break;
        }
      }
      if (fresh) {
        // Compare mtimes
        for (const [f, m] of currentMtimes) {
          if (cached.mtimes.get(f) !== m) {
            fresh = false;
            break;
          }
        }
        if (fresh && cached.mtimes.size === currentMtimes.size) {
          return cached.data;
        }
      }
    }

    // Reload
    const presets: GenrePresetYaml[] = [];
    const mtimes = new Map<string, number>();
    for (const f of presetFiles) {
      try {
        const raw = readFileSync(join(dir, f), "utf-8");
        const parsed = yaml.load(raw) as GenrePresetYaml;
        presets.push(parsed);
        mtimes.set(f, statSync(join(dir, f)).mtimeMs);
      } catch {
        // skip unreadable preset files
      }
    }

    // Map snake_case YAML fields to camelCase for the API consumer
    const mapped = presets.map((p) => ({
      ...p,
      songStructure: p.song_structure,
    }));
    presetsCache.set(id, { mtimes, data: mapped });
    return mapped;
  } catch {
    return [];
  }
}

let genreIdsCache: string[] | null = null;

/**
 * Genre ids derived from config/genres/* subdirectories — adding a new
 * directory makes it show up here immediately. Each directory must contain
 * a base.yaml. Registering a matching TypeScript genre module (input schema)
 * in apps/server/src/lib/modules.ts is still required.
 */
export function getAllGenreIds(): string[] {
  if (genreIdsCache) return genreIdsCache;
  try {
    genreIdsCache = readdirSync(GENRE_DIR)
      .filter((entry) => {
        try {
          return statSync(join(GENRE_DIR, entry)).isDirectory();
        } catch {
          return false;
        }
      })
      .sort();
  } catch {
    genreIdsCache = [];
  }
  return genreIdsCache;
}

export function listGenreConfigs(): {
  id: string;
  name: string;
  color: string;
}[] {
  const ids = getAllGenreIds();
  return ids.map((id) => {
    const cfg = loadYaml(id);
    return {
      id,
      name: cfg.name,
      color: cfg.color,
    };
  });
}

export function getPresets(id: string): GenrePresetYaml[] {
  return loadPresets(id);
}

export function getSongStructure(id: string): SongStructureSection[] {
  return loadYaml(id).song_structure ?? [];
}

export function getLyricsGuidance(id: string): string | undefined {
  const filePath = join(LYRIC_PROMPTS_DIR, `${id}.md`);
  try {
    return readFileSync(filePath, "utf-8").trim();
  } catch {
    return undefined;
  }
}

/** Force reload on next access. */
export function clearCache(): void {
  cache.clear();
  presetsCache.clear();
  genreIdsCache = null;
}

/** Number of cached entries (for diagnostics). */
export function cacheSize(): number {
  return cache.size + presetsCache.size;
}

// ── Descriptor defaults ───────────────────────────────────────────

export interface DescriptorCategoryPoolApi {
  cat: string;
  label: string;
  hue: string;
  chips: string[];
}

export interface DescriptorDefaultApi {
  label: string;
  cat: string;
  weight: number;
}

export interface GenreDescriptorDefaults {
  categories: DescriptorCategoryPoolApi[];
  defaults: DescriptorDefaultApi[];
  lyricThemes: string[];
  lyricAngles: { id: string; label: string }[];
  sectionFunctions: string[];
  deltaPalette: string[];
  sectionPalette: string[];
  vocalPresets: {
    type: string;
    deliveryStyle: string;
    defaultEnergy: number;
  }[];
  songStructure: SongStructureSection[];
}

export function getDescriptorDefaults(id: string): GenreDescriptorDefaults {
  const cfg = loadYaml(id);
  return {
    categories: cfg.descriptor_categories ?? [],
    defaults: cfg.descriptor_defaults ?? [],
    lyricThemes: cfg.lyric_themes ?? [],
    lyricAngles: [
      { id: "first_person", label: "First person" },
      { id: "story", label: "Storytelling" },
      { id: "abstract", label: "Abstract" },
      { id: "anthemic", label: "Anthemic" },
    ],
    sectionFunctions: cfg.section_functions ?? [],
    deltaPalette: cfg.delta_palette ?? [],
    sectionPalette: cfg.section_palette ?? [],
    vocalPresets: (cfg.vocal_presets ?? []).map((v) => ({
      type: v.type,
      deliveryStyle: v.delivery_style,
      defaultEnergy: v.default_energy,
    })),
    songStructure: cfg.song_structure ?? [],
  };
}
