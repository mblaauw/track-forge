import { useState } from "preact/hooks";
import {
  CaretDown,
  CheckCircle,
  CircleNotch,
  Copy,
  Fire,
  Pause,
  Play,
  Plus,
  SkipBack,
  SkipForward,
  Star,
  WarningCircle,
} from "@phosphor-icons/react";
import {
  SUNO_LIMITS,
  SUNO_MODEL_INFO,
  DEFAULT_SUNO_MODEL,
  estimateDurationSec,
  formatSunoLyrics,
  type SunoRenderSettings,
} from "@track-forge/contracts";
import { createTake, favoriteTake, fetchTakes, fetchVersions } from "../../api";
import { FORGE_STEPS } from "../../lib/forge";
import { flattenTakes, usePlayer } from "../../lib/player";
import type { PromptPreview } from "../../lib/preview";
import { useSession } from "../../lib/session";
import { RenderSettings, renderSummary } from "./RenderSettings";
import type { Take, TakeTrack } from "./types";
import { Budget, Popover, formatClock, useToast } from "./ui";

type ReadoutTab = "style" | "lyrics" | "avoid";

export function OutputDeck({
  preview,
  onForge,
  canForge,
}: {
  preview: PromptPreview;
  onForge: () => void;
  canForge: boolean;
}) {
  return (
    <aside class="deck" aria-label="Output">
      <ForgeControl onForge={onForge} canForge={canForge} />
      <Readout preview={preview} />
      <Takes />
      <Player />
    </aside>
  );
}

/* ── Forge ──────────────────────────────────────────────────────────── */

function ForgeControl({
  onForge,
  canForge,
}: {
  onForge: () => void;
  canForge: boolean;
}) {
  const s = useSession();
  const forging = s.forgeRunning || s.status === "in_progress";
  const failed = !forging && s.status === "failed";
  const state = forging ? "forging" : failed ? "failed" : "ready";
  const label = forging ? "Forging" : failed ? "Failed" : "Ready";

  return (
    <div class={`forge forge-${state}`}>
      <div class="forge-row">
        <p class="forge-status" data-testid="forge-status">
          <span class="forge-dot" aria-hidden="true" />
          {label}
        </p>
        <button
          type="button"
          class="forge-btn"
          data-testid="forge-btn"
          disabled={!canForge || forging}
          onClick={onForge}
        >
          {forging ? (
            <CircleNotch size={18} class="spin" />
          ) : (
            <Fire size={18} weight="fill" />
          )}
          {forging ? "Forging…" : "Forge"}
        </button>
      </div>

      {forging && (
        <ol
          class="forge-steps"
          data-testid="forge-strip"
          aria-label="Forge progress"
        >
          {FORGE_STEPS.map((step, i) => {
            const stepState =
              i < s.forgeStageIdx
                ? "done"
                : i === s.forgeStageIdx
                  ? "now"
                  : "next";
            return (
              <li
                key={step}
                class={`forge-step ${stepState}`}
                aria-current={stepState === "now" ? "step" : undefined}
              >
                <span class="forge-step-mark" aria-hidden="true" />
                {step}
              </li>
            );
          })}
        </ol>
      )}

      {failed && (
        <p class="forge-error" role="alert">
          <WarningCircle size={16} weight="fill" />
          <span data-testid="forge-error">
            {s.forgeError || "The forge failed"}
          </span>
        </p>
      )}
    </div>
  );
}

/* ── What Suno receives ─────────────────────────────────────────────── */

function Readout({ preview }: { preview: PromptPreview }) {
  const s = useSession();
  const toast = useToast();
  const [tab, setTab] = useState<ReadoutTab>("style");

  const vocalsOn = s.lyricsMode === "full_lyrics";
  const lyrics = vocalsOn
    ? formatSunoLyrics(s.sections, s.lyricsGenerated ? s.lyricLines : {})
    : "";
  const avoid = preview.exclusions.join(", ");
  const durationSec = Math.min(
    SUNO_LIMITS.maxDurationSec,
    estimateDurationSec(s.bpm ?? 128, s.sections),
  );

  const tabs: {
    id: ReadoutTab;
    label: string;
    used: number;
    max: number;
    text: string;
    empty: string;
  }[] = [
    {
      id: "style",
      label: "Style",
      used: preview.style.length,
      max: SUNO_LIMITS.style,
      text: preview.style,
      empty: preview.error
        ? "The style prompt could not be compiled. Check that the server is running."
        : "Compiling…",
    },
    {
      id: "lyrics",
      label: "Lyrics",
      used: lyrics.length,
      max: SUNO_LIMITS.lyrics,
      text: lyrics,
      empty: "Instrumental. No lyrics are sent.",
    },
    {
      id: "avoid",
      label: "Avoid",
      used: avoid.length,
      max: SUNO_LIMITS.negativeTags,
      text: avoid,
      empty: "Nothing is excluded.",
    },
  ];
  const current = tabs.find((t) => t.id === tab)!;
  const over = current.used > current.max;

  return (
    <section class="deck-section readout" aria-labelledby="readout-title">
      <header class="deck-head">
        <h2 class="deck-title" id="readout-title">
          Sent to Suno
        </h2>
        <dl class="facts">
          <div>
            <dt>Length</dt>
            <dd>{formatClock(durationSec)}</dd>
          </div>
          <div>
            <dt>Model</dt>
            <dd>
              {SUNO_MODEL_INFO[s.render.model ?? DEFAULT_SUNO_MODEL].label}
            </dd>
          </div>
        </dl>
      </header>

      <div class="tabs" role="tablist" aria-label="Prompt parts">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`readout-tab-${t.id}`}
            aria-selected={t.id === tab}
            aria-controls="readout-panel"
            class={`tab${t.id === tab ? " on" : ""}${t.used > t.max ? " over" : ""}`}
            data-testid={`readout-tab-${t.id}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
        <span class="tabs-aside">
          {current.text && (
            <Budget
              used={current.used}
              max={current.max}
              testId="readout-budget"
            />
          )}
          <button
            type="button"
            class="icon-btn icon-btn-dark"
            aria-label={`Copy ${current.label.toLowerCase()}`}
            title={`Copy ${current.label.toLowerCase()}`}
            disabled={!current.text}
            onClick={() =>
              navigator.clipboard
                .writeText(current.text)
                .then(() => toast({ message: `${current.label} copied` }))
                .catch(() => {})
            }
          >
            <Copy size={15} />
          </button>
        </span>
      </div>

      <div
        class="readout-panel"
        role="tabpanel"
        id="readout-panel"
        aria-labelledby={`readout-tab-${tab}`}
        tabIndex={0}
        data-testid="readout-text"
      >
        {current.text ? (
          <pre class="readout-text">{current.text}</pre>
        ) : (
          <p class="readout-empty">{current.empty}</p>
        )}
      </div>

      {preview.error && current.id === "style" && preview.style && (
        <p class="deck-note deck-note-warn" role="status">
          This could not be refreshed, so it may be out of date. Check that the
          server is running.
        </p>
      )}
      {over && (
        <p class="deck-note deck-note-warn" role="status">
          Over Suno's {current.max.toLocaleString()} character limit by{" "}
          {(current.used - current.max).toLocaleString()}. The lowest-priority
          text is dropped when the take is sent.
        </p>
      )}
      {tab === "lyrics" && vocalsOn && !s.lyricsGenerated && (
        <p class="deck-note">
          The lines under each sung section are written during the forge.
        </p>
      )}
    </section>
  );
}

/* ── Takes ──────────────────────────────────────────────────────────── */

/** Adjustments made to fit Suno's limits when the take was sent. */
function takeNotes(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    return (JSON.parse(raw) as { message?: string }[])
      .map((w) => w.message ?? "")
      .filter(Boolean);
  } catch {
    return [];
  }
}

function takeSettings(raw: string | null | undefined): string {
  if (!raw) return "";
  try {
    return renderSummary(JSON.parse(raw) as SunoRenderSettings);
  } catch {
    return "";
  }
}

function Takes() {
  const s = useSession();
  const player = usePlayer();
  const toast = useToast();
  const [rendering, setRendering] = useState(false);
  const { takes, jobId } = s;

  const renderAnother = async () => {
    if (!jobId || rendering) return;
    setRendering(true);
    try {
      // Newest first — index 0 is the latest forged version.
      const latest = (await fetchVersions(jobId))[0];
      if (!latest) return;
      await createTake(latest.id, s.render);
      s.setSession({ takes: (await fetchTakes(latest.id)) as never[] });
    } catch {
      toast({ message: "Could not render another take", tone: "error" });
    } finally {
      setRendering(false);
    }
  };

  const toggleFavourite = async (take: Take) => {
    try {
      const updated = await favoriteTake(take.id);
      s.setSession({
        takes: takes.map((t) =>
          t.id === take.id ? { ...t, isFavorite: updated.isFavorite } : t,
        ),
      });
    } catch {
      toast({ message: "Could not update the favourite", tone: "error" });
    }
  };

  return (
    <section
      class="deck-section takes"
      aria-labelledby="takes-title"
      data-testid="renders-panel"
    >
      <header class="deck-head">
        <h2 class="deck-title" id="takes-title">
          Takes{" "}
          {takes.length > 0 && <span class="deck-count">{takes.length}</span>}
        </h2>
        <div class="deck-tools">
          <Popover
            label="Take settings"
            align="end"
            panelClass="settings-pop"
            trigger={({ toggle, ref, open: _open, ...aria }) => (
              <button
                type="button"
                class="btn btn-deck"
                ref={ref}
                onClick={toggle}
                data-testid="take-settings"
                {...aria}
              >
                {renderSummary(s.render)}
                <CaretDown size={13} />
              </button>
            )}
          >
            {() => <RenderSettings />}
          </Popover>
          <button
            type="button"
            class="btn btn-deck"
            onClick={renderAnother}
            disabled={rendering || !jobId || takes.length === 0}
            title="Render the forged prompt again with these settings"
          >
            <Plus size={14} /> {rendering ? "Rendering…" : "New take"}
          </button>
        </div>
      </header>

      {takes.length === 0 ? (
        <p class="takes-empty">
          No takes yet. Forge to send this prompt to Suno and hear the result.
        </p>
      ) : (
        <ul class="take-list">
          {takes.map((take) => {
            const tracks: TakeTrack[] =
              take.tracks && take.tracks.length > 0
                ? take.tracks
                : [
                    {
                      id: take.id,
                      index: 0,
                      audioUrl: take.audioUrl,
                      duration: take.duration,
                      title: take.generatedTitle,
                    },
                  ];
            const settings = takeSettings(take.renderSettings);
            const working =
              take.status === "queued" || take.status === "processing";
            return (
              <li
                key={take.id}
                class={`take${take.isFavorite ? " fav" : ""}`}
                data-testid={`take-card-${take.id}`}
              >
                <div class="take-head">
                  <div class="take-id">
                    <span class="take-title">
                      {take.generatedTitle ?? s.title ?? "Untitled"}
                    </span>
                    {settings && <span class="take-meta">{settings}</span>}
                  </div>
                  <button
                    type="button"
                    class="icon-btn icon-btn-dark"
                    aria-pressed={!!take.isFavorite}
                    aria-label={
                      take.isFavorite ? "Remove from favourites" : "Favourite"
                    }
                    onClick={() => toggleFavourite(take)}
                  >
                    <Star
                      size={16}
                      weight={take.isFavorite ? "fill" : "regular"}
                    />
                  </button>
                </div>

                {take.status === "error" ? (
                  <p class="take-note take-note-error" role="status">
                    <WarningCircle size={14} />
                    {take.error ?? "Suno could not render this take."}
                  </p>
                ) : working ? (
                  <p class="take-note">
                    <CircleNotch size={14} class="spin" /> Rendering at Suno…
                  </p>
                ) : (
                  tracks.map((track, i) => {
                    const playing =
                      player.isPlaying &&
                      player.current?.takeId === take.id &&
                      player.current?.trackIndex === track.index;
                    const name =
                      tracks.length > 1
                        ? `Version ${String.fromCharCode(65 + i)}`
                        : "Play";
                    return (
                      <div class="track" key={track.id || i}>
                        <button
                          type="button"
                          class={`play${playing ? " on" : ""}`}
                          data-testid={`play-btn-${take.id}`}
                          disabled={!track.audioUrl}
                          aria-label={
                            track.audioUrl
                              ? `${playing ? "Pause" : "Play"} ${take.generatedTitle ?? "take"}${tracks.length > 1 ? `, ${name}` : ""}`
                              : "No audio for this take"
                          }
                          onClick={() =>
                            track.audioUrl &&
                            player.toggle({
                              takeId: take.id,
                              trackIndex: track.index,
                              audioUrl: track.audioUrl,
                              label: `${take.generatedTitle ?? "Untitled"}${tracks.length > 1 ? ` — ${name}` : ""}`,
                            })
                          }
                        >
                          {playing ? (
                            <Pause size={14} weight="fill" />
                          ) : (
                            <Play size={14} weight="fill" />
                          )}
                        </button>
                        <span class="track-name">
                          {tracks.length > 1 ? name : "Take"}
                        </span>
                        <span class="track-time">
                          {(track.duration ?? take.duration)
                            ? formatClock((track.duration ?? take.duration)!)
                            : "—"}
                        </span>
                        {!track.audioUrl && (
                          <span class="track-flag">
                            {take.id.startsWith("dry-")
                              ? "Dry run, no audio"
                              : "No audio"}
                          </span>
                        )}
                        {track.audioUrl &&
                          take.status === "completed" &&
                          i === 0 && (
                            <CheckCircle
                              size={14}
                              class="track-ok"
                              aria-hidden="true"
                            />
                          )}
                      </div>
                    );
                  })
                )}

                {takeNotes(take.payloadWarnings).map((note) => (
                  <p class="take-note" key={note}>
                    {note}
                  </p>
                ))}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/* ── Player ─────────────────────────────────────────────────────────── */

function Player() {
  const s = useSession();
  const player = usePlayer();
  const playlist = flattenTakes(s.takes);
  if (playlist.length === 0 && !player.current) return null;

  const index = player.current
    ? playlist.findIndex(
        (t) =>
          t.takeId === player.current!.takeId &&
          t.trackIndex === player.current!.trackIndex,
      )
    : -1;
  const go = (i: number) => {
    const track = playlist[i];
    if (track) player.play(track);
  };

  return (
    <div class="player" data-testid="player">
      <p class="player-label">
        {player.current ? player.current.label : "Choose a take to play"}
      </p>
      <div class="player-row">
        <button
          type="button"
          class="icon-btn icon-btn-dark"
          aria-label="Previous"
          disabled={index <= 0}
          onClick={() => go(index - 1)}
        >
          <SkipBack size={16} weight="fill" />
        </button>
        <button
          type="button"
          class="play play-lg"
          aria-label={player.isPlaying ? "Pause" : "Play"}
          disabled={!player.current && playlist.length === 0}
          onClick={() => (player.current ? player.togglePlayPause() : go(0))}
        >
          {player.isPlaying ? (
            <Pause size={16} weight="fill" />
          ) : (
            <Play size={16} weight="fill" />
          )}
        </button>
        <button
          type="button"
          class="icon-btn icon-btn-dark"
          aria-label="Next"
          disabled={index < 0 || index >= playlist.length - 1}
          onClick={() => go(index + 1)}
        >
          <SkipForward size={16} weight="fill" />
        </button>
        <span class="player-time">{formatClock(player.currentTime)}</span>
        <input
          type="range"
          class="range range-dark"
          aria-label="Position"
          min={0}
          max={player.duration || 0}
          step={0.1}
          value={player.currentTime}
          disabled={!player.current}
          onInput={(e) =>
            player.seek(Number((e.target as HTMLInputElement).value))
          }
        />
        <span class="player-time">{formatClock(player.duration)}</span>
      </div>
    </div>
  );
}
