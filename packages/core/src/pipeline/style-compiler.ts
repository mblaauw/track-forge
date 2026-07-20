/**
 * Pure-function style compiler — single source of truth for the Suno style prompt.
 *
 * Used by:
 *  - POST /api/preview-style (unsaved sessions)
 *  - POST /api/jobs/:id/preview-style (saved sessions)
 *  - style_writing pipeline stage (via renderers.style)
 *
 * The fixed ordering contract is documented in LOGIC_AND_ALGORITHMS.md § compiledStyle().
 * Changing the order here changes what the UI preview shows AND what the pipeline sends to Suno.
 */

export interface CompileStyleInput {
  genreName: string;
  presetLabels: string[];
  descriptors: { label: string; cat: string; weight: number }[];
  bpm: number;
  key: string;
  scale: "major" | "minor";
  sections: { name: string; fn: string }[];
  lyricsMode: "full_lyrics" | "strict_instrumental";
  vocalType?: string;
}

export interface CompileStyleResult {
  style: string;
  charCount: number;
  activeCount: number;
}

export function compileStylePrompt(
  input: CompileStyleInput,
): CompileStyleResult {
  const active = input.descriptors
    .filter((d) => d.weight > 0)
    .sort((a, b) => b.weight - a.weight);

  const activeCount = active.length;

  if (activeCount === 0) {
    return {
      style: "Add descriptors to compile your style prompt…",
      charCount: 0,
      activeCount: 0,
    };
  }

  const keyLabel = keyLabelFn(input.key, input.scale);
  const core = compileCore(input.genreName, input.presetLabels);
  const rhythmPart = compileRhythm(active, input.bpm, keyLabel);
  const soundPart = compileSound(active);
  const identityPart = compileIdentity(input.lyricsMode, input.vocalType);
  const moodArc = compileMoodArc(active, input.sections);
  const prodPart = compileProduction(active);

  const parts = [core, rhythmPart];

  if (soundPart) parts.push(soundPart);
  if (identityPart) parts.push(identityPart);
  if (moodArc) parts.push(moodArc);
  if (prodPart) parts.push(prodPart);

  const style = parts
    .filter(Boolean)
    .join(". ")
    .replace(/\.{2,}/g, ".")
    .replace(/\.\s*\./g, ".")
    .trim();

  // Ensure trailing period
  const final = style.endsWith(".") ? style : style + ".";

  return { style: final, charCount: final.length, activeCount };
}

/* ── Compile steps ─────────────────────────────────────────────────── */

function compileCore(genreName: string, presetLabels: string[]): string {
  if (presetLabels.length > 0) {
    return `${genreName} — ${presetLabels.join(", ")}`;
  }
  return genreName;
}

function compileRhythm(
  active: { label: string; cat: string }[],
  bpm: number,
  keyLabel: string,
): string {
  const rhythm = active.filter((d) => d.cat === "rhythm").map((d) => d.label);
  const rhythmStr = rhythm.length > 0 ? rhythm.join(", ") : "";

  if (rhythmStr) {
    return `${rhythmStr}, around ${bpm} BPM in ${keyLabel}`;
  }
  return `around ${bpm} BPM in ${keyLabel}`;
}

function compileSound(active: { label: string; cat: string }[]): string | null {
  const sound = active.filter((d) => d.cat === "sound").map((d) => d.label);
  if (sound.length === 0) return null;
  return `built around ${sound.join(", ")}`;
}

function compileIdentity(
  lyricsMode: string,
  vocalType?: string,
): string | null {
  if (lyricsMode === "strict_instrumental") {
    return "instrumental";
  }
  if (vocalType) {
    return `${vocalType} vocals`;
  }
  return null;
}

function compileMoodArc(
  active: { label: string; cat: string }[],
  sections: { name: string; fn: string }[],
): string | null {
  const atmosphere = active
    .filter((d) => d.cat === "atmosphere")
    .map((d) => d.label);
  const energy = active.filter((d) => d.cat === "energy").map((d) => d.label);

  const moodParts: string[] = [];
  if (atmosphere.length > 0) moodParts.push(atmosphere.join(", "));
  if (energy.length > 0) moodParts.push(energy.join(", "));

  const arc = macroArc(sections);
  if (!moodParts.length && !arc) return null;

  const result: string[] = [];
  if (moodParts.length) result.push(moodParts.join(", "));
  if (arc) result.push(arc);

  return result.join("; ");
}

function macroArc(sections: { name: string; fn: string }[]): string | null {
  const peaks = sections.filter(
    (s) => s.fn === "peak" || /drop|chorus|hook/i.test(s.name),
  );

  if (peaks.length >= 2) {
    const label = /drop/i.test(peaks[0]!.name) ? "drops" : "choruses";
    return `gradually builds toward ${peaks.length} increasingly intense ${label}`;
  }
  if (peaks.length === 1) {
    return `builds toward a single climactic ${peaks[0]!.name.toLowerCase()}`;
  }
  return "evolves gradually with a slow-building energy arc";
}

function compileProduction(
  active: { label: string; cat: string }[],
): string | null {
  const prod = active.filter((d) => d.cat === "production").map((d) => d.label);
  if (prod.length === 0) return null;
  return `${prod.join(", ")} production`;
}

/* ── Helpers ───────────────────────────────────────────────────────── */

function keyLabelFn(key: string, scale: "major" | "minor"): string {
  if (!key) return "—";
  return key + (scale === "minor" ? "m" : "");
}
