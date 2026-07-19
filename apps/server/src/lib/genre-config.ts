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

// ── Descriptor defaults (interim TS data; Subissue 7 → YAML) ─────────

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
}

const DESCRIPTOR_DATA: Record<string, GenreDescriptorDefaults> = {
  edm: {
    categories: [
      {
        cat: "sound",
        label: "SOUND DESIGN",
        hue: "var(--hue-cyan)",
        chips: [
          "supersaw",
          "reese bass",
          "pluck lead",
          "fm bells",
          "granular pad",
          "detuned saw",
          "sine sub",
          "vocal chops",
          "arp sequence",
          "saw stabs",
        ],
      },
      {
        cat: "rhythm",
        label: "RHYTHM",
        hue: "var(--hue-amber)",
        chips: [
          "four-on-the-floor",
          "syncopated hats",
          "offbeat bass",
          "rolling toms",
          "breakbeat",
          "driving kick",
          "shuffled groove",
        ],
      },
      {
        cat: "atmosphere",
        label: "ATMOSPHERE",
        hue: "var(--hue-violet)",
        chips: [
          "euphoric",
          "dark",
          "dreamy",
          "hypnotic",
          "cinematic",
          "nostalgic",
          "uplifting",
          "tense",
        ],
      },
      {
        cat: "production",
        label: "PRODUCTION",
        hue: "var(--hue-green)",
        chips: [
          "sidechain pump",
          "wide stereo",
          "analog warmth",
          "crisp transients",
          "tape saturation",
          "polished master",
          "heavy compression",
        ],
      },
      {
        cat: "energy",
        label: "ENERGY",
        hue: "var(--hue-red)",
        chips: [
          "high energy",
          "driving",
          "restrained build",
          "explosive drop",
          "relentless",
          "dynamic swells",
        ],
      },
    ],
    defaults: [
      { label: "supersaw", cat: "sound", weight: 2 },
      { label: "four-on-the-floor", cat: "rhythm", weight: 2 },
      { label: "sidechain pump", cat: "production", weight: 2 },
      { label: "euphoric", cat: "atmosphere", weight: 2 },
      { label: "high energy", cat: "energy", weight: 2 },
    ],
  },
  hiphop: {
    categories: [
      {
        cat: "sound",
        label: "SOUND",
        hue: "var(--hue-cyan)",
        chips: [
          "808 bass",
          "keys",
          "chopped vocal",
          "brass stab",
          "synth pad",
          "pluck",
          "organ",
        ],
      },
      {
        cat: "rhythm",
        label: "RHYTHM & FLOW",
        hue: "var(--hue-amber)",
        chips: [
          "trap hi-hats",
          "swing groove",
          "slow roll",
          "double-time",
          "snare rolls",
          "finger snaps",
        ],
      },
      {
        cat: "atmosphere",
        label: "MOOD",
        hue: "var(--hue-violet)",
        chips: [
          "dark",
          "soulful",
          "melancholic",
          "hype",
          "laid back",
          "gritty",
          "smooth",
        ],
      },
      {
        cat: "production",
        label: "PRODUCTION",
        hue: "var(--hue-green)",
        chips: [
          "lofi warmth",
          "crisp mix",
          "wide stereo",
          "tape saturation",
          "sidechain",
          "heavy 808s",
        ],
      },
      {
        cat: "energy",
        label: "ENERGY",
        hue: "var(--hue-red)",
        chips: [
          "smooth",
          "bouncy",
          "aggressive",
          "relaxed",
          "build-up",
          "hard hitting",
        ],
      },
    ],
    defaults: [
      { label: "808 bass", cat: "sound", weight: 2 },
      { label: "trap hi-hats", cat: "rhythm", weight: 2 },
      { label: "lofi warmth", cat: "production", weight: 2 },
      { label: "dark", cat: "atmosphere", weight: 2 },
      { label: "smooth", cat: "energy", weight: 2 },
    ],
  },
  ambient: {
    categories: [
      {
        cat: "sound",
        label: "TEXTURE",
        hue: "var(--hue-cyan)",
        chips: [
          "granular pad",
          "field recording",
          "glass harmonica",
          "tape loop",
          "drone",
          "glockenspiel",
          "organ",
        ],
      },
      {
        cat: "rhythm",
        label: "PULSE",
        hue: "var(--hue-amber)",
        chips: [
          "slow pulse",
          "no beat",
          "irregular rhythm",
          "gentle swell",
          "lullaby tempo",
        ],
      },
      {
        cat: "atmosphere",
        label: "SPACE",
        hue: "var(--hue-violet)",
        chips: [
          "ethereal",
          "cinematic",
          "intimate",
          "vast",
          "underwater",
          "meditative",
          "open",
        ],
      },
      {
        cat: "production",
        label: "LUSH",
        hue: "var(--hue-green)",
        chips: [
          "wide stereo",
          "analog warmth",
          "reverb wash",
          "tape saturation",
          "soft compression",
        ],
      },
      {
        cat: "energy",
        label: "ENERGY",
        hue: "var(--hue-red)",
        chips: [
          "still",
          "slow build",
          "floating",
          "calm",
          "hypnotic",
          "sparse",
          "dense",
        ],
      },
    ],
    defaults: [
      { label: "granular pad", cat: "sound", weight: 2 },
      { label: "slow pulse", cat: "rhythm", weight: 2 },
      { label: "cinematic", cat: "atmosphere", weight: 2 },
      { label: "ethereal", cat: "energy", weight: 2 },
      { label: "wide stereo", cat: "production", weight: 2 },
    ],
  },
  pop: {
    categories: [
      {
        cat: "sound",
        label: "SOUND",
        hue: "var(--hue-cyan)",
        chips: [
          "bright chords",
          "synth pads",
          "bell",
          "guitar",
          "brass",
          "bright leads",
          "strings",
        ],
      },
      {
        cat: "rhythm",
        label: "RHYTHM",
        hue: "var(--hue-amber)",
        chips: [
          "driving beat",
          "handclaps",
          "shaker",
          "four-on-the-floor",
          "syncopated",
          "groove",
        ],
      },
      {
        cat: "atmosphere",
        label: "VIBE",
        hue: "var(--hue-violet)",
        chips: [
          "uplifting",
          "nostalgic",
          "dreamy",
          "romantic",
          "melancholic",
          "energetic",
          "sweet",
        ],
      },
      {
        cat: "production",
        label: "PRODUCTION",
        hue: "var(--hue-green)",
        chips: [
          "pop polish",
          "radio-ready",
          "wide stereo",
          "crisp mix",
          "bright master",
          "compressed",
        ],
      },
      {
        cat: "energy",
        label: "ENERGY",
        hue: "var(--hue-red)",
        chips: [
          "catchy",
          "bouncy",
          "building",
          "explosive",
          "driving",
          "smooth",
          "powerful",
        ],
      },
    ],
    defaults: [
      { label: "bright chords", cat: "sound", weight: 2 },
      { label: "driving beat", cat: "rhythm", weight: 2 },
      { label: "pop polish", cat: "production", weight: 2 },
      { label: "uplifting", cat: "atmosphere", weight: 2 },
      { label: "catchy", cat: "energy", weight: 2 },
    ],
  },
  dnb: {
    categories: [
      {
        cat: "sound",
        label: "SIGNATURE",
        hue: "var(--hue-cyan)",
        chips: [
          "reese bass",
          "neuro bass",
          "liquid pads",
          "chopped vocal",
          "synth hook",
          "sub bass",
          "amen break",
        ],
      },
      {
        cat: "rhythm",
        label: "DRUMS",
        hue: "var(--hue-amber)",
        chips: [
          "breakbeat",
          "half-time",
          "double-time",
          "rolled snares",
          "shuffled",
          "glitchy hats",
        ],
      },
      {
        cat: "atmosphere",
        label: "MOOD",
        hue: "var(--hue-violet)",
        chips: [
          "dark",
          "liquid",
          "energetic",
          "deep",
          "menacing",
          "soulful",
          "tense",
        ],
      },
      {
        cat: "production",
        label: "PRODUCTION",
        hue: "var(--hue-green)",
        chips: [
          "heavy compression",
          "wide stereo",
          "bass processing",
          "crisp highs",
          "clipping master",
        ],
      },
      {
        cat: "energy",
        label: "ENERGY",
        hue: "var(--hue-red)",
        chips: [
          "high energy",
          "relentless",
          "building",
          "explosive",
          "driving",
          "frenetic",
          "intense",
        ],
      },
    ],
    defaults: [
      { label: "reese bass", cat: "sound", weight: 2 },
      { label: "breakbeat", cat: "rhythm", weight: 2 },
      { label: "heavy compression", cat: "production", weight: 2 },
      { label: "dark", cat: "atmosphere", weight: 2 },
      { label: "high energy", cat: "energy", weight: 2 },
    ],
  },
};

export function getDescriptorDefaults(id: string): GenreDescriptorDefaults {
  return DESCRIPTOR_DATA[id] ?? DESCRIPTOR_DATA.edm!;
}
