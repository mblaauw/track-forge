import { z } from "zod";
import { createBaseInputSchema } from "@track-forge/genre-core";

export const EdmInputSchema = createBaseInputSchema({
  bpmMin: 80,
  bpmMax: 180,
});

export type EdmInputs = z.infer<typeof EdmInputSchema>;

export const EDM_DEFAULTS: EdmInputs = {
  bpm: 128,
  key: "C",
  scale: "minor",
  mood: "energetic",
  complexity: 7,
  lyricsMode: "full_lyrics",
};
