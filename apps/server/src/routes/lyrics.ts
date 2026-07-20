import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { FastifyInstance } from "fastify";
import type { Db, LlmClient } from "@track-forge/core";
import { buildSunoContext } from "@track-forge/core";
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

    const sunoContext = buildSunoContext({
      genreName: mod.name,
      presetLabels,
      descriptors: body.descriptors ?? [],
      bpm: body.bpm,
      key: body.key ?? "C",
      scale: body.scale as "major" | "minor",
      sections: (body.sections ?? []).map((s) => ({
        section: s.name,
        bars: s.bars ?? 8,
        fn: (s.fn ?? "establish") as
          | "establish"
          | "introduce"
          | "escalate"
          | "contrast"
          | "remove"
          | "peak"
          | "resolve",
        deltas: s.deltas ?? [],
        tags: s.tags ?? [],
        vocal: s.vocal as
          | {
              type: string;
              delivery: string;
              energy: number;
              adlibs: boolean;
              harmonies: boolean;
            }
          | undefined,
      })),
      lyricsMode: body.lyricsMode as
        | "full_lyrics"
        | "strict_instrumental"
        | "guided_instrumental",
      vocalType: body.vocalType ?? undefined,
      lyricTopic: body.lyricTopic ?? "",
      lyricThemes: body.lyricThemes ?? [],
      lyricAngle: body.lyricAngle ?? "",
    });

    const prompt = `You are a songwriter. Write lyrics for this song following the structure and style described below. Return ONLY valid JSON matching this schema:
{"document":{"sections":[{"type":"verse","lines":["line 1","line 2"]}]}}

Context:
${sunoContext}`;

    const PROJECT_ROOT = resolve(process.cwd(), "..");
    writeFileSync(resolve(PROJECT_ROOT, "LLM_IN.md"), prompt);

    const response = await deps.llm.complete({
      messages: [{ role: "user", content: prompt }],
      temperature: 0.8,
      maxTokens: 16384,
    });

    writeFileSync(resolve(PROJECT_ROOT, "LLM_OUT.md"), response.content);

    let lyricsDoc: Record<string, unknown> = { sections: [], metadata: {} };
    try {
      const parsed = JSON.parse(response.content) as Record<string, unknown>;
      if (parsed.document && typeof parsed.document === "object") {
        lyricsDoc = parsed.document as Record<string, unknown>;
      } else if (parsed.sections) {
        lyricsDoc = { sections: parsed.sections, metadata: {} };
      }
    } catch {
      lyricsDoc = {
        sections: [
          {
            type: "verse",
            lines: response.content.split("\n").filter(Boolean),
            bars: 8,
            tags: [],
            instrumental: false,
          },
        ],
        metadata: {},
      };
    }

    return reply.send({ document: lyricsDoc });
  });
}
