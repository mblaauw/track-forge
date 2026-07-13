import type { GenreModule } from "@track-forge/genre-core";
import { edmModule } from "@track-forge/genre-edm";
import { hipHopModule } from "@track-forge/genre-hiphop";
import { popModule } from "@track-forge/genre-pop";
import { ambientModule } from "@track-forge/genre-ambient";
import { dnbModule } from "@track-forge/genre-dnb";

const MODULES: Record<string, GenreModule> = {
  edm: edmModule as unknown as GenreModule,
  hiphop: hipHopModule as unknown as GenreModule,
  pop: popModule as unknown as GenreModule,
  ambient: ambientModule as unknown as GenreModule,
  dnb: dnbModule as unknown as GenreModule,
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
