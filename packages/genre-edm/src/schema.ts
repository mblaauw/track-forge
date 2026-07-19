import { z } from "zod";
import { createBaseInputSchema } from "@track-forge/genre-core";

export const EdmInputSchema = createBaseInputSchema({
  bpmMin: 80,
  bpmMax: 180,
  extra: {
    subgenre: z.string().min(1, "Select a subgenre"),
    soundscape: z.string(),
  },
});

export type EdmInputs = z.infer<typeof EdmInputSchema>;

export const EDM_DEFAULTS: EdmInputs = {
  subgenre: "progressive_house",
  bpm: 128,
  key: "C",
  scale: "minor",
  mood: "energetic",
  complexity: 7,
  lyricsMode: "full_lyrics",
  soundscape: "bright",
};
