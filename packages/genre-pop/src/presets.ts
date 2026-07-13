import type { GenrePreset } from "@track-forge/genre-core";
import type { PopInputs } from "./schema.js";

export const POP_PRESETS: GenrePreset[] = [
  {
    id: "synthpop_chart",
    name: "Synth-Pop — Chart",
    description: "Bright, catchy synth-pop with polished production",
    values: {
      subgenre: "Synth-Pop",
      bpm: 116,
      mood: "bright and catchy",
      energy: 7,
      key: "A",
      scale: "major",
      lyricsMode: "full_lyrics",
    } satisfies Partial<PopInputs>,
  },
  {
    id: "dreampop_hazy",
    name: "Dream Pop — Hazy",
    description: "Dreamy and ethereal dream pop with lush textures",
    values: {
      subgenre: "Dream Pop",
      bpm: 96,
      mood: "dreamy and ethereal",
      energy: 5,
      key: "F#",
      scale: "major",
      lyricsMode: "full_lyrics",
    } satisfies Partial<PopInputs>,
  },
  {
    id: "dancepop",
    name: "Dance-Pop — Upbeat",
    description: "Upbeat and danceable dance-pop with energy",
    values: {
      subgenre: "Dance-Pop",
      bpm: 118,
      mood: "upbeat and danceable",
      energy: 8,
      key: "C#",
      scale: "minor",
      lyricsMode: "full_lyrics",
    } satisfies Partial<PopInputs>,
  },
];
