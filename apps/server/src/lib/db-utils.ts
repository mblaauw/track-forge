import type { FastifyRequest } from "fastify";
import type { Db } from "@track-forge/core";
import { schema } from "@track-forge/core";
import { eq } from "drizzle-orm";

export class ApiError extends Error {
  readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function findRowOr404(
  db: Db,
  table: any,
  where: any,
  entityName: string,
): Promise<any> {
  const [row] = await db.select().from(table).where(where).limit(1);
  if (!row) throw new ApiError(404, `${entityName} not found`);
  return row;
}

export function safeParse<T>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

export function parsePagination(
  query: Record<string, string | undefined>,
  defaults: { limit?: number; offset?: number; maxLimit?: number } = {},
): { limit: number; offset: number } {
  const def = { limit: 50, offset: 0, maxLimit: 100, ...defaults };
  const parsedLimit = parseInt(query.limit ?? String(def.limit), 10);
  const limit = Math.min(
    parsedLimit > 0 ? parsedLimit : def.limit,
    def.maxLimit,
  );
  const parsedOffset = parseInt(query.offset ?? "0", 10);
  const offset = parsedOffset > 0 ? parsedOffset : def.offset;
  return { limit, offset };
}
