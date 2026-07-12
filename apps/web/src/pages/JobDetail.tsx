import { useState, useEffect, useRef } from "preact/hooks";
import {
  fetchJob,
  startJob,
  renameJob,
  fetchVersions,
  connectJobEvents,
  type JobInfo,
  type VersionInfo,
  type ProgressEvent,
} from "../api";
import { useRouter, Link } from "../lib/router";
import { StatusBadge, StageIndicator } from "../components/DynamicForm";

// ── Pipeline stage definitions ──────────────────────────────────────

const PIPELINE_STAGES = [
  { id: "ref_interpretation", label: "Reference", icon: "📄" },
  { id: "planning", label: "Planning", icon: "📋" },
  { id: "style_writing", label: "Style Writing", icon: "🎨" },
  { id: "compilation", label: "Compilation", icon: "⚙️" },
  { id: "review", label: "Review", icon: "🔍" },
  { id: "revision", label: "Revision", icon: "✏️" },
  { id: "verification", label: "Verification", icon: "✅" },
  { id: "versioning", label: "Versioning", icon: "📦" },
] as const;

// ── JobDetail / Studio Shell ────────────────────────────────────────

export function JobDetail() {
  const { path } = useRouter();
  const jobId = path.replace("/job/", "");

  const [job, setJob] = useState<JobInfo | null>(null);
  const [versions, setVersions] = useState<VersionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [liveStage, setLiveStage] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const closeSseRef = useRef<(() => void) | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([fetchJob(jobId), fetchVersions(jobId)])
      .then(([j, v]) => {
        setJob(j);
        setVersions(v);
        setNameInput(j.name ?? "");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (jobId) load();
    return () => closeSseRef.current?.();
  }, [jobId]);

  const handleStart = async () => {
    setStarting(true);
    try {
      await startJob(jobId);

      const close = connectJobEvents(jobId, {
        onProgress: (ev: ProgressEvent) => {
          if (ev.status === "started") {
            setLiveStage(ev.stage);
          } else if (ev.status === "error") {
            setLiveStage(null);
            setError(ev.error ?? "Pipeline error");
          } else if (ev.status === "completed" && ev.stage === "versioning") {
            setLiveStage(null);
            Promise.all([fetchJob(jobId), fetchVersions(jobId)])
              .then(([j, v]) => {
                setJob(j);
                setVersions(v);
              });
          }
        },
        onError: () => {
          fetchJob(jobId).then(setJob);
        },
      });
      closeSseRef.current = close;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStarting(false);
    }
  };

  const handleRename = async () => {
    if (!job || !nameInput.trim()) return;
    try {
      const updated = await renameJob(jobId, nameInput.trim());
      setJob(updated);
      setRenaming(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  // Determine which stages are completed vs active vs pending
  const stageIndex = (id: string) => PIPELINE_STAGES.findIndex((s) => s.id === id);
  const currentIdx = job ? stageIndex(job.currentStage) : -1;
  const liveIdx = liveStage ? stageIndex(liveStage) : -1;

  if (loading) return <p class="muted">Loading…</p>;
  if (error) return <p class="error">{error}</p>;
  if (!job) return <p class="error">Project not found</p>;

  return (
    <div class="studio-shell">
      {/* Sidebar */}
      <aside class="studio-sidebar">
        <div class="sidebar-header">
          <Link to="/">← Library</Link>
        </div>

        {/* Project name / inline rename */}
        <div class="sidebar-project">
          {renaming ? (
            <div class="rename-form">
              <input
                type="text"
                value={nameInput}
                onInput={(e) => setNameInput((e.target as HTMLInputElement).value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleRename(); if (e.key === "Escape") { setRenaming(false); setNameInput(job.name ?? ""); } }}
                autoFocus
              />
              <div class="rename-actions">
                <button class="btn btn-xs" onClick={handleRename}>Save</button>
                <button class="btn btn-xs" onClick={() => { setRenaming(false); setNameInput(job.name ?? ""); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <div class="sidebar-name" onClick={() => { setNameInput(job.name ?? ""); setRenaming(true); }}>
              <h2>{job.name || "Untitled Project"}</h2>
              {!job.name && <span class="muted">(click to name)</span>}
            </div>
          )}
        </div>

        {/* Stage list */}
        <nav class="stage-nav">
          {PIPELINE_STAGES.map((stage, idx) => {
            const isLive = liveStage === stage.id;
            const isCurrent = !liveStage && idx === currentIdx;
            const isDone = idx < currentIdx || (liveStage ? idx < liveIdx : false);
            const isPending = idx > (liveStage ? liveIdx : currentIdx);

            let cls = "stage-item";
            if (isLive) cls += " live";
            if (isCurrent) cls += " current";
            if (isDone) cls += " done";
            if (isPending) cls += " pending";

            return (
              <div class={cls} key={stage.id}>
                <span class="stage-icon">{stage.icon}</span>
                <span class="stage-label">{stage.label}</span>
                {isLive && <span class="pulse-dot" />}
                {isDone && <span class="check-mark">✓</span>}
              </div>
            );
          })}
        </nav>

        {/* Job status summary */}
        <div class="sidebar-footer">
          <StatusBadge status={job.status} />
          <span class="muted">{job.genreId}</span>
        </div>
      </aside>

      {/* Main content area */}
      <main class="studio-content">
        {/* Header */}
        <div class="studio-header">
          <h1>{job.name || "Untitled Project"}</h1>
          <div class="studio-actions">
            <button class="btn btn-sm" onClick={() => { setNameInput(job.name ?? ""); setRenaming(true); }}>
              Rename
            </button>
          </div>
        </div>

        {/* Live stage indicator */}
        {liveStage && (
          <div class="live-stage">
            <span class="pulse-dot" /> Running: <strong>{liveStage.replace(/_/g, " ")}</strong>
          </div>
        )}

        {/* Project details card */}
        <div class="detail-card">
          <div class="detail-row">
            <span class="detail-label">Genre</span>
            <span>{job.genreId}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Preset</span>
            <span>{job.presetId}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Current Stage</span>
            <StageIndicator stage={job.currentStage} />
          </div>
          <div class="detail-row">
            <span class="detail-label">Stage Attempt</span>
            <span>{job.stageAttempt}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Created</span>
            <span>{new Date(job.createdAt).toLocaleString()}</span>
          </div>
          {job.error && (
            <div class="detail-row">
              <span class="detail-label">Error</span>
              <span class="error">{job.error}</span>
            </div>
          )}
        </div>

        {/* Inputs */}
        {job.inputs && (
          <details>
            <summary>Inputs</summary>
            <pre class="code-block">{JSON.stringify(JSON.parse(job.inputs), null, 2)}</pre>
          </details>
        )}

        {/* Actions */}
        {job.status === "pending" && (
          <div class="form-actions">
            <button class="btn btn-primary" onClick={handleStart} disabled={starting}>
              {starting ? "Starting…" : "Start Pipeline"}
            </button>
          </div>
        )}
        {job.status === "in_progress" && !liveStage && (
          <p class="muted">Pipeline running (background)…</p>
        )}

        {/* Versions */}
        <h3>Versions</h3>
        {versions.length === 0 ? (
          <p class="muted">No versions yet.</p>
        ) : (
          <table class="job-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Status</th>
                <th>Artifacts</th>
                <th>Created</th>
                <th>Finalized</th>
              </tr>
            </thead>
            <tbody>
              {versions.map((v) => (
                <tr key={v.id}>
                  <td class="mono">{v.number}</td>
                  <td>
                    <StatusBadge status={v.status} />
                  </td>
                  <td>{v.artifacts?.length ?? 0} artifacts</td>
                  <td class="muted">{new Date(v.createdAt).toLocaleDateString()}</td>
                  <td class="muted">
                    {v.finalizedAt ? new Date(v.finalizedAt).toLocaleDateString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </main>
    </div>
  );
}
