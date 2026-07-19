import { createGenreModule } from "@track-forge/genre-core";
import { EdmInputSchema, EDM_DEFAULTS } from "./schema.js";

export const edmModule = createGenreModule({
  id: "edm",
  name: "EDM",
  inputSchema: EdmInputSchema,
  defaults: EDM_DEFAULTS,
});
