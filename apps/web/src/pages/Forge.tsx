import { useEffect, useState, useRef } from "preact/hooks";
import { useRouter } from "../lib/router";
import {
  fetchJob,
  startJob,
  cancelJob,
  replayJob,
  connectJobEvents,
} from "../api";
import { useSession } from "../lib/session";
import type { JobInfo, ProgressEvent } from "../api";

const STAGES = [
  {
    id: "ref_interpretation" as const,
    num: "01",
    label: "Reference",
    desc: "Analyzing input",
  },
  { id: "planning" as const, num: "02", label: "Plan", desc: "Song structure" },
  {
    id: "style_writing" as const,
    num: "03",
    label: "Style",
    desc: "Sound design",
  },
  {
    id: "compilation" as const,
    num: "04",
    label: "Compose",
    desc: "Arrangement",
  },
  { id: "review" as const, num: "05", label: "Review", desc: "Quality check" },
  { id: "revision" as const, num: "06", label: "Polish", desc: "Refinement" },
  {
    id: "verification" as const,
    num: "07",
    label: "Verify",
    desc: "Final checks",
  },
  { id: "versioning" as const, num: "08", label: "Version", desc: "Finalize" },
];

const STAGE_IDS: string[] = STAGES.map((s) => s.id);

interface LogEntry {
  time: string;
  tag: string;
  msg: string;
}

function fmt(seconds: number): string {
  const h = String(Math.floor(seconds / 3600)).padStart(2, "0");
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const s = String(seconds % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

export function Forge({ id }: { id: string }) {
  const { navigate } = useRouter();
  const [job, setJob] = useState<JobInfo | null>(null);
  const [stageStatus, setStageStatus] = useState<
    Record<string, "pending" | "active" | "done">
  >({});
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const startTime = useRef(Date.now());
  const terminalRef = useRef<HTMLDivElement>(null);
  const secondsRef = useRef(0);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  useEffect(() => {
    fetchJob(id)
      .then((j) => {
        setJob(j);
        startTime.current = Date.now();

        const ss: Record<string, "pending" | "active" | "done"> = {};
        const idx = STAGE_IDS.indexOf(j.currentStage);

        if (j.status === "completed") {
          STAGE_IDS.forEach((s) => (ss[s] = "done"));
        } else if (j.status === "cancelled" || j.status === "failed") {
          STAGE_IDS.forEach((s) => (ss[s] = "pending"));
        } else {
          STAGE_IDS.forEach((s, i) => {
            if (i < idx) ss[s] = "done";
            else if (i === idx)
              ss[s] = j.status === "in_progress" ? "active" : "pending";
            else ss[s] = "pending";
          });
        }
        setStageStatus(ss);

        const l: LogEntry[] = [];
        l.push({
          time: fmt(0),
          tag: "info",
          msg: `Job: ${j.name ?? "Untitled"} · ${j.genreId}`,
        });
        if (j.status === "in_progress") {
          const activeStage = STAGES.find((s) => s.id === j.currentStage);
          if (activeStage)
            l.push({
              time: fmt(0),
              tag: "stage",
              msg: `${activeStage.label}...`,
            });
        }
        setLogs(l);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  // SSE + polling when running
  useEffect(() => {
    if (!job || job.status !== "in_progress") return;

    const labelOf = (stageId: string) =>
      STAGES.find((s) => s.id === stageId)?.label ?? stageId;

    const unsubscribe = connectJobEvents(id, {
      onProgress: (e: ProgressEvent) => {
        const now = secondsRef.current;
        const label = labelOf(e.stage);

        if (e.status === "started") {
          setStageStatus((prev) => ({ ...prev, [e.stage]: "active" }));
          setLogs((prev) => [
            ...prev,
            { time: fmt(now), tag: "stage", msg: `${label}...` },
          ]);
          if (e.message)
            setLogs((prev) => [
              ...prev,
              { time: fmt(now), tag: "info", msg: e.message! },
            ]);
        } else if (e.status === "completed") {
          setStageStatus((prev) => ({ ...prev, [e.stage]: "done" }));
          setLogs((prev) => [
            ...prev,
            { time: fmt(now), tag: "done", msg: `${label} complete` },
          ]);
          if (e.stage === "versioning") {
            fetchJob(id).then((j) => setJob(j)).catch(() => {});
          }
        } else if (e.status === "error") {
          setStageStatus((prev) => ({ ...prev, [e.stage]: "pending" }));
          setLogs((prev) => [
            ...prev,
            {
              time: fmt(now),
              tag: "error",
              msg: `${label} failed: ${e.error ?? "Unknown"}`,
            },
          ]);
        }
      },
      onConnected: () => {
        setLogs((prev) => [
          ...prev,
          { time: fmt(secondsRef.current), tag: "info", msg: "Connected" },
        ]);
      },
      onError: () => {
        setLogs((prev) => [
          ...prev,
          {
            time: fmt(secondsRef.current),
            tag: "error",
            msg: "Connection lost",
          },
        ]);
      },
    });

    const pollTimer = window.setInterval(() => {
      fetchJob(id).then((j) => {
        if (j.status !== "in_progress") setJob(j);
      }).catch(() => {});
    }, 5000);

    return () => {
      unsubscribe();
      clearInterval(pollTimer);
    };
  }, [job?.status, id]);

  // Elapsed timer
  useEffect(() => {
    if (!job || job.status !== "in_progress") return;

    const t = window.setInterval(() => {
      secondsRef.current = Math.floor((Date.now() - startTime.current) / 1000);
      setElapsed(secondsRef.current);
    }, 1000);

    return () => clearInterval(t);
  }, [job?.status]);

  const handleStart = async () => {
    try {
      setError(null);
      await startJob(id);
      let j = await fetchJob(id);
      let attempts = 0;
      while (j.status === "pending" && attempts < 10) {
        await new Promise((r) => setTimeout(r, 300));
        j = await fetchJob(id);
        attempts++;
      }
      setJob(j);
      startTime.current = Date.now();
      setStageStatus((prev) => {
        const next = { ...prev };
        if (j.status === "in_progress") next[STAGE_IDS[0]!] = "active";
        return next;
      });
      setLogs((prev) => [
        ...prev,
        { time: fmt(0), tag: "stage", msg: "Forge started..." },
      ]);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleCancel = async () => {
    try {
      await cancelJob(id);
      const j = await fetchJob(id);
      setJob(j);
      setStageStatus((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((k) => {
          if (next[k] === "active") next[k] = "pending";
        });
        return next;
      });
      setLogs((prev) => [
        ...prev,
        { time: fmt(elapsed), tag: "warn", msg: "Cancelled by user" },
      ]);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleRetry = async () => {
    try {
      await replayJob(id);
      const j = await fetchJob(id);
      setJob(j);
      setError(null);
      setLogs((prev) => [
        ...prev,
        { time: fmt(elapsed), tag: "stage", msg: "Retrying..." },
      ]);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const doneCount = STAGES.filter((s) => stageStatus[s.id] === "done").length;
  const pct = STAGES.length > 0 ? (doneCount / STAGES.length) * 100 : 0;
  const activeStage = STAGES.find((s) => stageStatus[s.id] === "active");
  const isRunning = job?.status === "in_progress";
  const isPending = job?.status === "pending";
  const isDone = job?.status === "completed";
  const isFailed = job?.status === "failed";
  const isCancelled = job?.status === "cancelled";
  const forgeHeadline = isRunning
    ? "Forging in progress\u2026"
    : isDone
      ? "Bundle complete."
      : "Ready to forge.";

  const { setSession, resetSession } = useSession();
  useEffect(() => {
    if (!job) return;
    let inp: Record<string, unknown> = {};
    try {
      inp = job.inputs ? JSON.parse(job.inputs) : {};
    } catch {
      inp = {};
    }
    const i = inp as Record<string, unknown>;
    setSession({
      jobId: id,
      name: job.name ?? "Untitled",
      genreId: job.genreId,
      presetId: job.presetId,
      bpm: (typeof i.bpm === "number" ? i.bpm : null) as number | null,
      key:
        inp.key && inp.key !== "auto"
          ? `${inp.key}${inp.scale === "minor" ? "m" : ""}`
          : "",
      status: job.status,
      onForge: isDone
        ? () => navigate(`/studio/${id}`)
        : isPending || isCancelled
          ? handleStart
          : null,
      forgeLabel: isDone
        ? "OPEN BUNDLE"
        : isRunning
          ? "FORGING\u2026"
          : "START FORGE",
      forgeDisabled: isRunning,
    });
  }, [job?.status, id]);
  useEffect(() => () => resetSession(), []);

  return (
    <div>
      <div class="forge-header" style={{ maxWidth: 1180 }}>
        <div
          style={{
            fontFamily: "monospace",
            fontSize: 10,
            letterSpacing: "0.22em",
            color: "var(--acc)",
            textTransform: "uppercase",
            marginBottom: 6,
          }}
        >
          The Forge
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: "0 0 16px 0" }}>
          {forgeHeadline}
        </h1>
        <div class="forge-progress">
          <div class="forge-progress-text">
            {doneCount}/{STAGES.length} stages · {Math.round(pct)}%
          </div>
          <div class="forge-progress-bar">
            <div class="forge-progress-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <span class="forge-elapsed">{fmt(elapsed)}</span>
      </div>

      <div class="forge-layout" style={{ maxWidth: 1180 }}>
        <div class="assembly-line">
          <div class="assembly-rail">
            <div class="assembly-rail-progress" style={{ width: `${pct}%` }} />
          </div>
          <div class="assembly-billet" style={{ left: `${pct}%` }} />
          <div class="assembly-stations">
            {STAGES.map((s) => (
              <div class="station" key={s.id}>
                <span class="station-badge">{s.num}</span>
                <div
                  class={`station-dot${stageStatus[s.id] === "done" ? " done" : stageStatus[s.id] === "active" ? " active" : " pending"}`}
                  style={
                    stageStatus[s.id] === "active"
                      ? { animation: "tf-ring 1.2s ease-out infinite" }
                      : undefined
                  }
                />
                <span class="station-label">{s.label}</span>
                <span class="station-desc">{s.desc}</span>
              </div>
            ))}
          </div>
        </div>

        <div
          style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 18 }}
        >
          <div class="terminal">
            <div class="terminal-header">
              <div class="terminal-dot red" />
              <div class="terminal-dot amber" />
              <div class="terminal-dot green" />
              <span class="terminal-title">forge.log</span>
            </div>
            <div class="terminal-body" ref={terminalRef}>
              {logs.map((log, i) => (
                <div class="log-line" key={i}>
                  <span class="log-timestamp">{log.time}</span>
                  <span class={`log-tag ${log.tag}`}>
                    {log.tag.toUpperCase()}
                  </span>
                  <span class="log-message">{log.msg}</span>
                </div>
              ))}
              <div class="log-line">
                <span class="log-cursor" />
              </div>
            </div>
          </div>

          <div class="run-monitor">
            <div class="run-monitor-header">Run Monitor</div>
            <table class="run-monitor-table">
              <tbody>
                <tr>
                  <td>Stage</td>
                  <td>
                    {activeStage
                      ? `${activeStage.label} · ${activeStage.desc}`
                      : isDone
                        ? "Complete"
                        : "—"}
                  </td>
                </tr>
                <tr>
                  <td>Model</td>
                  <td>kimi-k2.5</td>
                </tr>
                <tr>
                  <td>Elapsed</td>
                  <td>{fmt(elapsed)}</td>
                </tr>
                <tr>
                  <td>Est. cost</td>
                  <td>
                    ~$
                    {Math.max(
                      1,
                      Math.round((elapsed / 60) * 0.02 * 100) / 100,
                    ).toFixed(2)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {error && <div class="forge-error">{error}</div>}

        <div class="forge-actions">
          {isPending && !isRunning && (
            <button class="btn-primary" onClick={handleStart}>
              Start Forge
            </button>
          )}
          {isRunning && (
            <button class="btn-secondary danger" onClick={handleCancel}>
              Cancel
            </button>
          )}
          {isDone && (
            <button
              class="btn-primary"
              onClick={() => navigate(`/studio/${id}`)}
            >
              Open Bundle
            </button>
          )}
          {isFailed && (
            <button class="btn-primary" onClick={handleRetry}>
              Retry
            </button>
          )}
          {isCancelled && (
            <button class="btn-primary" onClick={handleStart}>
              Restart
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
