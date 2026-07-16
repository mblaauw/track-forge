import { type GenreRenderers, capitalize } from "@track-forge/genre-core";
import type { PopBlueprint } from "./schema.js";

function renderTitle(data: PopBlueprint): string {
  const parts: string[] = [];

  if (data.mood) {
    parts.push(capitalize(data.mood));
  }

  const subgenreWords = data.subgenre
    .split(/[-\s]/)
    .map((w) => capitalize(w))
    .join(" ");
  parts.push(subgenreWords);

  return parts.join(" ") || "Untitled";
}

function renderStyle(data: PopBlueprint): string {
  const clauses: string[] = [];

  clauses.push(data.subgenre + ", Pop.");

  clauses.push(`${data.bpm} BPM, ${data.key}.`);

  clauses.push(`Mood: ${data.mood}.`);

  clauses.push(`Energy ${data.energy}/10.`);

  if (data.complexity >= 7) clauses.push("Complex arrangement.");
  else if (data.complexity <= 3) clauses.push("Minimal arrangement.");

  const sectionNames = data.arrangement.map((a) => a.section).join(", ");
  clauses.push(`Structure: ${sectionNames}.`);

  return clauses.join(" ");
}

function renderExcludedStyles(data: PopBlueprint): string {
  const excludes: string[] = [];

  if (data.lyricsMode === "instrumental") {
    excludes.push("vocals", "singing", "lyrics", "voice");
  }

  if (data.scale === "minor") {
    excludes.push("major key", "happy", "bright");
  } else {
    excludes.push("minor key", "sad", "dark");
  }

  if (data.energy >= 8) excludes.push("slow", "low energy", "ballad");
  if (data.energy <= 4) excludes.push("aggressive", "intense", "loud");

  return excludes.join(", ");
}

function renderLyrics(data: PopBlueprint): string {
  const lines: string[] = [];

  switch (data.lyricsMode) {
    case "instrumental":
      return "";

    case "hook": {
      lines.push(`[${data.bpm} BPM]`);
      lines.push(`[Key: ${data.key}]`);
      lines.push(`[Genre: ${data.subgenre}]`);
      lines.push("");

      for (const section of data.arrangement) {
        const tagStr =
          section.tags.length > 0 ? `  ${section.tags.join(", ")}` : "";
        lines.push(`[${capitalize(section.section)}]${tagStr}`);
        if (section.section === "chorus") {
          lines.push("(hook)");
        } else {
          lines.push("(instrumental)");
        }
        lines.push("");
      }
      break;
    }

    case "full_lyrics": {
      lines.push(`[${data.bpm} BPM]`);
      lines.push(`[Key: ${data.key}]`);
      lines.push(`[Genre: ${data.subgenre}]`);
      lines.push("");

      for (const section of data.arrangement) {
        const tagStr =
          section.tags.length > 0 ? `  ${section.tags.join(", ")}` : "";
        lines.push(`[${capitalize(section.section)}]${tagStr}`);

        if (section.section === "intro" || section.section === "outro") {
          lines.push("(instrumental)");
        } else if (
          section.section === "verse" ||
          section.section === "chorus" ||
          section.section === "bridge"
        ) {
          lines.push("(write lyrics)");
        } else if (section.section === "pre_chorus") {
          lines.push("(build)");
        }

        lines.push("");
      }
      break;
    }
  }

  return lines.join("\n").trim();
}

export function createPopRenderers(): GenreRenderers<PopBlueprint> {
  return {
    title: renderTitle,
    style: renderStyle,
    excludedStyles: renderExcludedStyles,
    lyrics: renderLyrics,
  };
}
