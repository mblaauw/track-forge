import type { LyricsDocument, LyricsSection, PatchType, SurgicalPatch } from "@track-forge/contracts";

// ── Patch data shapes ───────────────────────────────────────────────────

interface ReplaceSectionData {
  index: number;
  section: LyricsSection;
}

interface InsertSectionData {
  index: number;
  section: LyricsSection;
}

interface MergeSectionLinesData {
  index: number;
  lines: string[];
}

interface ChangeSectionBarsData {
  index: number;
  bars: number;
}

interface ChangeSectionTagsData {
  index: number;
  tags: string[];
}

type LyricsPatchData =
  | ReplaceSectionData
  | InsertSectionData
  | MergeSectionLinesData
  | ChangeSectionBarsData
  | ChangeSectionTagsData;

// ── Patcher ─────────────────────────────────────────────────────────────

const LYRICS_SECTION_TYPES: ReadonlySet<PatchType> = new Set([
  "replace_section" as PatchType,
  "insert_section" as PatchType,
  "merge_section_lines" as PatchType,
  "change_section_bars" as PatchType,
  "change_section_tags" as PatchType,
]);

/** Check if a patch type targets lyrics sections */
export function isLyricsSectionPatch(type: PatchType): boolean {
  return LYRICS_SECTION_TYPES.has(type);
}

/**
 * Apply a single lyrics section patch to a compiled lyrics JSON string.
 * Returns the patched JSON string, or the original if parsing/patching fails.
 */
export function applyLyricsPatch(
  lyricsJson: string,
  patch: SurgicalPatch,
): string {
  if (!isLyricsSectionPatch(patch.type)) return lyricsJson;

  let doc: LyricsDocument;
  try {
    doc = JSON.parse(lyricsJson) as LyricsDocument;
  } catch {
    return lyricsJson;
  }

  let data: LyricsPatchData;
  try {
    data = JSON.parse(patch.value) as LyricsPatchData;
  } catch {
    return lyricsJson;
  }

  try {
    switch (patch.type) {
      case "replace_section": {
        const d = data as ReplaceSectionData;
        if (d.index < 0 || d.index >= doc.sections.length) return lyricsJson;
        doc.sections[d.index] = d.section;
        break;
      }
      case "insert_section": {
        const d = data as InsertSectionData;
        const idx = Math.min(d.index, doc.sections.length);
        doc.sections.splice(idx, 0, d.section);
        break;
      }
      case "merge_section_lines": {
        const d = data as MergeSectionLinesData;
        if (d.index < 0 || d.index >= doc.sections.length) return lyricsJson;
        const section = doc.sections[d.index]!;
        section.lines = [...section.lines, ...d.lines];
        break;
      }
      case "change_section_bars": {
        const d = data as ChangeSectionBarsData;
        if (d.index < 0 || d.index >= doc.sections.length) return lyricsJson;
        doc.sections[d.index]!.bars = d.bars;
        break;
      }
      case "change_section_tags": {
        const d = data as ChangeSectionTagsData;
        if (d.index < 0 || d.index >= doc.sections.length) return lyricsJson;
        doc.sections[d.index]!.tags = d.tags;
        break;
      }
      default:
        return lyricsJson;
    }
  } catch {
    return lyricsJson;
  }

  return JSON.stringify(doc);
}
