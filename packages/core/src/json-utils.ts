export function safeJsonParse<T>(input: string | null | undefined, fallback: T): T {
  if (input == null) return fallback;
  try {
    return JSON.parse(input) as T;
  } catch {
    return fallback;
  }
}

export function readJobInputs(
  json: string | null | undefined,
): Record<string, unknown> {
  return safeJsonParse<Record<string, unknown>>(json ?? "{}", {});
}

export function readFindings<T = unknown>(
  json: string | null | undefined,
): T[] | null {
  if (!json) return null;
  const parsed = safeJsonParse<T[] | null>(json, null);
  return Array.isArray(parsed) ? parsed : null;
}

export function readStageData<T = unknown>(
  json: string | null | undefined,
): T | null {
  return safeJsonParse<T | null>(json, null);
}
