import type { SongIntentV1 } from "./types.js";

/**
 * Empty/default SongIntentV1 — the starting point before preset or user
 * values are applied. Every collection field is empty (not undefined) so
 * downstream stages can iterate without null checks.
 */
export function defaultSongIntent(): SongIntentV1 {
  return {
    schemaVersion: 1,
    identity: { title: "" },
    styles: [],
    musical: {
      characteristics: [],
      descriptors: [],
    },
    vocals: {
      mode: "strict_instrumental",
      sections: [],
    },
    lyrics: {
      themes: [],
      imageAnchors: [],
    },
    arrangement: {
      source: "default",
      sections: [],
    },
    exclusions: [],
    references: [],
  };
}
