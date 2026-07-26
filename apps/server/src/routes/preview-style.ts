import type { FastifyInstance } from "fastify";
import { compileStylePrompt, schema } from "@track-forge/core";
import { eq } from "drizzle-orm";
import type { CompileStyleInput, Db } from "@track-forge/core";
import { getModuleOrThrow } from "../lib/modules.js";
import { getPresets } from "../lib/genre-config.js";
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
  sections?: { name: string; fn?: string }[];
  lyricsMode?: string;
  vocalType?: string | null;
  characteristics?: string[];
  tempoFeel?: string;
  /** HipHop-specific preset fields. */
  flowPattern?: string;
  rhymeStyle?: string;
  narrativeArc?: string;
  vocalStyle?: string;
  typicalSongStructure?: string[];
  mood?: string;
  energy?: number;
}

function firstPresetValues(
  genreId: string,
  presetIds: string[],
): Record<string, unknown> {
  if (presetIds.length === 0) return {};
  const presets = getPresets(genreId);
  const match = presets.find((p) => presetIds.includes(p.id));
  return (match?.values as Record<string, unknown>) ?? {};
}

function toCompileStyleInput(
  genreId: string,
  body: StyleCompileFields,
): CompileStyleInput {
  const mod = getModuleOrThrow(genreId);
  const presetIds = body.presetIds ?? [];
  // Merge first selected preset values so preview matches pipeline compile
  // (frontend only sends common session fields).
  const pv = firstPresetValues(genreId, presetIds);
  const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);
  const num = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) ? v : undefined;
  const strArr = (v: unknown) =>
    Array.isArray(v) ? (v as unknown[]).map(String) : undefined;

  return {
    genreName: mod.name,
    presetLabels:
      mod.presets?.filter((p) => presetIds.includes(p.id)).map((p) => p.name) ??
      [],
    descriptors: body.descriptors ?? [],
    bpm: body.bpm,
    sections: (body.sections ?? []).map((s) => ({
      name: s.name,
      fn: s.fn ?? "establish",
    })),
    lyricsMode: (body.lyricsMode ??
      "strict_instrumental") as CompileStyleInput["lyricsMode"],
    vocalType: body.vocalType ?? undefined,
    characteristics: body.characteristics ?? strArr(pv.characteristics),
    tempoFeel: body.tempoFeel ?? str(pv.tempoFeel),
    flowPattern: body.flowPattern ?? str(pv.flowPattern),
    presetMood: body.mood ?? str(pv.mood),
    presetEnergy: body.energy ?? num(pv.energy),
    hipHopFlowPattern: body.flowPattern ?? str(pv.flowPattern),
    hipHopRhymeStyle: body.rhymeStyle ?? str(pv.rhymeStyle),
    hipHopNarrativeArc: body.narrativeArc ?? str(pv.narrativeArc),
    hipHopVocalStyle: body.vocalStyle ?? str(pv.vocalStyle),
    hipHopTypicalSongStructure:
      body.typicalSongStructure ?? strArr(pv.typicalSongStructure),
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
