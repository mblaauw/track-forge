import { useState } from "preact/hooks";
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
import { usePlayer } from "../../lib/player";
import { createTake, fetchVersions, fetchTakes, favoriteTake } from "../../api";
import type { Take, TakeTrack } from "./types";

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
  const player = usePlayer();
  const { rightCollapsed, togglePanel, takes, jobId } = s;
  const [rendering, setRendering] = useState(false);

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

  const handlePlay = (
    takeId: string,
    trackIndex: number,
    audioUrl: string | undefined,
    label: string,
  ) => {
    if (!audioUrl) return;
    player.toggle({ takeId, trackIndex, audioUrl, label });
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

  const renderTrack = (track: TakeTrack, take: Take, isOnly: boolean) => {
    const isPlaying =
      player.isPlaying &&
      player.current?.takeId === take.id &&
      player.current?.trackIndex === track.index;
    const bars = wave(track.id || take.id + track.index, 40);
    const label = track.title || `Track ${track.index + 1}`;

    return (
      <div
        key={track.id || `${take.id}-${track.index}`}
        class="rende-track"
        style={{
          padding: isOnly ? "0" : "4px 0 4px 8px",
          marginTop: isOnly ? 0 : 4,
        }}
      >
        <div class="rende-card-top">
          <button
            class="rende-play-btn"
            style={{
              width: 28,
              height: 28,
              minWidth: 28,
              background: isPlaying ? "var(--forge)" : "var(--success-fill)",
              color: isPlaying ? "var(--acc)" : "var(--success-text)",
            }}
            onClick={() =>
              handlePlay(
                take.id,
                track.index,
                track.audioUrl,
                !isOnly ? label : take.generatedTitle || "Untitled",
              )
            }
            title={`Play ${label}`}
          >
            {isPlaying ? (
              <Pause size={12} weight="fill" />
            ) : (
              <Play size={12} weight="fill" />
            )}
          </button>
          <div class="rende-card-info" style={{ marginLeft: 6 }}>
            <span class="rende-card-title" style={{ fontSize: 12 }}>
              {!isOnly ? label : take.generatedTitle || "Untitled"}
            </span>
            <span class="rende-card-meta" style={{ fontSize: 10 }}>
              {track.duration
                ? `${Math.floor(track.duration / 60)}:${(track.duration % 60).toString().padStart(2, "0")}`
                : take.duration
                  ? `${Math.floor(take.duration / 60)}:${(take.duration % 60).toString().padStart(2, "0")}`
                  : "—"}
            </span>
          </div>
        </div>
        {!isOnly && (
          <div class="rende-waveform" style={{ height: 20, marginLeft: 34 }}>
            {bars.slice(0, 30).map((h, i) => (
              <div
                key={i}
                class="rende-wave-bar"
                style={{
                  height: `${Math.min(h, 18)}px`,
                  background:
                    isPlaying && i < 14 ? "var(--acc)" : "var(--border)",
                }}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  if (rightCollapsed) {
    return (
      <div
        class="col-rail collapsed"
        onClick={() => togglePanel("right")}
        title="Expand takes"
        aria-label={`Expand takes, ${takes.length} takes`}
      >
        <CaretLeft size={16} />
        <Waveform size={18} />
        {takes.length > 0 && (
          <span class="rail-count-badge">{takes.length}</span>
        )}
      </div>
    );
  }

  return (
    <div class="renders-panel">
      <div class="col-header">
        <button
          class="col-collapse-btn"
          onClick={() => togglePanel("right")}
          title="Collapse takes"
        >
          <CaretRight size={16} />
        </button>
        <span class="col-pill">
          <Waveform size={14} />
          Takes · {takes.length}
        </span>
      </div>
      <div class="col-body tf-scroll">
        <div class="renders-subheader">
          <span class="renders-subheader-label">TAKES</span>
          <button
            class="renders-new-btn"
            onClick={handleNewRender}
            disabled={rendering}
          >
            <Plus size={14} /> {rendering ? "Forging…" : "New take"}
          </button>
        </div>
        {takes.length === 0 ? (
          <p class="renders-empty">
            No takes yet. Forge the bundle to create one.
          </p>
        ) : (
          <div
            class="renders-list"
            style="display:flex;flex-direction:column;gap:8px"
          >
            {takes.map((take) => {
              const tracks = take.tracks;
              const hasTracks = tracks && tracks.length > 0;
              return (
                <div
                  key={take.id}
                  class={`rende-card${take.isFavorite ? " fav" : ""}`}
                  style={hasTracks ? { padding: "6px" } : undefined}
                >
                  <div class="rende-card-top">
                    <div class="rende-card-info" style={{ flex: 1 }}>
                      <span class="rende-card-title">
                        {take.generatedTitle ?? "Untitled"}
                      </span>
                      <span class="rende-card-meta">
                        v{take.versionId?.slice(0, 4) ?? "?"} ·{" "}
                        {take.id.slice(0, 8)} ·{" "}
                        {hasTracks
                          ? `${tracks!.length} tracks`
                          : take.duration
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
                  {hasTracks
                    ? tracks!.map((t) =>
                        renderTrack(t, take, tracks!.length === 1),
                      )
                    : renderTrack(
                        {
                          id: take.id,
                          index: 0,
                          audioUrl: take.audioUrl,
                          imageUrl: take.imageUrl,
                          videoUrl: take.videoUrl,
                          duration: take.duration,
                          title: take.generatedTitle,
                        },
                        take,
                        true,
                      )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
