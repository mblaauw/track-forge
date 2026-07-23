import { useState } from "preact/hooks";
import {
  MusicNotes,
  Sparkle,
  ArrowClockwise,
  MicrophoneStage,
  Waveform,
  Copy,
  WarningCircle,
} from "@phosphor-icons/react";
import { useSession } from "../../lib/session";
import { sectionColor, sectionIsVocal } from "./arrangement";
import { generateLyrics } from "../../api";
import type { Section } from "./types";

function syl(text: string): number {
  if (!text.trim()) return 0;
  const matches = text.toLowerCase().match(/[aeiouy]+/g);
  return Math.max(1, matches?.length ?? 0);
}

function totalSyllables(lines: Record<string, string[]>): number {
  let total = 0;
  for (const arr of Object.values(lines)) {
    for (const line of arr) total += syl(line);
  }
  return total;
}

function vocalMeta(vocal?: {
  type?: string;
  delivery?: string;
  energy?: number;
  adlibs?: boolean;
  harmonies?: boolean;
}): string {
  if (!vocal) return "";
  const energyWords = [
    "",
    "intimate",
    "restrained",
    "balanced",
    "powerful",
    "explosive",
  ];
  const parts = [vocal.type, vocal.delivery, energyWords[vocal.energy ?? 0]];
  if (vocal.adlibs) parts.push("ad-libs");
  if (vocal.harmonies) parts.push("harmonies");
  return parts.filter(Boolean).join(", ");
}

export function LyricsBlock({ style }: { style: string }) {
  const s = useSession();
  const vocalSections = s.sections.filter(sectionIsVocal);
  const totalSyl = totalSyllables(s.lyricLines);
  const [generating, setGenerating] = useState(false);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sectionsPayload = () =>
    s.sections.map((sec: any) => ({
      id: sec.id,
      name: sec.name,
      bars: sec.bars,
      fn: sec.fn,
      deltas: sec.deltas,
      tags: sec.tags,
      vocal: sec.vocal,
    }));

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const result = await generateLyrics({
        genreId: s.genreId,
        presetIds: s.presetIds,
        descriptors: s.tags
          .filter((t: any) => !t.muted)
          .map((t: any) => ({
            label: t.label,
            cat: t.cat,
            weight: t.weight,
          })),
        bpm: s.bpm as number,
        key: s.key,
        scale: s.scale,
        style,
        sections: sectionsPayload(),
        lyricsMode: s.lyricsMode,
        vocalType: null,
        lyricTopic: s.lyricTopic,
        lyricThemes: s.lyricThemes,
        lyricAngle: s.lyricAngle,
      });

      // Sections are addressed by id — no name matching, no ambiguity for
      // duplicate/numbered section names (e.g. "Verse 1", "Verse 2", two
      // "Hook"s).
      const lines: Record<string, string[]> = {};
      for (const sec of result.sections) {
        lines[sec.id] = sec.lines;
      }

      s.setSession({ lyricsGenerated: true, lyricLines: lines });
    } catch (err) {
      // Never fabricate placeholder lyrics on failure — that content would
      // silently flow into the versioned Suno artifact as if it were real.
      setError(err instanceof Error ? err.message : "Lyrics generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const handleRegenerateSection = async (sec: Section) => {
    setRegeneratingId(sec.id);
    setError(null);
    try {
      const result = await generateLyrics({
        genreId: s.genreId,
        presetIds: s.presetIds,
        descriptors: s.tags
          .filter((t: any) => !t.muted)
          .map((t: any) => ({
            label: t.label,
            cat: t.cat,
            weight: t.weight,
          })),
        bpm: s.bpm as number,
        key: s.key,
        scale: s.scale,
        style,
        sections: [
          {
            id: sec.id,
            name: sec.name,
            bars: sec.bars,
            fn: sec.fn,
            deltas: sec.deltas,
            vocal: sec.vocal,
          },
        ],
        lyricsMode: s.lyricsMode,
        vocalType: null,
        lyricTopic: s.lyricTopic,
        lyricThemes: s.lyricThemes,
        lyricAngle: s.lyricAngle,
      });
      const fresh = result.sections.find((r) => r.id === sec.id);
      if (fresh) {
        const lines = { ...s.lyricLines, [sec.id]: fresh.lines };
        s.setSession({ lyricLines: lines });
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Section regeneration failed",
      );
    } finally {
      setRegeneratingId(null);
    }
  };

  return (
    <div class="bundle-block">
      <div class="bundle-block-header">
        <MusicNotes size={16} style="color:var(--icon-lyrics)" />
        <span class="bundle-block-title">ARRANGEMENT</span>
        {s.lyricsGenerated && (
          <span class="bundle-block-meta">{totalSyl} syllables</span>
        )}
        <div style="margin-left:auto;display:flex;gap:6px">
          {s.lyricsGenerated && (
            <button
              class="arr-action-btn"
              onClick={() => {
                const text = lyricsAsText(s.sections, s.lyricLines);
                navigator.clipboard.writeText(text).catch(() => {});
              }}
            >
              <Copy size={14} /> Copy
            </button>
          )}
          {vocalSections.length > 0 &&
            !s.lyricsGenerated &&
            s.lyricsMode !== "strict_instrumental" && (
              <button
                class="arr-action-btn"
                style="background:var(--forge);color:#fff;border-color:var(--forge)"
                disabled={generating}
                onClick={handleGenerate}
              >
                <Sparkle size={14} />{" "}
                {generating ? "Generating…" : "Generate lyrics"}
              </button>
            )}
          {s.lyricsGenerated && (
            <button
              class="arr-action-btn"
              disabled={generating}
              onClick={handleGenerate}
            >
              <ArrowClockwise size={14} />{" "}
              {generating ? "Generating…" : "Redraft"}
            </button>
          )}
        </div>
      </div>
      <div class="bundle-block-body">
        {error && (
          <div
            class="lyrics-info-box"
            style="margin-bottom:12px;color:var(--danger-text)"
          >
            <WarningCircle size={14} />
            <span>{error}</span>
          </div>
        )}
        {s.lyricsMode === "strict_instrumental" && (
          <div class="lyrics-info-box" style="margin-bottom:12px">
            <Waveform size={14} />
            <span>
              Instrumental — the arrangement structure below uses Suno metatags
              to describe movement. Suno reads these metatags directly.
            </span>
          </div>
        )}
        {s.sections.map((sec) => {
          const isVocal = sectionIsVocal(sec);
          const hue = sectionColor(sec.name);
          return (
            <div class="lyrics-section-block" key={sec.id}>
              <div
                class="lyrics-section-header"
                style={{ background: `${hue}22` }}
              >
                <span style={{ color: hue, fontWeight: 700 }}>
                  [{sec.name}
                  {sec.deltas.length > 0 ? `: ${sec.deltas.join(", ")}` : ""}]
                </span>
              </div>
              {isVocal && sec.vocal && (
                <div class="lyrics-delivery-pill">
                  <MicrophoneStage size={12} style="color:var(--danger-text)" />
                  <span>{vocalMeta(sec.vocal)}</span>
                </div>
              )}
              {s.lyricsGenerated && isVocal && (
                <div style="margin:4px 0 6px">
                  <button
                    class="arr-action-btn"
                    disabled={regeneratingId === sec.id}
                    onClick={() => handleRegenerateSection(sec)}
                  >
                    <ArrowClockwise size={12} />{" "}
                    {regeneratingId === sec.id
                      ? "Regenerating…"
                      : "Regenerate block"}
                  </button>
                </div>
              )}
              {s.lyricsGenerated && (s.lyricLines[sec.id] ?? []).length > 0 ? (
                (s.lyricLines[sec.id] ?? []).map((line, li) => (
                  <div class="lyrics-line-row" key={li}>
                    <span class="lyrics-syl">{syl(line)}</span>
                    <input
                      class="lyrics-line-input"
                      value={line}
                      onInput={(e) => {
                        const lines = { ...s.lyricLines };
                        const arr = [...(lines[sec.id] ?? [])];
                        arr[li] = (e.target as HTMLInputElement).value;
                        lines[sec.id] = arr;
                        s.setSession({ lyricLines: lines });
                      }}
                    />
                  </div>
                ))
              ) : !s.lyricsGenerated &&
                isVocal &&
                s.lyricsMode !== "strict_instrumental" ? (
                <p class="lyrics-not-generated">
                  Lyrics not generated yet. Click Generate above.
                </p>
              ) : null}
            </div>
          );
        })}
        {!s.lyricsGenerated &&
          s.lyricsMode !== "strict_instrumental" &&
          vocalSections.length > 0 && (
            <p class="lyrics-not-generated">
              Generate lyrics from your arrangement, style & lyrical brief.
            </p>
          )}
        {!s.lyricsGenerated &&
          s.lyricsMode !== "strict_instrumental" &&
          vocalSections.length === 0 && (
            <p class="lyrics-not-generated">
              No vocal sections in the arrangement. Add a section with 'vocal
              focus' or a Verse/Chorus/Hook/Drop name.
            </p>
          )}
      </div>
    </div>
  );
}

function lyricsAsText(
  sections: Section[],
  lines: Record<string, string[]>,
): string {
  const blocks: string[] = [];
  for (const sec of sections) {
    const head =
      sec.deltas.length > 0
        ? `[${sec.name}: ${sec.deltas.join(", ")}]`
        : `[${sec.name}]`;
    const secLines = lines[sec.id] ?? [];
    blocks.push(head);
    if (secLines.length > 0) blocks.push(secLines.join("\n"));
    blocks.push("");
  }
  return blocks.join("\n").trim();
}
