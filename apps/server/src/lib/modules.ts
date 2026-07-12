import type { GenreModule } from "@track-forge/genre-core";
import { edmModule } from "@track-forge/genre-edm";
import { hipHopModule } from "@track-forge/genre-hiphop";

const MODULES: Record<string, GenreModule> = {
  edm: edmModule as unknown as GenreModule,
  hiphop: hipHopModule as unknown as GenreModule,
};

export function getModule(genreId: string): GenreModule | undefined {
  return MODULES[genreId];
}

export function getModuleOrThrow(genreId: string): GenreModule {
  const mod = MODULES[genreId];
  if (!mod) throw new Error(`Unknown genre: ${genreId}`);
  return mod;
}

export function listGenres(): { id: string; name: string }[] {
  return Object.values(MODULES).map((m) => ({ id: m.id, name: m.name }));
}
