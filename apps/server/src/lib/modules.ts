import type { GenreModule } from "@track-forge/genre-core";
import { edmModule } from "@track-forge/genre-edm";
import { hipHopModule } from "@track-forge/genre-hiphop";
import { popModule } from "@track-forge/genre-pop";
import { ambientModule } from "@track-forge/genre-ambient";
import { dnbModule } from "@track-forge/genre-dnb";
import { listGenreConfigs, getSongStructure, getPresets, getTagCategories, getTaxonomy } from "./genre-config.js";

function augment(id: string, mod: GenreModule): GenreModule {
  return {
    ...mod,
    presets: getPresets(id),
    tagCategories: getTagCategories(id) as any,
    songStructure: getSongStructure(id),
    taxonomy: getTaxonomy(id),
  };
}

const MODULES: Record<string, GenreModule> = {
  edm: augment("edm", edmModule as unknown as GenreModule),
  hiphop: augment("hiphop", hipHopModule as unknown as GenreModule),
  pop: augment("pop", popModule as unknown as GenreModule),
  ambient: augment("ambient", ambientModule as unknown as GenreModule),
  dnb: augment("dnb", dnbModule as unknown as GenreModule),
};

export function getModule(genreId: string): GenreModule | undefined {
  return MODULES[genreId];
}

export function getModuleOrThrow(genreId: string): GenreModule {
  const mod = MODULES[genreId];
  if (!mod) throw new Error(`Unknown genre: ${genreId}`);
  return mod;
}

export function listGenres(): { id: string; name: string; color: string; subgenre_count: string }[] {
  return listGenreConfigs();
}
