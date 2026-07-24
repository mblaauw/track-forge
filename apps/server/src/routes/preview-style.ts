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

interface StyleCompileFields {
  presetIds?: string[];
  descriptors?: { label: string; cat: string; weight: number }[];
  bpm: number;
  key?: string;
  scale?: string;
  sections?: { name: string; fn?: string }[];
  lyricsMode?: string;
  vocalType?: string | null;
  characteristics?: string[];
  /** HipHop-specific preset fields. */
  flowPattern?: string;
  rhymeStyle?: string;
  narrativeArc?: string;
  vocalStyle?: string;
  typicalSongStructure?: string[];
}

function toCompileStyleInput(
  genreId: string,
  body: StyleCompileFields,
): CompileStyleInput {
  const mod = getModuleOrThrow(genreId);
  const presetIds = body.presetIds ?? [];
  return {
    genreName: mod.name,
    presetLabels:
      mod.presets?.filter((p) => presetIds.includes(p.id)).map((p) => p.name) ??
      [],
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
    characteristics: body.characteristics,
    hipHopFlowPattern: body.flowPattern,
    hipHopRhymeStyle: body.rhymeStyle,
    hipHopNarrativeArc: body.narrativeArc,
    hipHopVocalStyle: body.vocalStyle,
    hipHopTypicalSongStructure: body.typicalSongStructure,
  };
}

export function registerPreviewStyleRoutes(
  server: FastifyInstance,
  deps: PreviewStyleRouteDeps,
): void {
  // ── Unsaved session ────────────────────────────────────────────────────

  server.post("/api/preview-style", async (req, reply) => {
    const body = validateBody(PreviewStyleBody, req);
    const input = toCompileStyleInput(body.genreId, body);
    return reply.send(compileStylePrompt(input));
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

    const input = toCompileStyleInput(job.genreId, body);
    return reply.send(compileStylePrompt(input));
  });
}
