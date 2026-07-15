import type { GenrePreset } from "@track-forge/genre-core";
import type { AmbientInputs } from "./schema.js";

export const AMBIENT_PRESETS: GenrePreset[] = [
  {
    id: "drone_minimal",
    name: "Drone — Minimal",
    description:
      "Deep, meditative drone with minimal evolution and sustained tones",
    values: {
      subgenre: "drone",
      bpm: 62,
      key: "C",
      scale: "major",
      mood: "meditative",
      complexity: 3,
      lyricsMode: "strict_instrumental",
      soundscape: "deep drones",
    } satisfies Partial<AmbientInputs>,
  },
  {
    id: "generative",
    name: "Generative — Evolving",
    description: "Slowly evolving generative textures with gentle movement",
    values: {
      subgenre: "generative",
      bpm: 70,
      key: "E",
      scale: "minor",
      mood: "serene",
      complexity: 6,
      lyricsMode: "strict_instrumental",
      soundscape: "evolving textures",
    } satisfies Partial<AmbientInputs>,
  },
];
