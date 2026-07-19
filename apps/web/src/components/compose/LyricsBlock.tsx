import {
  MusicNotes,
  Sparkle,
  ArrowClockwise,
  MicrophoneStage,
  Waveform,
  Copy,
} from "@phosphor-icons/react";
import { useSession } from "../../lib/session";
import type { Section } from "./types";

function sectionHue(name: string): string {
  const map: Record<string, string> = {
    intro: "var(--hue-slate)",
    outro: "var(--hue-slate)",
    build: "var(--hue-amber)",
    swell: "var(--hue-amber)",
    "pre-chorus": "var(--hue-amber)",
    drop: "var(--hue-green)",
    hook: "var(--hue-green)",
    chorus: "var(--hue-green)",
    breakdown: "var(--hue-violet)",
    bridge: "var(--hue-violet)",
    verse: "var(--hue-cyan)",
    groove: "var(--hue-cyan)",
    "movement i": "var(--hue-cyan)",
    "movement ii": "var(--hue-green)",
  };
  const key = name
    .toLowerCase()
    .replace(/[0-9]$/, "")
    .trim();
  return map[key] ?? "var(--hue-slate)";
}

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

function sectionIsVocal(sec: Section): boolean {
  const lowerDeltas = sec.deltas.map((d) => d.toLowerCase());
  if (lowerDeltas.includes("instrumental")) return false;
  if (lowerDeltas.includes("vocal focus") || lowerDeltas.includes("catchy"))
    return true;
  return /verse|chorus|hook|pre-chorus|refrain|bridge|drop/i.test(sec.name);
}

export function LyricsBlock() {
  const s = useSession();
  const vocalSections = s.sections.filter(sectionIsVocal);
  const totalSyl = totalSyllables(s.lyricLines);

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
                onClick={() => {
                  s.setSession({
                    lyricsGenerated: true,
                    lyricLines: generateMockLyrics(s.sections),
                  });
                }}
              >
                <Sparkle size={14} /> Generate lyrics
              </button>
            )}
          {s.lyricsGenerated && (
            <button
              class="arr-action-btn"
              onClick={() => {
                s.setSession({
                  lyricsGenerated: true,
                  lyricLines: generateMockLyrics(s.sections),
                });
              }}
            >
              <ArrowClockwise size={14} /> Redraft
            </button>
          )}
        </div>
      </div>
      <div class="bundle-block-body">
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
          const hue = sectionHue(sec.name);
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
              {s.lyricsGenerated && (
                <div style="margin:4px 0 6px">
                  <button
                    class="arr-action-btn"
                    onClick={() => {
                      const lines = { ...s.lyricLines };
                      lines[sec.id] = [
                        `(Regenerated lyrics for ${sec.name} — line 1)`,
                        `(Regenerated lyrics for ${sec.name} — line 2)`,
                      ];
                      s.setSession({ lyricLines: lines });
                    }}
                  >
                    <ArrowClockwise size={12} /> Regenerate block
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

function generateMockLyrics(sections: Section[]): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const sec of sections) {
    const d = sec.deltas.map((dd) => dd.toLowerCase());
    if (d.includes("instrumental")) continue;
    const isVocal = sectionIsVocal(sec);
    if (isVocal) {
      result[sec.id] = [
        `(Lyrics for ${sec.name} — line 1)`,
        `(Lyrics for ${sec.name} — line 2)`,
        `(Lyrics for ${sec.name} — line 3)`,
        `(Lyrics for ${sec.name} — line 4)`,
      ];
    }
  }
  return result;
}
