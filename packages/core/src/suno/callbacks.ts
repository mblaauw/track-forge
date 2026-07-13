import type { Config } from "@track-forge/contracts";

/**
 * Resolve a callback URL for Suno to notify us when generation completes.
 *
 * Priority chain:
 *  1. Explicit `sunoCallbackUrl` from config (if we add it later)
 *  2. Derived from `publicBaseUrl` in config
 *  3. `null` → caller uses polling instead
 */
export function resolveCallbackUrl(config: Pick<Config, "publicBaseUrl">): string | null {
  // 1. Explicit callback URL (dedicated field) — not in config schema yet
  //    but we check any custom callback config

  // 2. Derive from public base URL
  if (config.publicBaseUrl) {
    const base = config.publicBaseUrl.replace(/\/+$/, "");
    return `${base}/api/suno/callback`;
  }

  // 3. No callback — polling fallback
  return null;
}


