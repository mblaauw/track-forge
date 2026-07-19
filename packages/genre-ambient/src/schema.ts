import { z } from "zod";
import { createBaseInputSchema } from "@track-forge/genre-core";

export const AmbientInputSchema = createBaseInputSchema({
  bpmMin: 40,
  bpmMax: 120,
  extra: {
    subgenre: z.string().min(1, "Select a subgenre"),
    soundscape: z.string(),
  },
});

export type AmbientInputs = z.infer<typeof AmbientInputSchema>;

export const AMBIENT_DEFAULTS: AmbientInputs = {
  subgenre: "ambient_drone",
  bpm: 65,
  key: "C",
  scale: "major",
  mood: "ethereal",
  complexity: 5,
  lyricsMode: "strict_instrumental",
  soundscape: "ethereal",
};
