import type { FastifyInstance } from "fastify";
import { compileStylePrompt } from "@track-forge/core";
import type { CompileStyleInput } from "@track-forge/core";
import { getModuleOrThrow } from "../lib/modules.js";
import { validateBody, PreviewStyleBody } from "../lib/validate.js";

export function registerPreviewStyleRoutes(server: FastifyInstance): void {
  server.post("/api/preview-style", async (req, reply) => {
    const body = validateBody(PreviewStyleBody, req);
    const mod = getModuleOrThrow(body.genreId);

    const input: CompileStyleInput = {
      genreName: mod.name,
      presetLabels:
        mod.presets
          ?.filter((p) => body.presetIds!.includes(p.id))
          .map((p) => p.name) ?? [],
      descriptors: body.descriptors ?? [],
      bpm: body.bpm!,
      key: body.key ?? "",
      scale: (body.scale ?? "minor") as "major" | "minor",
      sections: (body.sections ?? []).map((s) => ({
        name: s.name,
        fn: s.fn ?? "establish",
      })),
      lyricsMode: (body.lyricsMode ??
        "strict_instrumental") as CompileStyleInput["lyricsMode"],
      vocalType: body.vocalType ?? undefined,
    };

    const result = compileStylePrompt(input);
    return reply.send(result);
  });
}
