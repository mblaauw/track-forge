import { useEffect, useCallback, useRef } from "preact/hooks";
import { useSession } from "../../lib/session";
import { usePlayer, flattenTakes } from "../../lib/player";
import {
  createJob,
  startJob,
  connectJobEvents,
  updateJobInputs,
  fetchVersions,
  fetchTakes,
  createTake,
  errorMessage,
  type ProgressEvent,
} from "../../api";
import { ContextBar } from "./ContextBar";
import { TransportBar } from "./TransportBar";
import { SetupColumn } from "./SetupColumn";
import { BundleCanvas } from "./BundleCanvas";
import { RendersPanel } from "./RendersPanel";
import { LibraryPanel } from "./LibraryPanel";
import { STAGE_LABELS } from "./arrangement";

const STAGE_TO_LABEL: Record<string, string> = {
  compilation: "Composing arrangement",
  lyrics_writing: "Writing lyrics",
  versioning: "Finalizing bundle",
  suno_render: "Forging audio with Suno",
};

function stageToDisplay(stage: string): { label: string; index: number } {
  const label = STAGE_TO_LABEL[stage];
  if (label) {
    const idx = STAGE_LABELS.indexOf(label);
    return { label, index: idx >= 0 ? idx : 0 };
  }
  // Fallback: if it's a pipeline stage (ref_interpretation, etc), map approximately
  for (let i = 0; i < STAGE_LABELS.length; i++) {
    if (
      STAGE_LABELS[i]!.toLowerCase().includes(
        stage.replace(/_/g, " ").toLowerCase(),
      )
    ) {
      return { label: STAGE_LABELS[i]!, index: i };
    }
  }
  return { label: stage, index: 0 };
}

function buildInputPack(
  s: ReturnType<typeof useSession>,
): Record<string, unknown> {
  return {
    bpm: s.bpm ?? 128,
    genreId: s.genreId,
    presetIds: s.presetIds,
    lyricsMode: s.lyricsMode,
    lyricTopic: s.lyricTopic,
    lyricAngle: s.lyricAngle,
    lyricThemes: s.lyricThemes,
    tags: s.tags,
    sections: s.sections,
    reference: s.reference,
    excludedStyles: s.excludedStyles,
    title: s.title,
    name: s.name,
    lyricLines: s.lyricLines,
    lyricsGenerated: s.lyricsGenerated,
  };
}

/** Genre + primary preset — sent with the inputs so the job follows a switch. */
function jobSound(s: ReturnType<typeof useSession>): {
  genreId?: string;
  presetId?: string;
} {
  return {
    genreId: s.genreId || undefined,
    presetId: s.presetId || s.presetIds[0] || undefined,
  };
}

export function ComposeShell() {
  const s = useSession();
  const player = usePlayer();
  const { leftCollapsed, rightCollapsed, libraryCollapsed } = s;
  const cleanupRef = useRef<(() => void) | null>(null);
  // Shared with the autosave effect below — flushed synchronously before a
  // forge starts so the pipeline never reads stale inputs from a debounce
  // window that hasn't fired yet.
  const persistRef = useRef<ReturnType<typeof setTimeout>>();
  // The take is triggered from an SSE handler created when the forge
  // started; a ref keeps it on the render settings as they are now.
  const renderRef = useRef(s.render);
  renderRef.current = s.render;
  // Latest session, for callbacks that outlive the render they were made in.
  const sessionRef = useRef(s);
  sessionRef.current = s;

  const handleForge = useCallback(async () => {
    if (s.forgeRunning || !s.genreId) return;

    // Drop any pending debounced autosave — the forge sends the inputs
    // itself, below, so the pipeline always compiles what is on screen.
    if (persistRef.current) {
      clearTimeout(persistRef.current);
      persistRef.current = undefined;
    }
    // Read the session through a ref: this callback's dependency list does
    // not cover every field of the input pack.
    const now = sessionRef.current;

    s.setSession({
      forgeRunning: true,
      forgeStageIdx: 0,
      forgeStageLabel: STAGE_LABELS[0]!,
      status: "in_progress",
      forgeError: "",
    });

    try {
      let jobId = now.jobId;

      if (!jobId) {
        // First forge of this session — create the job.
        const job = await createJob({
          genreId: now.genreId,
          presetId: now.presetId || now.presetIds[0] || "",
          inputs: buildInputPack(now),
          reference: now.reference || undefined,
          name: now.name || undefined,
        });
        jobId = job.id;
        s.setSession({ jobId: job.id });
      } else {
        // Re-forge — save the current inputs first. If this fails the run
        // would compile stale inputs, so it is an error, not a best effort.
        await updateJobInputs(jobId, {
          inputs: buildInputPack(now),
          name: now.name || undefined,
          ...jobSound(now),
        });
      }

      // Stop listening to any earlier run before starting this one.
      if (cleanupRef.current) cleanupRef.current();
      cleanupRef.current = null;

      // Start first, subscribe second: the cursor returned by the start call
      // scopes the event stream to this run. Subscribing before a start that
      // then fails used to replay the previous run's events and render a
      // take of the old version.
      const { eventCursor } = await startJob(jobId!);

      const completedStages = new Set<string>();

      // Once the run has reached an end state the stream is closed, so a
      // dropped connection later on is not mistaken for a failed forge.
      let settled = false;
      const settle = () => {
        settled = true;
        if (cleanupRef.current) cleanupRef.current();
        cleanupRef.current = null;
      };
      const fail = (reason: string) => {
        settle();
        s.setSession({
          forgeRunning: false,
          status: "failed",
          forgeError: reason,
        });
      };

      cleanupRef.current = connectJobEvents(
        jobId!,
        {
          onProgress: (event: ProgressEvent) => {
            if (event.stage === "suno_render" && event.status === "started") {
              s.setSession({
                forgeStageIdx: 3,
                forgeStageLabel: "Forging audio with Suno",
              });
            } else if (
              event.stage === "suno_render_complete" ||
              (event.stage === "suno_render" && event.status === "completed")
            ) {
              settle();
              s.setSession({
                forgeRunning: false,
                forgeStageIdx: 4,
                status: "completed",
                lastForgeTimestamp: Date.now(),
              });
              // Refresh takes
              fetchVersions(jobId!)
                .then((versions) => {
                  if (versions.length > 0) {
                    // fetchVersions returns newest-first (server orders by
                    // number DESC) — index 0 is the latest version, not the
                    // last element.
                    const latest = versions[0]!;
                    fetchTakes(latest.id)
                      .then((takes) => {
                        s.setSession({ takes: takes as any[] });
                        s.expandPanel("right");
                        // takes are newest-first — load the take that just
                        // finished, paused (never autoplay).
                        const newest = takes[0];
                        const playable = newest
                          ? flattenTakes([newest as any])[0]
                          : undefined;
                        if (playable) player.loadPaused(playable);
                      })
                      .catch(() => {});
                  }
                })
                .catch(() => {});
            } else if (event.stage === "suno_render_error") {
              fail(event.error ?? "Suno could not render this take");
            } else if (
              event.stage === "versioning" &&
              event.status === "completed"
            ) {
              // Auto-trigger Suno render via POST /takes
              completedStages.add(event.stage);
              s.setSession({ forgeStageIdx: Math.min(3, 3) });
              fetchVersions(jobId!)
                .then((versions) => {
                  if (versions.length > 0) {
                    // fetchVersions returns newest-first (server orders by
                    // number DESC) — index 0 is the latest version, not the
                    // last element.
                    const latest = versions[0]!;
                    createTake(latest.id, renderRef.current).catch((err) => {
                      console.error("Failed to auto-trigger take:", err);
                      fail(
                        errorMessage(err, "Could not send the take to Suno"),
                      );
                    });
                  }
                })
                .catch(() => {});
            } else if (event.status === "error") {
              // Stage failure — stop forge, don't hang forever. The stream
              // stays open: the pipeline retries a stage before giving up.
              s.setSession({
                forgeRunning: false,
                status: "failed",
                forgeError: event.error ?? "The forge failed",
              });
            } else {
              // Normal stage progress (started / completed)
              const { label, index } = stageToDisplay(event.stage);
              if (event.status === "started") {
                s.setSession({ forgeStageIdx: index, forgeStageLabel: label });
              } else if (event.status === "completed") {
                completedStages.add(event.stage);
                s.setSession({ forgeStageIdx: Math.min(index + 1, 3) });
              }
            }
          },
          onError: () => {
            if (!settled) fail("Lost the connection to the server");
          },
        },
        eventCursor ?? 0,
      );
    } catch (err) {
      console.error("Forge failed:", err);
      s.setSession({
        forgeRunning: false,
        status: "failed",
        forgeError: errorMessage(err, "Could not start the forge"),
      });
    }
  }, [
    s.jobId,
    s.genreId,
    s.presetIds,
    s.presetId,
    s.bpm,
    s.lyricsMode,
    s.lyricTopic,
    s.lyricAngle,
    s.lyricThemes,
    s.tags,
    s.sections,
    s.reference,
    s.title,
    s.name,
    s.forgeRunning,
  ]);

  // Cleanup SSE on unmount
  useEffect(() => {
    return () => {
      if (cleanupRef.current) cleanupRef.current();
    };
  }, []);

  // Debounced autosave to backend (only when a job exists)
  useEffect(() => {
    if (!s.jobId) return;
    if (persistRef.current) clearTimeout(persistRef.current);
    persistRef.current = setTimeout(() => {
      updateJobInputs(s.jobId!, {
        inputs: buildInputPack(s),
        name: s.name || undefined,
        ...jobSound(s),
      }).catch(() => {});
    }, 800);
    return () => {
      if (persistRef.current) clearTimeout(persistRef.current);
    };
  }, [
    s.jobId,
    s.name,
    s.title,
    s.genreId,
    s.presetIds.join(","),
    s.presetId,
    s.bpm,
    s.lyricsMode,
    s.lyricTopic,
    s.lyricAngle,
    s.lyricThemes.join(","),
    s.lyricsGenerated,
    s.lyricLines,
    s.tags.map((t) => `${t.label}:${t.weight}`).join(","),
    s.sections.map((sec) => `${sec.name}:${sec.fn}:${sec.bars}`).join(","),
    s.reference,
    s.excludedStyles,
    s.forgeRunning,
  ]);

  const leftW = leftCollapsed ? "42px" : "270px";
  const rightW = rightCollapsed ? "42px" : "320px";
  const libW = libraryCollapsed ? "42px" : "300px";
  const gridCols = `${leftW} minmax(0,1fr) ${rightW} ${libW}`;

  return (
    <div class="compose-shell">
      <div class="compose-main">
        <ContextBar
          onForge={handleForge}
          forgeDisabled={!s.genreId || s.forgeRunning}
        />
        <div class="compose-grid" style={{ gridTemplateColumns: gridCols }}>
          <SetupColumn />
          <BundleCanvas />
          <RendersPanel />
          <LibraryPanel />
        </div>
        <TransportBar />
      </div>
    </div>
  );
}
