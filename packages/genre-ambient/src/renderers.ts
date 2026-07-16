import { type GenreRenderers, capitalize } from "@track-forge/genre-core";
import type { AmbientBlueprint } from "./schema.js";

function renderTitle(data: AmbientBlueprint): string {
  const parts: string[] = [];
  if (data.mood && data.mood !== "ethereal") {
    parts.push(capitalize(data.mood));
  }
  parts.push("Ambient");
  if (data.key) {
    parts.push(`(${data.key})`);
  }
  return parts.join(" ") || "Untitled";
}

function renderStyle(data: AmbientBlueprint): string {
  const clauses: string[] = [];
  clauses.push(`Ambient ${data.subgenre.replace(/_/g, " ")}`);
  clauses.push(`Mood: ${data.mood}.`);
  const keyStr = data.key ? ` ${data.key}` : "";
  clauses.push(`${data.bpm} BPM${keyStr} ${data.scale}.`);
  clauses.push(`Soundscape: ${data.soundscape}.`);
  if (data.complexity >= 7) clauses.push("Rich, layered texture.");
  else if (data.complexity <= 3) clauses.push("Sparse, minimal texture.");
  const sectionNames = data.arrangement
    .map((a: { section: string }) => a.section)
    .join(", ");
  clauses.push(`Movement: ${sectionNames}.`);
  return clauses.join(" ");
}

function renderExcludedStyles(data: AmbientBlueprint): string {
  const excludes: string[] = [
    "aggressive",
    "rhythmic",
    "percussive",
    "driving",
    "beat-driven",
    "dance",
    "hard",
  ];
  if (data.complexity >= 7) excludes.push("simple", "basic");
  if (data.complexity <= 3) excludes.push("dense", "cluttered", "busy");
  if (data.lyricsMode !== "full_lyrics")
    excludes.push("vocals", "singing", "lyrics", "voice");
  if (data.scale === "minor") excludes.push("major key", "happy");
  else excludes.push("minor key", "sad");
  return excludes.join(", ");
}

function renderLyrics(data: AmbientBlueprint): string {
  switch (data.lyricsMode) {
    case "strict_instrumental":
      return "";

    case "guided_instrumental": {
      const lines: string[] = [];
      lines.push(`[${data.bpm} BPM]`);
      lines.push(`[Key: ${data.key} ${data.scale}]`);
      lines.push(`[Soundscape: ${data.soundscape}]`);
      lines.push("");
      for (const section of data.arrangement) {
        const tagStr =
          section.tags.length > 0 ? ` — ${section.tags.join(", ")}` : "";
        lines.push(`[${capitalize(section.section)}]${tagStr}`);
        lines.push(`(${section.bars} bars)`);
        lines.push("");
      }
      return lines.join("\n").trim();
    }

    case "full_lyrics": {
      const lines: string[] = [];
      lines.push(`[${data.bpm} BPM]`);
      lines.push(`[Key: ${data.key} ${data.scale}]`);
      lines.push(`[Soundscape: ${data.soundscape}]`);
      lines.push("");
      for (const section of data.arrangement) {
        const tagStr =
          section.tags.length > 0 ? ` — ${section.tags.join(", ")}` : "";
        lines.push(`[${capitalize(section.section)}]${tagStr}`);
        lines.push("(instrumental — textural)");
        lines.push("");
      }
      return lines.join("\n").trim();
    }
    default:
      return "";
  }
}

export function createAmbientRenderers(): GenreRenderers<AmbientBlueprint> {
  return {
    title: renderTitle,
    style: renderStyle,
    excludedStyles: renderExcludedStyles,
    lyrics: renderLyrics,
  };
}
