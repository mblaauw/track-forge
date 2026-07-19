import { createGenreModule } from "@track-forge/genre-core";
import { HipHopInputSchema, HIP_HOP_DEFAULTS } from "./schema.js";

export const hipHopModule = createGenreModule({
  id: "hiphop",
  name: "Hip-Hop",
  inputSchema: HipHopInputSchema,
  defaults: HIP_HOP_DEFAULTS,
});
