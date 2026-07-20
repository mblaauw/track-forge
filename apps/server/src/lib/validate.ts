import { z } from "zod";
import type { FastifyRequest } from "fastify";
import { ApiError } from "./db-utils.js";

export function validateBody<T>(schema: z.ZodType<T>, req: FastifyRequest): T {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    throw new ApiError(400, `Invalid request body: ${result.error.message}`);
  }
  return result.data;
}

export function validateQuery<T>(schema: z.ZodType<T>, req: FastifyRequest): T {
  const result = schema.safeParse(req.query);
  if (!result.success) {
    throw new ApiError(400, `Invalid query: ${result.error.message}`);
  }
  return result.data;
}

export function validateParams<T>(
  schema: z.ZodType<T>,
  req: FastifyRequest,
): T {
  const result = schema.safeParse(req.params);
  if (!result.success) {
    throw new ApiError(400, `Invalid params: ${result.error.message}`);
  }
  return result.data;
}

// ── Common request shapes ──────────────────────────────────────────────

export const IdParams = z.object({ id: z.string().min(1) });
export const GenreIdParams = z.object({
  id: z.enum(["edm", "hiphop", "ambient"]),
});
export const JobIdParams = z.object({ jobId: z.string().min(1) });
export const PaginationQuery = z.object({
  limit: z.coerce.number().int().positive().max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

// ── Jobs ───────────────────────────────────────────────────────────────

export const CreateJobBody = z.object({
  genreId: z.string().min(1),
  presetId: z.string().min(1),
  inputs: z.record(z.unknown()),
  reference: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
});
export const UpdateJobNameBody = z.object({
  name: z.string().min(1),
});
export const UpdateJobInputsBody = z.object({
  inputs: z.record(z.unknown()).optional(),
  name: z.string().optional(),
});
export const BulkExportBody = z.object({
  ids: z.array(z.string()).optional(),
});
export const PreviewStyleBody = z.object({
  genreId: z.string().min(1),
  presetIds: z.array(z.string()).default([]),
  descriptors: z
    .array(
      z.object({
        label: z.string(),
        cat: z.string(),
        weight: z.number().int().min(0).max(3),
      }),
    )
    .default([]),
  bpm: z.number().int().min(40).max(220),
  key: z.string().default(""),
  scale: z.enum(["major", "minor"]).default("minor"),
  sections: z
    .array(
      z.object({
        name: z.string(),
        fn: z.string().default("establish"),
      }),
    )
    .default([]),
  lyricsMode: z
    .enum(["full_lyrics", "strict_instrumental"])
    .default("strict_instrumental"),
  vocalType: z.string().nullable().optional(),
});
export const JobPreviewStyleBody = z.object({
  presetIds: z.array(z.string()).default([]),
  descriptors: z
    .array(
      z.object({
        label: z.string(),
        cat: z.string(),
        weight: z.number().int().min(0).max(3),
      }),
    )
    .default([]),
  bpm: z.number().int().min(40).max(220),
  key: z.string().default(""),
  scale: z.enum(["major", "minor"]).default("minor"),
  sections: z
    .array(
      z.object({
        name: z.string(),
        fn: z.string().default("establish"),
      }),
    )
    .default([]),
  lyricsMode: z
    .enum(["full_lyrics", "strict_instrumental"])
    .default("strict_instrumental"),
  vocalType: z.string().nullable().optional(),
});
// ── Lyrics generation ──────────────────────────────────────────────────

export const LyricsGenerateBody = z.object({
  genreId: z.string().min(1),
  presetIds: z.array(z.string()).default([]),
  descriptors: z
    .array(
      z.object({
        label: z.string(),
        cat: z.string(),
        weight: z.number().int().min(0).max(3),
      }),
    )
    .default([]),
  bpm: z.number().int().min(40).max(220),
  key: z.string().default("C"),
  scale: z.enum(["major", "minor"]).default("minor"),
  sections: z
    .array(
      z.object({
        name: z.string(),
        bars: z.number().optional(),
        fn: z.string().default("establish"),
        deltas: z.array(z.string()).optional(),
        tags: z.array(z.string()).optional(),
        vocal: z
          .object({
            type: z.string(),
            delivery: z.string(),
            energy: z.number(),
            adlibs: z.boolean(),
            harmonies: z.boolean(),
          })
          .optional(),
      }),
    )
    .default([]),
  lyricsMode: z
    .enum(["full_lyrics", "strict_instrumental"])
    .default("strict_instrumental"),
  vocalType: z.string().nullable().optional(),
  lyricTopic: z.string().default(""),
  lyricThemes: z.array(z.string()).default([]),
  lyricAngle: z.string().default("first_person"),
});

// ── Suno ───────────────────────────────────────────────────────────────

export const SunoCallbackBody = z.record(z.unknown());
