import type { FastifyInstance } from "fastify";
import { compileStylePrompt, schema } from "@track-forge/core";
import { eq } from "drizzle-orm";
import type { CompileStyleInput, Db } from "@track-forge/core";
import { getModuleOrThrow } from "../lib/modules.js";
import { findRowOr404 } from "../lib/db-utils.js";
import {
  validateBody,
  validateParams,
  IdParams,
  PreviewStyleBody,
  JobPreviewStyleBody,
} from "../lib/validate.js";

export interface PreviewStyleRouteDeps {
  db: Db;
}

export function registerPreviewStyleRoutes(
  server: FastifyInstance,
  deps: PreviewStyleRouteDeps,
): void {
  // ── Unsaved session ────────────────────────────────────────────────────

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

  // ── Saved session ──────────────────────────────────────────────────────

  server.post("/api/jobs/:id/preview-style", async (req, reply) => {
    const { id } = validateParams(IdParams, req);
    const body = validateBody(JobPreviewStyleBody, req);

    const job = await findRowOr404(
      deps.db,
      schema.jobs,
      eq(schema.jobs.id, id),
      "Job",
    );
    const mod = getModuleOrThrow(job.genreId);

    const input: CompileStyleInput = {
      genreName: mod.name,
      presetLabels:
        mod.presets
          ?.filter((p) => (body.presetIds ?? []).includes(p.id))
          .map((p) => p.name) ?? [],
      descriptors: body.descriptors ?? [],
      bpm: body.bpm,
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
