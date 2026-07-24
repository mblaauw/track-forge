import { CaretLeft, CaretRight, Play, Pause } from "@phosphor-icons/react";
import { useSession } from "../../lib/session";
import { usePlayer, flattenTakes } from "../../lib/player";
import { ForgeStrip } from "./ForgeStrip";

function fmtTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const rem = Math.floor(sec % 60);
  return `${m}:${rem.toString().padStart(2, "0")}`;
}

export function TransportBar() {
  const s = useSession();
  const player = usePlayer();

  const hasTakes = s.takes.length > 0;
  if (!s.forgeRunning && !hasTakes) return null;

  if (s.forgeRunning) {
    return (
      <div class="transport-bar">
        <ForgeStrip />
      </div>
    );
  }

  const playlist = flattenTakes(s.takes);
  const currentIdx = player.current
    ? playlist.findIndex(
        (t) =>
          t.takeId === player.current!.takeId &&
          t.trackIndex === player.current!.trackIndex,
      )
    : -1;
  const hasPrev = currentIdx > 0;
  const hasNext = currentIdx >= 0 && currentIdx < playlist.length - 1;

  const goTo = (idx: number) => {
    const track = playlist[idx];
    if (track) player.play(track);
  };

  return (
    <div class="transport-bar">
      <div class="transport-controls">
        <button
          class="transport-btn"
          disabled={!hasPrev}
          onClick={() => goTo(currentIdx - 1)}
          title="Previous take"
        >
          <CaretLeft size={16} />
        </button>
        <button
          class="transport-play-btn"
          disabled={!player.current}
          onClick={() => player.togglePlayPause()}
          title={player.isPlaying ? "Pause" : "Play"}
        >
          {player.isPlaying ? (
            <Pause size={16} weight="fill" />
          ) : (
            <Play size={16} weight="fill" />
          )}
        </button>
        <button
          class="transport-btn"
          disabled={!hasNext}
          onClick={() => goTo(currentIdx + 1)}
          title="Next take"
        >
          <CaretRight size={16} />
        </button>

        <span class="transport-time">{fmtTime(player.currentTime)}</span>
        <input
          type="range"
          class="transport-slider"
          min={0}
          max={player.duration || 0}
          step={0.1}
          value={player.currentTime}
          disabled={!player.current}
          onInput={(e) =>
            player.seek(Number((e.target as HTMLInputElement).value))
          }
        />
        <span class="transport-time">{fmtTime(player.duration)}</span>

        <span class="transport-label">
          {player.current ? player.current.label : "Select a take to play"}
        </span>
      </div>
    </div>
  );
}
