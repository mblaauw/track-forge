import type { FastifyInstance } from "fastify";
import type { Db, LlmClient } from "@track-forge/core";
import { writeLyrics } from "@track-forge/core";
import { getModuleOrThrow } from "../lib/modules.js";
import { validateBody, LyricsGenerateBody } from "../lib/validate.js";

export interface LyricsRouteDeps {
  db: Db;
  llm: LlmClient;
}

export function registerLyricsRoutes(
  server: FastifyInstance,
  deps: LyricsRouteDeps,
): void {
  server.post("/api/lyrics/generate", async (req, reply) => {
    const body = validateBody(LyricsGenerateBody, req);
    const mod = getModuleOrThrow(body.genreId);

    const presetLabels =
      mod.presets
        ?.filter((p) => (body.presetIds ?? []).includes(p.id))
        .map((p) => p.name) ?? [];

    const result = await writeLyrics(deps.llm, {
      genreName: mod.name,
      presetLabels,
      bpm: body.bpm,
      key: body.key ?? "C",
      scale: body.scale as "major" | "minor",
      sections: (body.sections ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        bars: s.bars ?? 8,
        fn: s.fn ?? "establish",
        deltas: s.deltas ?? [],
        vocal: s.vocal,
      })),
      lyricTopic: body.lyricTopic,
      lyricThemes: body.lyricThemes,
      lyricAngle: body.lyricAngle,
      lyricsGuidance: mod.lyricsGuidance,
      mood: body.mood,
      energy: body.energy,
      narrativeArc: body.narrativeArc,
      rhymeStyle: body.rhymeStyle,
      flowPattern: body.flowPattern,
      vocalStyle: body.vocalStyle,
      characteristics: body.characteristics,
      tempoFeel: body.tempoFeel,
      perceivedBpm: body.perceivedBpm,
      lineDensity: body.lineDensity,
      perspective: body.perspective,
      imageAnchors: body.imageAnchors,
    });

    return reply.send(result);
  });
}
