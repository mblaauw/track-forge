import { useCallback, useEffect, useRef } from "preact/hooks";
import {
  connectJobEvents,
  createJob,
  createTake,
  errorMessage,
  fetchTakes,
  fetchVersions,
  startJob,
  updateJobInputs,
  type ProgressEvent,
} from "../api";
import { flattenTakes, usePlayer } from "./player";
import { useSession } from "./session";

/** The four steps a forge moves through, in the user's words. */
export const FORGE_STEPS = [
  "Compiling the prompt",
  "Writing lyrics",
  "Saving the version",
  "Rendering with Suno",
] as const;

const STAGE_STEP: Record<string, number> = {
  compilation: 0,
  lyrics_writing: 1,
  versioning: 2,
  suno_render: 3,
};

type Session = ReturnType<typeof useSession>;

/** Everything the server needs to compile this session. */
function buildInputPack(s: Session): Record<string, unknown> {
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
    arrangeSource: s.arrangeSource,
  };
}

/** Genre + primary preset — sent with the inputs so the job follows a switch. */
function jobSound(s: Session): { genreId?: string; presetId?: string } {
  return {
    genreId: s.genreId || undefined,
    presetId: s.presetId || s.presetIds[0] || undefined,
  };
}

/**
 * Forging: save the session, run the pipeline, render a take, and keep the
 * session's status in step with the server's events. Also autosaves the
 * session to its job between forges.
 */
export function useForge(): { forge: () => void; canForge: boolean } {
  const s = useSession();
  const player = usePlayer();
  const cleanupRef = useRef<(() => void) | null>(null);
  const autosaveRef = useRef<ReturnType<typeof setTimeout>>();
  // Callbacks below outlive the render they were created in; refs keep them
  // on the session and take settings as they are now.
  const sessionRef = useRef(s);
  sessionRef.current = s;

  const forge = useCallback(async () => {
    const now = sessionRef.current;
    if (now.forgeRunning || !now.genreId) return;

    // The forge sends the inputs itself, so drop any pending autosave.
    if (autosaveRef.current) {
      clearTimeout(autosaveRef.current);
      autosaveRef.current = undefined;
    }

    s.setSession({
      forgeRunning: true,
      forgeStageIdx: 0,
      forgeStageLabel: FORGE_STEPS[0],
      status: "in_progress",
      forgeError: "",
      // On narrow layouts, bring the output forward so progress is visible.
      zone: "output",
    });

    try {
      let jobId = now.jobId;

      if (!jobId) {
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
      // then fails would replay the previous run's events and render a take
      // of the old version.
      const { eventCursor } = await startJob(jobId);
      const runJobId = jobId;

      // The user may open another session while this run is still going.
      // The run itself carries on (its take is still sent), but it must not
      // write into a session it does not belong to.
      const mine = () => sessionRef.current.jobId === runJobId;
      const set = (patch: Parameters<typeof s.setSession>[0]) => {
        if (mine()) s.setSession(patch);
      };

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
        set({
          forgeRunning: false,
          status: "failed",
          forgeError: reason,
        });
      };

      const refreshTakes = async () => {
        const versions = await fetchVersions(runJobId);
        // Newest first — index 0 is the version this run just wrote.
        const latest = versions[0];
        if (!latest) return;
        const takes = await fetchTakes(latest.id);
        if (!mine()) return;
        set({ takes: takes as never[] });
        // Cue the take that just finished, paused (never autoplay).
        const playable = takes[0]
          ? flattenTakes([takes[0] as never])[0]
          : undefined;
        if (playable) player.loadPaused(playable);
      };

      cleanupRef.current = connectJobEvents(
        runJobId,
        {
          onProgress: (event: ProgressEvent) => {
            if (
              event.stage === "suno_render_complete" ||
              (event.stage === "suno_render" && event.status === "completed")
            ) {
              settle();
              set({
                forgeRunning: false,
                forgeStageIdx: FORGE_STEPS.length,
                status: "completed",
                lastForgeTimestamp: Date.now(),
              });
              refreshTakes().catch(() => {});
            } else if (event.stage === "suno_render_error") {
              fail(event.error ?? "Suno could not render this take");
            } else if (
              event.stage === "versioning" &&
              event.status === "completed"
            ) {
              // The prompt is saved — send it to Suno.
              set({
                forgeStageIdx: 3,
                forgeStageLabel: FORGE_STEPS[3],
              });
              fetchVersions(runJobId)
                .then((versions) => {
                  const latest = versions[0];
                  if (!latest) return;
                  return createTake(latest.id, sessionRef.current.render);
                })
                .catch((err) => {
                  console.error("Failed to send the take:", err);
                  fail(errorMessage(err, "Could not send the take to Suno"));
                });
            } else if (event.status === "error") {
              // A stage failed. The stream stays open: the pipeline retries
              // a stage before giving up, and a later event resumes progress.
              set({
                forgeRunning: false,
                status: "failed",
                forgeError: event.error ?? "The forge failed",
              });
            } else if (event.status === "started") {
              const step = STAGE_STEP[event.stage];
              if (step !== undefined) {
                set({
                  forgeRunning: true,
                  status: "in_progress",
                  forgeError: "",
                  forgeStageIdx: step,
                  forgeStageLabel: FORGE_STEPS[step]!,
                });
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
  }, []);

  // Close the event stream when the studio unmounts.
  useEffect(
    () => () => {
      if (cleanupRef.current) cleanupRef.current();
    },
    [],
  );

  // Debounced autosave to the session's job (once it has one).
  const sectionsKey = s.sections
    .map(
      (sec) =>
        `${sec.id}:${sec.name}:${sec.fn}:${sec.bars}:${sec.deltas.join("+")}:${JSON.stringify(sec.vocal ?? null)}`,
    )
    .join("|");
  useEffect(() => {
    if (!s.jobId || s.forgeRunning) return;
    if (autosaveRef.current) clearTimeout(autosaveRef.current);
    autosaveRef.current = setTimeout(() => {
      const now = sessionRef.current;
      if (!now.jobId || now.forgeRunning) return;
      updateJobInputs(now.jobId, {
        inputs: buildInputPack(now),
        name: now.name || undefined,
        ...jobSound(now),
      }).catch(() => {});
    }, 800);
    return () => {
      if (autosaveRef.current) clearTimeout(autosaveRef.current);
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
    sectionsKey,
    s.reference,
    s.excludedStyles,
    s.forgeRunning,
  ]);

  return { forge, canForge: !!s.genreId && !s.forgeRunning };
}
