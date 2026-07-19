import type { GenreModule, TagCategory } from "@track-forge/genre-core";
import { edmModule } from "@track-forge/genre-edm";
import { hipHopModule } from "@track-forge/genre-hiphop";
import { ambientModule } from "@track-forge/genre-ambient";
import {
  ALL_GENRE_IDS,
  listGenreConfigs,
  getSongStructure,
  getPresets,
  getTagCategories,
  getTaxonomy,
  getDescriptorDefaults,
} from "./genre-config.js";
const MODULE_IMPORTS: Record<string, GenreModule> = {
  edm: edmModule as GenreModule,
  hiphop: hipHopModule as GenreModule,
  ambient: ambientModule as GenreModule,
};

function augment(id: string, mod: GenreModule): GenreModule {
  return {
    ...mod,
    presets: getPresets(id),
    tagCategories: getTagCategories(id) as TagCategory[],
    songStructure: getSongStructure(id),
    taxonomy: getTaxonomy(id) as Record<string, unknown> | undefined,
  };
}

const MODULES: Record<string, GenreModule> = {};
for (const id of ALL_GENRE_IDS) {
  MODULES[id] = augment(id, MODULE_IMPORTS[id]!);
}

/** Validate genre configs at startup — check all presets against Zod schemas */
export function validateGenreConfigs(logger?: { warn: (msg: string) => void }): void {
  const log = logger ?? console;
  for (const id of ALL_GENRE_IDS) {
    const mod = MODULES[id];
    if (!mod) { log.warn(`Genre ${id}: module not loaded`); continue; }

    const presets = getPresets(id);
    for (const preset of presets) {
      const result = mod.inputSchema.safeParse(preset.values);
      if (!result.success) {
        log.warn(
          `Genre "${id}" preset "${preset.id}" (${preset.name}): validation failed — ${result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
        );
      }
    }

    const dd = getDescriptorDefaults(id);
    const chipsByCat = new Map(dd.categories.map((c) => [c.cat, new Set(c.chips)]));
    for (const def of dd.defaults) {
      const chips = chipsByCat.get(def.cat);
      if (!chips) {
        log.warn(`Genre "${id}" descriptor default "${def.label}" references unknown category "${def.cat}"`);
      } else if (!chips.has(def.label)) {
        log.warn(`Genre "${id}" descriptor default "${def.label}" not found in category "${def.cat}" chips`);
      }
    }
  }
}

export function getModule(genreId: string): GenreModule | undefined {
  return MODULES[genreId];
}

export function getModuleOrThrow(genreId: string): GenreModule {
  const mod = MODULES[genreId];
  if (!mod) throw new Error(`Unknown genre: ${genreId}`);
  return mod;
}

export function listGenres(): {
  id: string;
  name: string;
  color: string;
  subgenre_count: string;
}[] {
  return listGenreConfigs();
}
