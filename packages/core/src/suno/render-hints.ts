import { estimateDurationSec } from "@track-forge/contracts";
import { isVocalSection } from "@track-forge/genre-core";
import type { ResolvedSongIntent } from "@track-forge/song-intent";

/** The one voice Suno should hear about, distilled from per-section vocals. */
export interface VocalSummary {
  /** Lower-case vocal type, e.g. "female lead". */
  label?: string;
  /** Lower-case delivery most used by that voice, e.g. "laid back". */
  delivery?: string;
  gender?: "m" | "f";
}

/** Values a take needs that are derived from the song, not chosen per take. */
export interface RenderHints {
  /** Arrangement length in seconds (unclamped). */
  durationSec: number;
  vocalGender?: "m" | "f";
}

type HintSource = Pick<ResolvedSongIntent, "bpm" | "arrangement" | "vocals">;

function normalizeLabel(value: string): string {
  return value.replace(/[·_]+/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
}

function genderOf(label: string): "m" | "f" | undefined {
  const female = /\bfemale\b/.test(label);
  const male = /\bmale\b/.test(label);
  // A label naming both ("male female duet") has no single gender.
  if (female === male) return undefined;
  return female ? "f" : "m";
}

/**
 * Pick the dominant voice across the vocal sections, weighted by bars.
 * v6 treats section tags as hints and follows a vocal described in the
 * style field more reliably, so the style prompt and the `vocalGender`
 * field are both fed from this one summary. A tie (e.g. an even
 * male/female split) yields a label-less, gender-less summary rather
 * than guessing.
 */
export function summarizeVocals(resolved: HintSource): VocalSummary {
  if (resolved.vocals.mode === "strict_instrumental") return {};

  const weight = new Map<string, number>();
  const deliveries = new Map<string, Map<string, number>>();
  for (const s of resolved.arrangement.sections) {
    if (!s.vocal?.type) continue;
    if (!isVocalSection({ name: s.name, deltas: s.deltas ?? [] })) continue;
    const label = normalizeLabel(s.vocal.type);
    if (!label) continue;
    const bars = s.bars > 0 ? s.bars : 1;
    weight.set(label, (weight.get(label) ?? 0) + bars);
    const delivery = normalizeLabel(s.vocal.delivery ?? "");
    if (delivery) {
      const forLabel = deliveries.get(label) ?? new Map<string, number>();
      forLabel.set(delivery, (forLabel.get(delivery) ?? 0) + bars);
      deliveries.set(label, forLabel);
    }
  }

  const ranked = [...weight.entries()].sort((a, b) => b[1] - a[1]);
  if (ranked.length === 0) {
    const fallback = resolved.vocals.type
      ? normalizeLabel(resolved.vocals.type)
      : undefined;
    return fallback ? { label: fallback, gender: genderOf(fallback) } : {};
  }
  if (ranked.length > 1 && ranked[0]![1] === ranked[1]![1]) return {};

  const label = ranked[0]![0];
  const delivery = [...(deliveries.get(label)?.entries() ?? [])].sort(
    (a, b) => b[1] - a[1],
  )[0]?.[0];
  return { label, delivery, gender: genderOf(label) };
}

export function deriveRenderHints(resolved: HintSource): RenderHints {
  return {
    durationSec: estimateDurationSec(
      resolved.bpm,
      resolved.arrangement.sections,
    ),
    vocalGender: summarizeVocals(resolved).gender,
  };
}
