import type { TagCategory } from "@track-forge/genre-core";

export const DNB_TAG_CATEGORIES: TagCategory[] = [
  {
    id: "genre",
    name: "Genre",
    color: "accent",
    suggestions: [
      "Liquid", "Neurofunk", "Jungle", "Jump Up",
      "Techstep", "Deep", "Minimal", "Dancefloor",
    ],
  },
  {
    id: "mood",
    name: "Mood",
    color: "amber",
    suggestions: [
      "Aggressive", "Soulful", "Dark", "Energetic",
      "Hypnotic", "Smooth", "Intense", "Rolling",
    ],
  },
  {
    id: "inst",
    name: "Instruments",
    color: "cyan",
    suggestions: [
      "Reese Bass", "Breaks", "Sub Bass", "Amen Break",
      "Synth", "Pad", "Vocal Sample", "Percussion",
    ],
  },
  {
    id: "prod",
    name: "Production",
    color: "violet",
    suggestions: [
      "Heavy Compression", "Sidechain", "Distortion", "Layering",
      "Filter Sweeps", "Reverb", "Tight Mix", "Phaser",
    ],
  },
];
