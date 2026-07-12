import type { GenreRenderers } from "@track-forge/genre-core";
import type { EdmBlueprint } from "./schema.js";
import type { EdmSubgenreEntry } from "./taxonomy.js";

// ── Title renderer ────────────────────────────────────────────────────

function renderTitle(data: EdmBlueprint): string {
  const parts: string[] = [];

  if (data.mood && data.mood !== "energetic") {
    parts.push(capitalize(data.mood));
  }

  const subgenreLabel = data.subgenre.replace(/_/g, " ");
  parts.push(capitalize(subgenreLabel));

  if (data.key !== "auto") {
    parts.push(`(${data.key})`);
  }

  return parts.join(" ") || "Untitled";
}

// ── Style renderer ────────────────────────────────────────────────────

function renderStyle(
  data: EdmBlueprint,
  subgenreEntry?: EdmSubgenreEntry,
): string {
  const clauses: string[] = [];

  // Genre anchor
  clauses.push(subgenreEntry?.description ?? data.subgenre.replace(/_/g, " "));

  // Mood prefix
  if (data.mood && data.mood !== "energetic") {
    clauses.push(`Mood: ${data.mood}.`);
  }

  // BPM & Key
  const keyStr = data.key !== "auto" ? data.key : "";
  const keyPart = keyStr ? ` ${keyStr}` : "";
  clauses.push(`${data.bpm} BPM${keyPart}.`);

  // Characteristics from taxonomy
  if (subgenreEntry?.characteristics.length) {
    const traits = subgenreEntry.characteristics.slice(0, 5).join(", ");
    clauses.push(`${capitalize(traits)}.`);
  }

  // Energy & complexity
  if (data.energy >= 8) clauses.push("High energy.");
  else if (data.energy <= 4) clauses.push("Low energy, laid back.");

  if (data.complexity >= 8) clauses.push("Complex arrangement.");
  else if (data.complexity <= 3) clauses.push("Minimal arrangement.");

  // Arrangement cues
  const sectionNames = data.arrangement.map((a) => a.section).join(", ");
  clauses.push(`Structure: ${sectionNames}.`);

  return clauses.join(" ");
}

// ── Excluded Styles renderer ──────────────────────────────────────────

function renderExcludedStyles(data: EdmBlueprint): string {
  const excludes: string[] = [];

  // Exclude opposite characteristics based on subgenre traits
  if (data.energy >= 7) {
    excludes.push("slow", "low energy", "ballad");
  }
  if (data.energy <= 4) {
    excludes.push("aggressive", "hard", "intense");
  }
  if (data.complexity >= 7) {
    excludes.push("simple", "basic", "minimalist");
  }
  if (data.complexity <= 3) {
    excludes.push("complex", "busy", "cluttered");
  }
  if (data.lyricsMode !== "full_lyrics") {
    excludes.push("vocals", "singing", "lyrics", "voice");
  }
  if (data.scale === "minor") {
    excludes.push("major key", "happy");
  } else {
    excludes.push("minor key", "sad");
  }

  return excludes.join(", ");
}

// ── Lyrics renderer ───────────────────────────────────────────────────

function renderLyrics(data: EdmBlueprint): string {
  const lines: string[] = [];

  switch (data.lyricsMode) {
    case "strict_instrumental":
      // Suno's instrumental:true omits the prompt entirely — render empty
      return "";

    case "guided_instrumental": {
      // Instrumental arrangement tags
      lines.push(`[${data.bpm} BPM]`);
      lines.push(`[Key: ${data.key !== "auto" ? data.key : "determined by generation"}]`);
      if (data.subgenre) {
        lines.push(`[Genre: ${data.subgenre.replace(/_/g, " ")}]`);
      }
      lines.push("");

      for (const section of data.arrangement) {
        const tagStr = section.tags.length > 0
          ? ` — ${section.tags.join(", ")}`
          : "";
        lines.push(`[${capitalize(section.section)}]${tagStr}`);
        lines.push(`(${section.bars} bars)`);
        lines.push("");
      }
      break;
    }

    case "full_lyrics": {
      // Full lyrics structure with section markers
      lines.push(`[${data.bpm} BPM]`);
      lines.push(`[Key: ${data.key !== "auto" ? data.key : "determined by generation"}]`);
      lines.push(`[Genre: ${data.subgenre.replace(/_/g, " ")}]`);
      lines.push("");

      for (const section of data.arrangement) {
        const tagStr = section.tags.length > 0
          ? ` — ${section.tags.join(", ")}`
          : "";
        lines.push(`[${capitalize(section.section)}]${tagStr}`);

        // If it's a verse/chorus section, suggest lyrical content
        if (section.section.includes("intro") || section.section.includes("build")) {
          lines.push("(instrumental)");
        } else if (section.section.includes("drop")) {
          lines.push("(instrumental)");
        } else if (section.section.includes("breakdown") || section.section.includes("bridge")) {
          lines.push("(instrumental — atmospheric)");
        } else if (section.section.includes("outro")) {
          lines.push("(instrumental)");
        }

        lines.push("");
      }
      break;
    }
  }

  return lines.join("\n").trim();
}

// ── Exported renderers ────────────────────────────────────────────────

export function createEdmRenderers(
  subgenreEntry?: EdmSubgenreEntry,
): GenreRenderers<EdmBlueprint> {
  return {
    title: renderTitle,
    style: (data) => renderStyle(data, subgenreEntry),
    excludedStyles: renderExcludedStyles,
    lyrics: renderLyrics,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
