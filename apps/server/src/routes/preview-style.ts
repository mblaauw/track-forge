import type { FastifyInstance } from "fastify";
import { renderSunoStyle, schema } from "@track-forge/core";
import {
  materializeIntent,
  resolveSongIntent,
  type PresetCatalog,
  type StyleInfluence,
} from "@track-forge/song-intent";
import { eq } from "drizzle-orm";
import type { Db } from "@track-forge/core";
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
  sections?: {
    name: string;
    fn?: string;
    bars?: number;
    deltas?: string[];
    vocal?: Record<string, unknown>;
  }[];
  lyricsMode?: string;
  vocalType?: string | null;
  characteristics?: string[];
  tempoFeel?: string;
  flowPattern?: string;
  rhymeStyle?: string;
  narrativeArc?: string;
  vocalStyle?: string;
  typicalSongStructure?: string[];
  excludedStyles?: string;
  mood?: string;
  energy?: number;
}

function buildCatalog(genreId: string): PresetCatalog {
  const loaded = getPresets(genreId);
  const map = new Map(loaded.map((p) => [p.id, p]));
  return {
    getPreset(_gid: string, pid: string) {
      const p = map.get(pid);
      return p
        ? { name: p.name, values: p.values as Record<string, unknown> }
        : undefined;
    },
  };
}

function compilePreview(
  genreId: string,
  body: StyleCompileFields,
): ReturnType<typeof renderSunoStyle> & { exclusions: string[] } {
  const presetIds = body.presetIds ?? [];
  const catalog = buildCatalog(genreId);
  const selectedStyles: StyleInfluence[] = presetIds.map((pid, i) => ({
    genreId,
    presetId: pid,
    role: i === 0 ? "primary" : "influence",
    strength: 3,
  }));
  const userValues: Record<string, unknown> = {
    bpm: body.bpm,
    mood: body.mood,
    energy: body.energy,
    lyricsMode: body.lyricsMode,
    vocalType: body.vocalType,
    characteristics: body.characteristics,
    tempoFeel: body.tempoFeel,
    flowPattern: body.flowPattern,
    rhymeStyle: body.rhymeStyle,
    narrativeArc: body.narrativeArc,
    vocalStyle: body.vocalStyle,
    typicalSongStructure: body.typicalSongStructure,
    excludedStyles: body.excludedStyles,
    descriptors: body.descriptors as unknown[] | undefined,
    sections: body.sections?.map((s, i) => ({
      id: `preview-${i}`,
      name: s.name,
      bars: s.bars ?? 0,
      fn: s.fn ?? "establish",
      deltas: s.deltas ?? [],
      tags: [],
      vocal: s.vocal,
    })) as unknown[] | undefined,
  };
  const materialized = materializeIntent(
    // These are flat job-input fields, so they go in as `userFlat` — the
    // same path the create-job route uses. Passed as typed `userValues`
    // they are silently ignored and the preview shows the bare preset.
    { selectedStyles, userValues: {}, userFlat: userValues },
    catalog,
  );
  const resolved = resolveSongIntent(materialized);
  const mod = getModuleOrThrow(genreId);
  resolved.genreName = mod.name;
  resolved.presetLabels = presetIds
    .map((pid) => mod.presets?.find((p) => p.id === pid)?.name ?? "")
    .filter(Boolean);
  // The exclusions are part of what reaches Suno (as negative tags) and
  // the resolver adds to them — e.g. vocals for an instrumental — so the
  // preview reports the resolved list rather than echoing the input.
  return { ...renderSunoStyle(resolved), exclusions: resolved.exclusions };
}

export function registerPreviewStyleRoutes(
  server: FastifyInstance,
  deps: PreviewStyleRouteDeps,
): void {
  server.post("/api/preview-style", async (req, reply) => {
    const body = validateBody(PreviewStyleBody, req);
    return reply.send(compilePreview(body.genreId, body));
  });

  server.post("/api/jobs/:id/preview-style", async (req, reply) => {
    const { id } = validateParams(IdParams, req);
    const body = validateBody(JobPreviewStyleBody, req);
    const job = await findRowOr404(
      deps.db,
      schema.jobs,
      eq(schema.jobs.id, id),
      "Job",
    );
    return reply.send(compilePreview(job.genreId, body));
  });
}
