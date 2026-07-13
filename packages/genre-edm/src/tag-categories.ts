import type { TagCategory } from "@track-forge/genre-core";

export const EDM_TAG_CATEGORIES: TagCategory[] = [
  {
    id: "genre",
    name: "Genre",
    color: "accent",
    suggestions: [
      "Progressive House", "Deep House", "Techno", "Trance",
      "Drum & Bass", "Future Bass", "Dubstep", "Garage",
    ],
  },
  {
    id: "mood",
    name: "Mood",
    color: "amber",
    suggestions: [
      "Euphoric", "Dark", "Dreamy", "Aggressive",
      "Uplifting", "Hypnotic", "Melancholic", "Energetic",
    ],
  },
  {
    id: "inst",
    name: "Instruments",
    color: "cyan",
    suggestions: [
      "Supersaw Lead", "808 Bass", "Piano", "Arp Sequence",
      "Vocal Chops", "Pluck Chords", "Pads", "Strings",
    ],
  },
  {
    id: "prod",
    name: "Production",
    color: "violet",
    suggestions: [
      "Sidechain Pump", "Analog Warmth", "Wide Stereo",
      "Tape Saturation", "Reverb Wash", "Heavy Compression",
      "Filter Sweeps", "Layering",
    ],
  },
];
