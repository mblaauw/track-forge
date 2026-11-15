import { useEffect, useState } from "preact/hooks";
import {
  fetchDescriptorDefaults,
  fetchGenres,
  fetchPresets,
  type GenreDescriptorDefaults,
  type GenreInfo,
  type GenrePreset,
} from "../api";

export interface GenreData {
  presets: GenrePreset[];
  vocab: GenreDescriptorDefaults;
}

const RETRY_MS = 2500;

// Genre config is static for the life of the page, so each genre is fetched
// once and shared by every component that needs it.
const cache = new Map<string, Promise<GenreData>>();
let genresPromise: Promise<GenreInfo[]> | null = null;

function load(genreId: string): Promise<GenreData> {
  let entry = cache.get(genreId);
  if (!entry) {
    // Fetched and committed together: presets from one genre must never be
    // paired with another genre's vocabulary.
    entry = Promise.all([
      fetchPresets(genreId),
      fetchDescriptorDefaults(genreId),
    ]).then(([presets, vocab]) => ({ presets, vocab }));
    // A failed load is not cached, so the next attempt fetches again.
    entry.catch(() => cache.delete(genreId));
    cache.set(genreId, entry);
  }
  return entry;
}

/**
 * Presets and vocabulary for a genre; `null` while loading. A failed load
 * (server not up yet, network blip) is retried until it succeeds.
 */
export function useGenreData(genreId: string): GenreData | null {
  const [state, setState] = useState<{ id: string; data: GenreData } | null>(
    null,
  );
  useEffect(() => {
    if (!genreId) return;
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const attempt = () => {
      load(genreId)
        .then((data) => {
          if (live) setState({ id: genreId, data });
        })
        .catch(() => {
          if (live) timer = setTimeout(attempt, RETRY_MS);
        });
    };
    attempt();
    return () => {
      live = false;
      if (timer) clearTimeout(timer);
    };
  }, [genreId]);
  // Never hand back another genre's data while the new one is loading.
  return state && state.id === genreId ? state.data : null;
}

export function useGenres(): GenreInfo[] {
  const [genres, setGenres] = useState<GenreInfo[]>([]);
  useEffect(() => {
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const attempt = () => {
      genresPromise ??= fetchGenres();
      genresPromise
        .then((list) => {
          if (live) setGenres(list);
        })
        .catch(() => {
          genresPromise = null;
          if (live) timer = setTimeout(attempt, RETRY_MS);
        });
    };
    attempt();
    return () => {
      live = false;
      if (timer) clearTimeout(timer);
    };
  }, []);
  return genres;
}
