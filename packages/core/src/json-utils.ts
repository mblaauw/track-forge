export function safeJsonParse<T>(
  input: string | null | undefined,
  fallback: T,
): T {
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
