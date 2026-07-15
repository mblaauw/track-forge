import { readFileSync } from "node:fs";
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

interface AdjustmentVocabularyYaml {
  styleTerms: string[];
  structureTerms: string[];
  deliveryTerms: string[];
}

interface TagPolicyYaml {
  mandatoryTags: string[];
  forbiddenTags: string[];
  canonicalMap: Record<string, string>;
}

export interface GenreConfigYaml {
  name: string;
  color: string;
  subgenre_count: string;
  defaults: Record<string, unknown>;
  tag_policy: TagPolicyYaml;
  adjustment_vocabulary: AdjustmentVocabularyYaml;
  tag_categories: TagCategoryYaml[];
  presets: GenrePresetYaml[];
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "config");
const GENRE_DIR = join(ROOT, "genres");

const cache = new Map<string, GenreConfigYaml>();

function loadYaml(id: string): GenreConfigYaml {
  const cached = cache.get(id);
  if (cached) return cached;

  const filePath = join(GENRE_DIR, `${id}.yaml`);
  try {
    const raw = readFileSync(filePath, "utf-8");
    const parsed = yaml.load(raw) as GenreConfigYaml;
    cache.set(id, parsed);
    return parsed;
  } catch (err) {
    throw new Error(`Failed to load genre config for "${id}": ${(err as Error).message}`);
  }
}

export function getGenreConfig(id: string): GenreConfigYaml {
  return loadYaml(id);
}

export function listGenreConfigs(): { id: string; name: string; color: string; subgenre_count: string }[] {
  const ids = ["edm", "hiphop", "pop", "ambient", "dnb"];
  return ids.map((id) => {
    const cfg = loadYaml(id);
    return { id, name: cfg.name, color: cfg.color, subgenre_count: cfg.subgenre_count };
  });
}

export function getPresets(id: string): GenrePresetYaml[] {
  return loadYaml(id).presets;
}

export function getTagCategories(id: string): TagCategoryYaml[] {
  return loadYaml(id).tag_categories;
}

export function getDefaults(id: string): Record<string, unknown> {
  return loadYaml(id).defaults;
}

export function getTagPolicy(id: string): TagPolicyYaml {
  return loadYaml(id).tag_policy;
}

export function getAdjustmentVocabulary(id: string): AdjustmentVocabularyYaml {
  return loadYaml(id).adjustment_vocabulary;
}

export function clearCache(): void {
  cache.clear();
}
