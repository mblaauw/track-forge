import type { GenrePreset } from "@track-forge/genre-core";
import type { DnbInputs } from "./schema.js";

export const DNB_PRESETS: GenrePreset[] = [
  {
    id: "liquid_soulful",
    name: "Liquid — Soulful",
    description: "Melodic, soulful liquid D&B with warm bass and smooth breaks",
    values: {
      subgenre: "liquid_funk",
      bpm: 174,
      key: "A",
      scale: "minor",
      mood: "soulful and melodic",
      energy: 7,
      complexity: 6,
      lyricsMode: "full_lyrics",
    } satisfies Partial<DnbInputs>,
  },
  {
    id: "neurofunk_dark",
    name: "Neurofunk — Dark",
    description: "Dark, techy neurofunk with complex bass and sci-fi atmospheres",
    values: {
      subgenre: "neurofunk",
      bpm: 174,
      key: "F",
      scale: "minor",
      mood: "dark and techy",
      energy: 9,
      complexity: 8,
      lyricsMode: "strict_instrumental",
    } satisfies Partial<DnbInputs>,
  },
];
