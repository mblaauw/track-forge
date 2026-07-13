import { useEffect, useState, useRef } from "preact/hooks";
import { useRouter } from "../lib/router";
import { fetchJob, fetchVersions, fetchGenerations, renameJob } from "../api";
import type { JobInfo, VersionInfo, GenerationInfo } from "../api";

function hashString(s: string, seedA = 9301, seedB = 49297): number {
  let h = seedA;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function fmtDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function syllableCount(text: string): number {
  const vowels = "aeiouyAEIOUY";
  let count = 0;
  let prevVowel = false;
  for (const ch of text) {
    const isVowel = vowels.includes(ch);
    if (isVowel && !prevVowel) count++;
    prevVowel = isVowel;
  }
  return Math.max(1, count);
}

function parseLyricsValue(value: string): { sections: Array<{ type: string; lines: string[] }>; totalSyllables: number } {
  try {
    const parsed = JSON.parse(value);
    if (parsed.document?.sections) {
      let totalSyllables = 0;
      const sections = parsed.document.sections.map((s: { type: string; lines?: string[]; label?: string }) => {
        const lines = s.lines || [];
        for (const line of lines) totalSyllables += syllableCount(line);
        return { type: s.label || s.type, lines };
      });
      return { sections, totalSyllables };
    }
    if (Array.isArray(parsed.sections)) {
      let totalSyllables = 0;
      const sections = parsed.sections.map((s: { type: string; lines?: string[]; label?: string }) => {
        const lines = s.lines || [];
        for (const line of lines) totalSyllables += syllableCount(line);
        return { type: s.label || s.type, lines };
      });
      return { sections, totalSyllables };
    }
  } catch {}
  const lines = value.split("\n").filter(Boolean);
  let totalSyllables = 0;
  for (const line of lines) totalSyllables += syllableCount(line);
  return { sections: lines.length > 0 ? [{ type: "text", lines }] : [], totalSyllables };
}

export function Studio({ id }: { id: string }) {
  const { params } = useRouter();
  const actualId = id || params.id || "";

  const [job, setJob] = useState<JobInfo | null>(null);
  const [versions, setVersions] = useState<VersionInfo[]>([]);
  const [generations, setGenerations] = useState<GenerationInfo[]>([]);
  const [selectedVersionIdx, setSelectedVersionIdx] = useState(0);
  const [playingIdx, setPlayingIdx] = useState<number | null>(null);
  const [playhead, setPlayhead] = useState(0);
  const [abMap, setAbMap] = useState<Record<string, "A" | "B" | null>>({});
  const [favoredId, setFavoredId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [jobName, setJobName] = useState("");
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (!actualId) return;
    setLoading(true);
    Promise.all([
      fetchJob(actualId),
      fetchVersions(actualId),
      fetchGenerations(actualId),
    ])
      .then(([j, vs, gs]) => {
        const sorted = [...vs].sort((a, b) => b.number - a.number);
        setJob(j);
        setVersions(sorted);
        setGenerations(gs);
        setJobName(j.name || "Untitled");
        setSelectedVersionIdx(0);
      })
      .finally(() => setLoading(false));
  }, [actualId]);

  useEffect(() => {
    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const selectedVersion = versions[selectedVersionIdx];
  const completedGenerations = generations.filter(
    (g) => g.audioUrl || g.status === "completed",
  );

  const styleArtifact = selectedVersion?.artifacts?.find((a) => a.type === "style");
  const lyricsArtifact = selectedVersion?.artifacts?.find((a) => a.type === "lyrics");

  const styleText = styleArtifact?.value || "";
  const parsedLyrics = lyricsArtifact?.value ? parseLyricsValue(lyricsArtifact.value) : { sections: [], totalSyllables: 0 };
  const tags = styleText ? styleText.split(",").map((t) => t.trim()).filter(Boolean) : [];

  const styleCount = styleArtifact ? 1 : 0;
  const lyricCount = lyricsArtifact ? 1 : 0;
  const takesCount = completedGenerations.length;

  const handlePlay = (idx: number) => {
    if (playingIdx === idx) {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setPlayingIdx(null);
      setPlayhead(0);
    } else {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
      setPlayingIdx(idx);
      setPlayhead(0);
      intervalRef.current = window.setInterval(() => {
        setPlayhead((prev) => {
          if (prev >= 100) {
            if (intervalRef.current !== null) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
            setPlayingIdx(null);
            return 0;
          }
          return prev + 0.7;
        });
      }, 90);
    }
  };

  const toggleAb = (genId: string) => {
    setAbMap((prev) => {
      const current = prev[genId];
      if (current === null || current === undefined) return { ...prev, [genId]: "A" };
      if (current === "A") return { ...prev, [genId]: "B" };
      return { ...prev, [genId]: null };
    });
  };

  const toggleFavored = (genId: string) => {
    setFavoredId((prev) => (prev === genId ? null : genId));
  };

  const handleRename = (e: Event) => {
    const val = (e.target as HTMLInputElement).value;
    setJobName(val);
    if (actualId) {
      renameJob(actualId, val).catch(() => {});
    }
  };

  if (loading) {
    return (
      <div style="padding:24px;display:flex;flex-direction:column;gap:24px;">
        <div class="bundle-header">
          <div class="skeleton-block" style={{ height: 24, width: 120, borderRadius: 4 }} />
          <div class="skeleton-block" style={{ height: 32, width: 200, borderRadius: 4 }} />
          <div class="skeleton-block" style={{ height: 24, width: 120, borderRadius: 4 }} />
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;">
          <div class="artifact-panel">
            <div class="artifact-panel-header">
              <div class="skeleton-block" style={{ height: 20, width: 60, borderRadius: 4 }} />
            </div>
            <div class="artifact-panel-body">
              <div class="skeleton-block" style={{ height: 16, width: "100%", borderRadius: 4, marginBottom: 8 }} />
              <div class="skeleton-block" style={{ height: 16, width: "80%", borderRadius: 4, marginBottom: 8 }} />
              <div class="skeleton-block" style={{ height: 16, width: "60%", borderRadius: 4 }} />
            </div>
          </div>
          <div class="artifact-panel">
            <div class="artifact-panel-header">
              <div class="skeleton-block" style={{ height: 20, width: 80, borderRadius: 4 }} />
            </div>
            <div class="artifact-panel-body">
              <div class="skeleton-block" style={{ height: 16, width: "100%", borderRadius: 4, marginBottom: 8 }} />
              <div class="skeleton-block" style={{ height: 16, width: "90%", borderRadius: 4, marginBottom: 8 }} />
              <div class="skeleton-block" style={{ height: 16, width: "70%", borderRadius: 4 }} />
            </div>
          </div>
        </div>
        <div class="takes-section">
          <div class="skeleton-block" style={{ height: 24, width: 160, borderRadius: 4, marginBottom: 16 }} />
          <div class="skeleton-block" style={{ height: 80, width: "100%", borderRadius: 8 }} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div class="bundle-header">
        <span class="bundle-badge">
          Bundle{selectedVersion ? ` · v${selectedVersion.number}` : ""}
        </span>
        <input
          class="project-name-input"
          value={jobName}
          onInput={handleRename}
          style="font-size:22px;font-weight:700;max-width:300px"
        />
        <div style="display:flex;align-items:center;gap:8px;margin-left:auto;">
          {versions.length > 1 && (
            <div style="display:flex;gap:4px;">
              {versions.map((v, i) => (
                <button
                  key={v.id}
                  class={`preset-pill${i === selectedVersionIdx ? " active" : ""}`}
                  onClick={() => setSelectedVersionIdx(i)}
                >
                  v{v.number}
                </button>
              ))}
            </div>
          )}
          <span class="bundle-stats-pill">
            {styleCount} style · {lyricCount} lyric · {takesCount} takes
          </span>
        </div>
      </div>

      {versions.length === 0 && (
        <div style="padding:40px;text-align:center;color:var(--text-dim);">
          No versions yet
        </div>
      )}

      {versions.length > 0 && (
        <div class="studio-layout">
          <div class="artifact-panel">
            <div class="artifact-panel-header">
              Style{styleText ? ` (${styleText.length} chars)` : ""}
            </div>
            <div class="artifact-panel-body">
              {styleText ? (
                <>
                  <div class="style-text" style="white-space:pre-wrap;">
                    {styleText}
                  </div>
                  {tags.length > 0 && (
                    <div class="style-tags">
                      {tags.map((tag) => (
                        <span key={tag} class="lane-chip">{tag}</span>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div style="color:var(--text-dim);">&mdash;</div>
              )}
            </div>
          </div>

          <div class="artifact-panel">
            <div class="artifact-panel-header">
              Lyric Sheet{parsedLyrics.totalSyllables > 0 ? ` (${parsedLyrics.totalSyllables} syllables)` : ""}
            </div>
            <div class="artifact-panel-body lyric-sheet">
              {parsedLyrics.sections.length > 0 ? (
                <>
                  {parsedLyrics.sections.map((section, si) => (
                    <div key={si}>
                      <div class="section-header">{section.type}</div>
                      {section.lines.map((line, li) => (
                        <div key={li} class="lyric-line">
                          <span class="lyric-syllables">({syllableCount(line)})</span>
                          <span class="lyric-text">{line}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                  <div class="total-syllables">Total: {parsedLyrics.totalSyllables} syllables</div>
                </>
              ) : (
                <div style="color:var(--text-dim);">&mdash;</div>
              )}
            </div>
          </div>
        </div>
      )}

      <div class="takes-section">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
          <h2 class="takes-title" style="margin:0;">Audio Takes</h2>
          <button class="render-btn">
            <i class="ph-plus-circle" />
            Render new take
          </button>
        </div>
        {completedGenerations.length === 0 ? (
          <div style="padding:20px;text-align:center;color:var(--text-dim);">
            No takes yet
          </div>
        ) : (
          <div class="takes-list">
            {completedGenerations.map((gen, i) => {
              const isPlaying = playingIdx === i;
              const abState = abMap[gen.id] ?? null;
              const isFavored = favoredId === gen.id;
              return (
                <div key={gen.id} class={`take-card${isFavored ? " favored" : ""}`}>
                  <button
                    class={`take-play${isPlaying ? " playing" : ""}`}
                    onClick={() => handlePlay(i)}
                  >
                    <i class={isPlaying ? "ph-pause-fill" : "ph-play-fill"} />
                  </button>
                  <div class="take-info">
                    <div class="take-title">{gen.generatedTitle || `Take ${i + 1}`}</div>
                    <div class="take-meta">{gen.style || ""}</div>
                  </div>
                  <div class="take-waveform" style="position:relative;">
                    {Array.from({ length: 46 }, (_, j) => {
                      const barPlayed = isPlaying && (j / 46 * 100) < playhead;
                      return (
                        <div
                          key={j}
                          class={`bar${barPlayed ? " playing" : ""}`}
                          style={{ height: `${hashString(gen.id + j, 3, 37) % 34 + 3}px` }}
                        />
                      );
                    })}
                    {isPlaying && (
                      <div
                        style={`position:absolute;top:0;bottom:0;width:2px;background:var(--accent);pointer-events:none;left:${playhead}%;transition:left 90ms linear;`}
                      />
                    )}
                  </div>
                  {gen.duration != null && (
                    <span class="take-duration">{fmtDuration(gen.duration)}</span>
                  )}
                  <div class="take-actions">
                    <button
                      class={`take-ab${abState ? " active" : ""}`}
                      onClick={() => toggleAb(gen.id)}
                    >
                      {abState || "A"}
                    </button>
                    <button
                      class={`take-star${isFavored ? " active" : ""}`}
                      onClick={() => toggleFavored(gen.id)}
                    >
                      <i class={isFavored ? "ph-star-fill" : "ph-star"} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
