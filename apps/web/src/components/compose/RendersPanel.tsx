import { useState, useRef, useEffect } from "preact/hooks";
import {
  CaretLeft,
  CaretRight,
  Waveform,
  Play,
  Pause,
  Star,
  Plus,
} from "@phosphor-icons/react";
import { useSession } from "../../lib/session";
import { createTake, fetchVersions, fetchTakes, favoriteTake } from "../../api";

function wave(seed: string, n: number): number[] {
  let h = seed.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const bars: number[] = [];
  for (let i = 0; i < n; i++) {
    h = (h * 1103515245 + 12345) & 0x7fffffff;
    bars.push(3 + (h % 26));
  }
  return bars;
}

export function RendersPanel() {
  const s = useSession();
  const { rightCollapsed, togglePanel, takes, jobId } = s;
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  const handleNewRender = async () => {
    if (!jobId || rendering) return;
    setRendering(true);
    try {
      const versions = await fetchVersions(jobId);
      if (versions.length === 0) return;
      const latest = versions[versions.length - 1]!;
      await createTake(latest.id);
      // Refresh takes
      const refreshed = await fetchTakes(latest.id);
      s.setSession({ takes: refreshed });
    } catch (err) {
      console.error("New render failed:", err);
    } finally {
      setRendering(false);
    }
  };

  const handlePlay = (take: { id: string; audioUrl?: string }) => {
    if (playingId === take.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    if (!take.audioUrl) return;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    const audio = new Audio(take.audioUrl);
    audio.onended = () => setPlayingId(null);
    audio.play().catch(() => {});
    audioRef.current = audio;
    setPlayingId(take.id);
  };

  const handleFavorite = async (takeId: string) => {
    try {
      const updated = await favoriteTake(takeId);
      s.setSession({
        takes: takes.map((t) =>
          t.id === takeId ? { ...t, ...updated } : t,
        ) as any[],
      });
    } catch (err) {
      console.error("Favorite failed:", err);
    }
  };

  if (rightCollapsed) {
    return (
      <div
        class="col-rail collapsed"
        onClick={() => togglePanel("right")}
        title="Expand renders"
      >
        <CaretLeft size={16} />
        <span class="rail-vertical-label">RENDERS</span>
      </div>
    );
  }

  return (
    <div class="renders-panel">
      <div class="col-header">
        <button
          class="col-collapse-btn"
          onClick={() => togglePanel("right")}
          title="Collapse renders"
        >
          <CaretRight size={16} />
        </button>
        <span class="col-pill">
          <Waveform size={14} />
          Renders · {takes.length}
        </span>
      </div>
      <div class="col-body tf-scroll">
        <div class="renders-subheader">
          <span class="renders-subheader-label">GENERATED SONGS</span>
          <button
            class="renders-new-btn"
            onClick={handleNewRender}
            disabled={rendering}
          >
            <Plus size={14} /> {rendering ? "Rendering…" : "New render"}
          </button>
        </div>
        {takes.length === 0 ? (
          <p class="renders-empty">
            No renders yet. Forge the bundle to generate.
          </p>
        ) : (
          <div
            class="renders-list"
            style="display:flex;flex-direction:column;gap:8px"
          >
            {takes.map((take) => {
              const isPlaying = playingId === take.id;
              const bars = wave(take.id, 40);
              return (
                <div
                  key={take.id}
                  class={`rende-card${take.isFavorite ? " fav" : ""}`}
                >
                  <div class="rende-card-top">
                    <button
                      class="rende-play-btn"
                      style={{
                        background: isPlaying
                          ? "var(--forge)"
                          : "var(--success-fill)",
                        color: isPlaying ? "var(--acc)" : "var(--success-text)",
                      }}
                      onClick={() => handlePlay(take)}
                    >
                      {isPlaying ? (
                        <Pause size={16} weight="fill" />
                      ) : (
                        <Play size={16} weight="fill" />
                      )}
                    </button>
                    <div class="rende-card-info">
                      <span class="rende-card-title">
                        {take.generatedTitle ?? "Untitled"}
                      </span>
                      <span class="rende-card-meta">
                        v{take.versionId?.slice(0, 4) ?? "?"} ·{" "}
                        {take.id.slice(0, 8)} ·{" "}
                        {take.duration
                          ? `${Math.floor(take.duration / 60)}:${(take.duration % 60).toString().padStart(2, "0")}`
                          : "—"}
                      </span>
                    </div>
                    <button
                      class="rende-star-btn"
                      onClick={() => handleFavorite(take.id)}
                    >
                      <Star
                        size={16}
                        weight={take.isFavorite ? "fill" : "regular"}
                        style={{
                          color: take.isFavorite
                            ? "var(--hue-amber)"
                            : "var(--faint)",
                        }}
                      />
                    </button>
                  </div>
                  <div class="rende-waveform" style={{ height: 30 }}>
                    {bars.slice(0, 40).map((h, i) => (
                      <div
                        key={i}
                        class="rende-wave-bar"
                        style={{
                          height: `${h}px`,
                          background:
                            isPlaying && i < 18
                              ? "var(--acc)"
                              : "var(--border)",
                        }}
                      />
                    ))}
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
