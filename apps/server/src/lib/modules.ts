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
    taxonomy: getTaxonomy(id),
  };
}

const MODULES: Record<string, GenreModule> = {};
for (const id of ALL_GENRE_IDS) {
  MODULES[id] = augment(id, MODULE_IMPORTS[id]!);
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
