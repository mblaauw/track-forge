import type { TagCategory } from "@track-forge/genre-core";

export const POP_TAG_CATEGORIES: TagCategory[] = [
  {
    id: "genre",
    name: "Genre",
    color: "accent",
    suggestions: [
      "Synth-Pop",
      "Dream Pop",
      "Dance-Pop",
      "Indie Pop",
      "Art Pop",
      "Power Pop",
      "Electropop",
      "Bubblegum",
    ],
  },
  {
    id: "mood",
    name: "Mood",
    color: "amber",
    suggestions: [
      "Catchy",
      "Dreamy",
      "Upbeat",
      "Sweet",
      "Melancholic",
      "Bright",
      "Hazy",
      "Emotional",
    ],
  },
  {
    id: "inst",
    name: "Instruments",
    color: "cyan",
    suggestions: [
      "Synth",
      "Guitar",
      "Piano",
      "Strings",
      "Drum Machine",
      "Bass",
      "Vocals",
      "Pads",
    ],
  },
  {
    id: "prod",
    name: "Production",
    color: "violet",
    suggestions: [
      "Polished",
      "Reverb",
      "Compression",
      "Layering",
      "Gated Reverb",
      "Wide Stereo",
      "Tape Saturation",
      "Chorus",
    ],
  },
];
