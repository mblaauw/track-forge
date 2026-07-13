import type { TagCategory } from "@track-forge/genre-core";

export const AMBIENT_TAG_CATEGORIES: TagCategory[] = [
  {
    id: "genre",
    name: "Genre",
    color: "accent",
    suggestions: [
      "Ambient Drone",
      "Generative",
      "Dark Ambient",
      "Space Music",
      "Nature Field",
      "Cinematic",
      "Minimalism",
      "Isolationist",
    ],
  },
  {
    id: "mood",
    name: "Mood",
    color: "amber",
    suggestions: [
      "Meditative",
      "Serene",
      "Dark",
      "Peaceful",
      "Melancholic",
      "Ethereal",
      "Hypnotic",
      "Weightless",
    ],
  },
  {
    id: "inst",
    name: "Instruments",
    color: "cyan",
    suggestions: [
      "Pads",
      "Field Recording",
      "Bell Tones",
      "Granular",
      "Tape Loops",
      "Drone",
      "Strings",
      "Piano",
    ],
  },
  {
    id: "prod",
    name: "Production",
    color: "violet",
    suggestions: [
      "Reverb",
      "Delay",
      "Tape Wear",
      "Granular Texture",
      "Slow Modulation",
      "Saturation",
      "Panning",
      "Space Echo",
    ],
  },
];
