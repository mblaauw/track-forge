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
export const JobIdParams = z.object({ jobId: z.string().min(1) });
export const JobIdOptionalStageBody = z.object({
  stage: z.string().optional(),
});
export const PaginationQuery = z.object({
  limit: z.coerce.number().int().positive().max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

// ── Projects ───────────────────────────────────────────────────────────

export const CreateProjectBody = z.object({
  name: z.string().min(1, "name required"),
  description: z.string().nullable().optional(),
  genreId: z.string().nullable().optional(),
});
export const UpdateProjectBody = z.object({
  name: z.string().optional(),
  description: z.string().nullable().optional(),
  genreId: z.string().nullable().optional(),
});
export const CreateDraftBody = z.object({
  genreId: z.string().min(1),
  presetId: z.string().min(1),
  inputs: z.string().nullable().optional(),
  reference: z.string().nullable().optional(),
  nlAdjustments: z
    .union([z.string(), z.record(z.unknown())])
    .nullable()
    .optional(),
});
export const UpdateDraftBody = z.object({
  genreId: z.string().optional(),
  presetId: z.string().optional(),
  inputs: z.string().nullable().optional(),
  reference: z.string().nullable().optional(),
  nlAdjustments: z
    .union([z.string(), z.record(z.unknown())])
    .nullable()
    .optional(),
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
export const PatchAdjustmentsBody = z.object({
  nlAdjustments: z.unknown().optional(),
});
export const PatchFindingsBody = z.object({
  findings: z.array(z.unknown()).optional(),
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
    .enum(["full_lyrics", "strict_instrumental", "guided_instrumental"])
    .default("strict_instrumental"),
  vocalType: z.string().nullable().optional(),
});
export const StyleTagSuggestionBody = z.object({
  genreId: z.string().min(1),
  style: z.string().min(1),
  presetId: z.string().optional(),
  reference: z.string().optional(),
  bpm: z.number().optional(),
  key: z.string().optional(),
});

// ── Versions ───────────────────────────────────────────────────────────

export const UpdateArtifactsBody = z.object({
  artifactType: z.string().min(1),
  value: z.string(),
});
export const CreateTakeBody = z.object({
  audioUrl: z.string(),
  duration: z.number().positive(),
  title: z.string().optional(),
});

// ── Suno ───────────────────────────────────────────────────────────────

export const SunoCallbackBody = z.record(z.unknown());
