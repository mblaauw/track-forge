import { type GenreRenderers, capitalize } from "@track-forge/genre-core";
import type { DnbBlueprint } from "./schema.js";

function renderTitle(data: DnbBlueprint): string {
  const parts: string[] = [];

  if (data.mood && data.mood !== "energetic") {
    parts.push(capitalize(data.mood));
  }

  const subgenreLabel = data.subgenre.replace(/_/g, " ");
  parts.push(capitalize(subgenreLabel));

  parts.push(`(${data.key})`);

  return parts.join(" ") || "Untitled";
}

function renderStyle(data: DnbBlueprint): string {
  const clauses: string[] = [];

  const genreLabel = `Drum & Bass — ${data.subgenre.replace(/_/g, " ")}`;
  clauses.push(genreLabel);

  if (data.mood && data.mood !== "energetic") {
    clauses.push(`Mood: ${data.mood}.`);
  }

  clauses.push(`${data.bpm} BPM ${data.key} ${data.scale}.`);

  if (data.energy >= 8) clauses.push("High energy, intense.");
  else if (data.energy <= 4) clauses.push("Low energy, laid back.");

  if (data.complexity >= 8)
    clauses.push("Complex arrangement, intricate breaks.");
  else if (data.complexity <= 3) clauses.push("Minimal arrangement.");

  const sectionNames = data.arrangement
    .map((a: { section: string }) => a.section)
    .join(", ");
  clauses.push(`Structure: ${sectionNames}.`);

  clauses.push("Drum & Bass production.");

  return clauses.join(" ");
}

function renderExcludedStyles(data: DnbBlueprint): string {
  const excludes: string[] = [];

  if (data.energy >= 7) {
    excludes.push("slow", "low energy", "ballad", "soft");
  }
  if (data.energy <= 4) {
    excludes.push("aggressive", "hard", "intense", "fast");
  }
  if (data.complexity >= 7) {
    excludes.push("simple", "basic", "minimalist", "repetitive");
  }
  if (data.complexity <= 3) {
    excludes.push("complex", "busy", "cluttered", "intricate");
  }
  if (data.lyricsMode !== "full_lyrics") {
    excludes.push("vocals", "singing", "lyrics", "voice", "vocal melody");
  }
  if (data.scale === "minor") {
    excludes.push("major key", "happy", "bright");
  } else {
    excludes.push("minor key", "dark", "sad");
  }

  return excludes.join(", ");
}

function renderLyrics(data: DnbBlueprint): string {
  const lines: string[] = [];

  switch (data.lyricsMode) {
    case "strict_instrumental":
      return "";

    case "guided_instrumental": {
      lines.push(`[${data.bpm} BPM]`);
      lines.push(`[Key: ${data.key} ${data.scale}]`);
      lines.push(`[Genre: Drum & Bass — ${data.subgenre.replace(/_/g, " ")}]`);
      lines.push("");

      for (const section of data.arrangement) {
        const tagStr =
          section.tags.length > 0 ? ` — ${section.tags.join(", ")}` : "";
        lines.push(`[${capitalize(section.section)}]${tagStr}`);
        lines.push(`(${section.bars} bars)`);
        lines.push("");
      }
      break;
    }

    case "full_lyrics": {
      lines.push(`[${data.bpm} BPM]`);
      lines.push(`[Key: ${data.key} ${data.scale}]`);
      lines.push(`[Genre: Drum & Bass — ${data.subgenre.replace(/_/g, " ")}]`);
      lines.push("");

      for (const section of data.arrangement) {
        const tagStr =
          section.tags.length > 0 ? ` — ${section.tags.join(", ")}` : "";
        lines.push(`[${capitalize(section.section)}]${tagStr}`);

        if (section.section === "intro") {
          lines.push("(instrumental — atmospheric build)");
        } else if (section.section === "drop") {
          lines.push("(instrumental)");
        } else if (section.section === "break") {
          lines.push("(instrumental — stripped)");
        } else if (section.section === "outro") {
          lines.push("(instrumental — fade)");
        }

        lines.push("");
      }
      break;
    }
  }

  return lines.join("\n").trim();
}

export function createDnbRenderers(): GenreRenderers<DnbBlueprint> {
  return {
    title: renderTitle,
    style: renderStyle,
    excludedStyles: renderExcludedStyles,
    lyrics: renderLyrics,
  };
}
