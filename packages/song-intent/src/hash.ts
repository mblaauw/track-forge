import { createHash } from "node:crypto";
import type { SongIntentV1 } from "./types.js";

/**
 * Deterministic content hash for a SongIntentV1.
 *
 * The intent is JSON-serialized with a stable key ordering so two
 * semantically-equal intents produce the same hash regardless of
 * field insertion order. This lets us detect "nothing changed" and
 * deduplicate immutable revisions (Phase 7).
 *
 * Algorithm: SHA-256 over `JSON.stringify(intent, stableReplacer)`.
 * `stableReplacer` sorts object keys ascending (top-level and nested).
 *
 * The hash is over the *intent only* — provenance and catalog
 * snapshots are hashed separately by callers if they need them.
 */
export function hashIntent(intent: SongIntentV1): string {
  const serialized = JSON.stringify(intent, stableReplacer);
  return createHash("sha256").update(serialized).digest("hex");
}

function stableReplacer(_key: string, value: unknown): unknown {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    // Sort keys ascending. `null` is also typeof object; the guard above
    // already excludes it via the truthiness + non-array check.
    const sorted: Record<string, unknown> = {};
    for (const k of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[k] = (value as Record<string, unknown>)[k];
    }
    return sorted;
  }
  return value;
}
