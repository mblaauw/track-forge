import { useEffect, useCallback, useRef } from "preact/hooks";
import { useSession } from "../../lib/session";
import {
  createJob,
  startJob,
  connectJobEvents,
  updateJobInputs,
  fetchVersions,
  fetchTakes,
  createTake,
  type ProgressEvent,
} from "../../api";
import { ContextBar } from "./ContextBar";
import { ForgeStrip } from "./ForgeStrip";
import { SetupColumn } from "./SetupColumn";
import { BundleCanvas } from "./BundleCanvas";
import { RendersPanel } from "./RendersPanel";
import { LibraryPanel } from "./LibraryPanel";
import { STAGE_LABELS } from "./arrangement";

const STAGE_TO_LABEL: Record<string, string> = {
  compilation: "Composing arrangement",
  lyrics_writing: "Writing lyrics",
  versioning: "Finalizing bundle",
  suno_render: "Rendering with Suno",
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

export function ComposeShell() {
  const s = useSession();
  const { leftCollapsed, rightCollapsed, libraryCollapsed } = s;
  const cleanupRef = useRef<(() => void) | null>(null);

  const handleForge = useCallback(async () => {
    if (s.forgeRunning || s.forgeDisabled) return;
    s.setSession({
      forgeRunning: true,
      forgeStageIdx: 0,
      forgeStageLabel: STAGE_LABELS[0]!,
      status: "in_progress",
    });

    try {
      let jobId = s.jobId;

      // Create job if not yet saved
      if (!jobId) {
        const inputPack = {
          bpm: s.bpm ?? 128,
          key: s.key,
          scale: s.scale,
          genreId: s.genreId,
          presetIds: s.presetIds,
          lyricsMode: s.lyricsMode,
          lyricTopic: s.lyricTopic,
          lyricAngle: s.lyricAngle,
          lyricThemes: s.lyricThemes,
          tags: s.tags,
          sections: s.sections,
          reference: s.reference,
          title: s.title,
          name: s.name,
          lyricLines: s.lyricLines,
          lyricsGenerated: s.lyricsGenerated,
        };

        console.log("[forge] inputPack:", JSON.stringify(inputPack, null, 2));

        const job = await createJob({
          genreId: s.genreId,
          presetId: s.presetId || s.presetIds[0] || "",
          inputs: inputPack as unknown as Record<string, unknown>,
          reference: s.reference || undefined,
          name: s.name || undefined,
        });
        jobId = job.id;
        s.setSession({ jobId: job.id });
      }

      // Subscribe to SSE
      if (cleanupRef.current) cleanupRef.current();

      const completedStages = new Set<string>();

      cleanupRef.current = connectJobEvents(jobId!, {
        onProgress: (event: ProgressEvent) => {
          if (event.stage === "suno_render" && event.status === "started") {
            s.setSession({
              forgeStageIdx: 3,
              forgeStageLabel: "Rendering with Suno",
            });
          } else if (
            event.stage === "suno_render_complete" ||
            (event.stage === "suno_render" && event.status === "completed")
          ) {
            s.setSession({
              forgeRunning: false,
              forgeStageIdx: 4,
              status: "completed",
            });
            // Refresh renders
            fetchVersions(jobId!)
              .then((versions) => {
                if (versions.length > 0) {
                  const latest = versions[versions.length - 1]!;
                  fetchTakes(latest.id)
                    .then((takes) => {
                      s.setSession({ takes: takes as any[] });
                    })
                    .catch(() => {});
                }
              })
              .catch(() => {});
          } else if (event.stage === "suno_render_error") {
            s.setSession({
              forgeRunning: false,
              status: "failed",
            });
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
                  const latest = versions[versions.length - 1]!;
                  createTake(latest.id).catch((err) => {
                    console.error("Failed to auto-trigger take:", err);
                    s.setSession({ forgeRunning: false, status: "failed" });
                  });
                }
              })
              .catch(() => {});
          } else {
            // Normal stage progress
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
          s.setSession({ forgeRunning: false, status: "failed" });
        },
      });

      // Start the pipeline
      await startJob(jobId!);
    } catch (err) {
      console.error("Forge failed:", err);
      s.setSession({ forgeRunning: false, status: "failed" });
    }
  }, [
    s.jobId,
    s.genreId,
    s.presetIds,
    s.presetId,
    s.bpm,
    s.key,
    s.scale,
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
    s.forgeDisabled,
  ]);

  // Set onForge in session
  useEffect(() => {
    const disabled = !s.genreId || s.forgeRunning;
    s.setSession({
      onForge: disabled ? null : handleForge,
      forgeDisabled: disabled,
    });
  }, [handleForge, s.genreId, s.forgeRunning]);

  // Cleanup SSE on unmount
  useEffect(() => {
    return () => {
      if (cleanupRef.current) cleanupRef.current();
    };
  }, []);

  // Debounced autosave to backend (only when job exists)
  const persistRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (!s.jobId) return;
    if (persistRef.current) clearTimeout(persistRef.current);
    persistRef.current = setTimeout(() => {
      const inputs: Record<string, unknown> = {
        name: s.name,
        title: s.title,
        genreId: s.genreId,
        presetIds: s.presetIds,
        presetId: s.presetIds[0] ?? s.presetId,
        bpm: s.bpm,
        key: s.key,
        scale: s.scale,
        lyricsMode: s.lyricsMode,
        lyricTopic: s.lyricTopic,
        lyricAngle: s.lyricAngle,
        lyricThemes: s.lyricThemes,
        lyricLines: s.lyricLines,
        lyricsGenerated: s.lyricsGenerated,
        tags: s.tags,
        sections: s.sections,
        reference: s.reference,
      };
      updateJobInputs(s.jobId!, { inputs, name: s.name || undefined }).catch(
        () => {},
      );
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
    s.key,
    s.scale,
    s.lyricsMode,
    s.lyricTopic,
    s.lyricAngle,
    s.lyricThemes.join(","),
    s.lyricsGenerated,
    s.tags.map((t) => `${t.label}:${t.weight}`).join(","),
    s.sections.map((sec) => `${sec.name}:${sec.fn}:${sec.bars}`).join(","),
    s.reference,
  ]);

  const leftW = leftCollapsed ? "42px" : "270px";
  const rightW = rightCollapsed ? "42px" : "320px";
  const libW = libraryCollapsed ? "42px" : "300px";
  const gridCols = `${leftW} minmax(0,1fr) ${rightW} ${libW}`;

  return (
    <div class="compose-shell">
      <div class="compose-main">
        <ContextBar />
        <ForgeStrip />
        <div class="compose-grid" style={{ gridTemplateColumns: gridCols }}>
          <SetupColumn />
          <BundleCanvas />
          <RendersPanel />
          <LibraryPanel />
        </div>
      </div>
    </div>
  );
}
