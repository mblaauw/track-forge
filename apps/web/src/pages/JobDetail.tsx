import { useState, useEffect, useRef } from "preact/hooks";
import {
  fetchJob,
  startJob,
  fetchVersions,
  connectJobEvents,
  type JobInfo,
  type VersionInfo,
  type ProgressEvent,
} from "../api";
import { useRouter, Link } from "../lib/router";
import { StatusBadge, StageIndicator } from "../components/DynamicForm";

export function JobDetail() {
  const { path } = useRouter();
  const jobId = path.replace("/job/", "");

  const [job, setJob] = useState<JobInfo | null>(null);
  const [versions, setVersions] = useState<VersionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [liveStage, setLiveStage] = useState<string | null>(null);
  const closeSseRef = useRef<(() => void) | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([fetchJob(jobId), fetchVersions(jobId)])
      .then(([j, v]) => {
        setJob(j);
        setVersions(v);
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

      // Connect SSE for live progress
      const close = connectJobEvents(jobId, {
        onProgress: (ev: ProgressEvent) => {
          if (ev.status === "started") {
            setLiveStage(ev.stage);
          } else if (ev.status === "error") {
            setLiveStage(null);
            setError(ev.error ?? "Pipeline error");
          } else if (ev.status === "completed" && ev.stage === "versioning") {
            setLiveStage(null);
            // Refresh job + versions
            Promise.all([fetchJob(jobId), fetchVersions(jobId)])
              .then(([j, v]) => {
                setJob(j);
                setVersions(v);
              });
          }
        },
        onError: () => {
          // Fallback: refresh job state
          fetchJob(jobId).then(setJob);
        },
      });
      closeSseRef.current = close;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStarting(false);
    }
  };

  if (loading) return <p class="muted">Loading…</p>;
  if (error) return <p class="error">{error}</p>;
  if (!job) return <p class="error">Job not found</p>;

  return (
    <div>
      <p>
        <Link to="/">← Back to Jobs</Link>
      </p>

      <div class="page-header">
        <h2>Job {job.id.slice(0, 8)}</h2>
        <StatusBadge status={job.status} />
      </div>

      {/* Live stage indicator */}
      {liveStage && (
        <div class="live-stage">
          <span class="pulse-dot" /> Running: <strong>{liveStage.replace(/_/g, " ")}</strong>
        </div>
      )}

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
        <p class="muted">Pipeline running…</p>
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
    </div>
  );
}
