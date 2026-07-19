import { createGenreModule } from "@track-forge/genre-core";
import { AmbientInputSchema, AMBIENT_DEFAULTS } from "./schema.js";

export const ambientModule = createGenreModule({
  id: "ambient",
  name: "Ambient",
  inputSchema: AmbientInputSchema,
  defaults: AMBIENT_DEFAULTS,
});
