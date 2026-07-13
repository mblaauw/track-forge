import type { TagCategory } from "@track-forge/genre-core";

export const HIP_HOP_TAG_CATEGORIES: TagCategory[] = [
  {
    id: "genre",
    name: "Genre",
    color: "accent",
    suggestions: [
      "Boom Bap", "Trap", "Lo-fi", "Drill",
      "Grime", "Cloud Rap", "Crunk", "G-Funk",
    ],
  },
  {
    id: "mood",
    name: "Mood",
    color: "amber",
    suggestions: [
      "Hard", "Chill", "Dark", "Hype",
      "Nostalgic", "Soulful", "Aggressive", "Introspective",
    ],
  },
  {
    id: "inst",
    name: "Instruments",
    color: "cyan",
    suggestions: [
      "808 Bass", "Hi-hats", "Snare", "Kick",
      "Sample Chop", "Strings", "Keys", "Brass",
    ],
  },
  {
    id: "prod",
    name: "Production",
    color: "violet",
    suggestions: [
      "Sidechain", "Vinyl Crackle", "Tape Hiss",
      "Heavy 808", "Double Time", "Layering",
      "Reverb", "Delay",
    ],
  },
];
