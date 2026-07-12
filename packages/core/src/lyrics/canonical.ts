import type { LyricsDocument, LyricsSection, SectionType } from "@track-forge/contracts";

// ── Regex patterns ────────────────────────────────────────────────────

const METADATA_BPM = /^\[(\d+)\s*(?:BPM|bpm)\]$/;
const METADATA_KEY = /^\[Key:\s*(.+)\]$/;
const METADATA_GENRE = /^\[Genre:\s*(.+)\]$/;
const SECTION_HEADER = /^\[([^\]]+?)(?:\s*[—–]\s*(.+))?\]$/;
const BAR_COUNT = /^\((\d+)\s*(?:bars?|bar)\)$/;
const NOTE_LINE = /^\((.+)\)$/;

// ── Section type resolution ───────────────────────────────────────────

const TYPE_MAP: Record<string, SectionType> = {
  intro: "intro",
  verse: "verse",
  "pre-chorus": "pre_chorus",
  "pre chorus": "pre_chorus",
  prechorus: "pre_chorus",
  chorus: "chorus",
  hook: "hook",
  "post-chorus": "post_chorus",
  "post chorus": "post_chorus",
  postchorus: "post_chorus",
  bridge: "bridge",
  breakdown: "breakdown",
  build: "build",
  "build-up": "build",
  buildup: "build",
  drop: "drop",
  solo: "solo",
  break: "break",
  outro: "outro",
  interlude: "interlude",
};

function resolveSectionType(name: string): SectionType {
  const normalized = name.toLowerCase().trim();
  return TYPE_MAP[normalized] ?? "verse";
}

// ── Parser ────────────────────────────────────────────────────────────

export function parseLyrics(input: string): LyricsDocument {
  const lines = input.split("\n");
  const meta: Record<string, string> = {};
  const sections: LyricsSection[] = [];
  let currentSection: LyricsSection | null = null;

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line) continue;

    // Metadata: [120 BPM]
    const bpmMatch = line.match(METADATA_BPM);
    if (bpmMatch) {
      meta.bpm = bpmMatch[1]!;
      continue;
    }

    // Metadata: [Key: Cm]
    const keyMatch = line.match(METADATA_KEY);
    if (keyMatch) {
      meta.key = keyMatch[1]!.trim();
      continue;
    }

    // Metadata: [Genre: deep house]
    const genreMatch = line.match(METADATA_GENRE);
    if (genreMatch) {
      meta.genre = genreMatch[1]!.trim();
      continue;
    }

    // Section header: [Verse] or [Verse — energetic, driving]
    const sectionMatch = line.match(SECTION_HEADER);
    if (sectionMatch) {
      if (currentSection) sections.push(currentSection);

      const sectionName = sectionMatch[1]!.trim();
      const tagsRaw = sectionMatch[2];
      const tags = tagsRaw ? tagsRaw.split(",").map((t) => t.trim()) : [];

      currentSection = {
        type: resolveSectionType(sectionName),
        label: sectionName,
        lines: [],
        bars: 0,
        tags,
        instrumental: false,
      };
      continue;
    }

    if (!currentSection) continue;

    // Bar count: (8 bars)
    const barMatch = line.match(BAR_COUNT);
    if (barMatch) {
      currentSection.bars = parseInt(barMatch[1]!, 10);
      continue;
    }

    // Note: (instrumental)
    const noteMatch = line.match(NOTE_LINE);
    if (noteMatch) {
      const note = noteMatch[1]!.toLowerCase();
      if (note.includes("instrumental")) {
        currentSection.instrumental = true;
      }
      continue;
    }

    // Plain text → lyric line
    currentSection.lines.push(line);
  }

  if (currentSection) sections.push(currentSection);

  // Build bpm/key/genre from metadata
  const bpmVal = meta.bpm ? parseInt(meta.bpm, 10) : undefined;

  return {
    bpm: bpmVal,
    key: meta.key,
    genre: meta.genre,
    sections,
    metadata: meta,
  };
}

// ── Serializer ────────────────────────────────────────────────────────

export function serializeLyrics(doc: LyricsDocument): string {
  const lines: string[] = [];

  // Metadata header
  if (doc.bpm != null) lines.push(`[${doc.bpm} BPM]`);
  if (doc.key != null) lines.push(`[Key: ${doc.key}]`);
  if (doc.genre != null) lines.push(`[Genre: ${doc.genre}]`);

  if (lines.length > 0) lines.push("");

  // Sections
  for (let i = 0; i < doc.sections.length; i++) {
    const section = doc.sections[i]!;

    const header = section.tags.length > 0
      ? `[${section.label ?? capitalize(section.type)} — ${section.tags.join(", ")}]`
      : `[${section.label ?? capitalize(section.type)}]`;
    lines.push(header);

    if (section.bars > 0) {
      lines.push(`(${section.bars} bars)`);
    }

    if (section.instrumental && section.lines.length === 0) {
      lines.push("(instrumental)");
    }

    for (const lyricLine of section.lines) {
      lines.push(lyricLine);
    }

    // Blank line between sections (not after last)
    if (i < doc.sections.length - 1) lines.push("");
  }

  return lines.join("\n");
}

// ── Utility: check if doc represents an instrumental track ────────────

export function isInstrumental(doc: LyricsDocument): boolean {
  return doc.sections.every((s) => s.instrumental || s.lines.length === 0);
}

// ── Helpers ───────────────────────────────────────────────────────────

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
