import { useState, useEffect, useRef } from "preact/hooks";
import {
  fetchJob,
  startJob,
  renameJob,
  fetchVersions,
  connectJobEvents,
  updateArtifact,
  setNlAdjustments,
  submitReview,
  fetchPayloadPreview,
  fetchGenerations,
  retryGeneration,
  fetchGenerationStatus,
  promoteVersion,
  rollbackToVersion,
  fetchVersionTree,
  type JobInfo,
  type VersionInfo,
  type VersionTreeNode,
  type ProgressEvent,
  type PayloadPreviewResult,
  type GenerationInfo,
  type SunoFeedItemInfo,
} from "../api";
import { useRouter, Link } from "../lib/router";
import { StatusBadge, StageIndicator } from "../components/DynamicForm";

// ── Pipeline stage definitions ──────────────────────────────────────

const PIPELINE_STAGES = [
  { id: "ref_interpretation", label: "Reference", icon: "ph-waves" },
  { id: "planning", label: "Planning", icon: "ph-notebook" },
  { id: "style_writing", label: "Style Writing", icon: "ph-palette" },
  { id: "compilation", label: "Compilation", icon: "ph-gear" },
  { id: "review", label: "Review", icon: "ph-magnifying-glass" },
  { id: "revision", label: "Revision", icon: "ph-pencil-line" },
  { id: "verification", label: "Verification", icon: "ph-seal-check" },
  { id: "versioning", label: "Versioning", icon: "ph-package" },
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
  const [selectedVersion, setSelectedVersion] = useState<VersionInfo | null>(null);
  const [nlInput, setNlInput] = useState("");
  const [savingNl, setSavingNl] = useState(false);
  const [acceptedFindings, setAcceptedFindings] = useState<Set<number>>(new Set());
  const [submittingReview, setSubmittingReview] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [rollingBack, setRollingBack] = useState(false);
  const [versionTree, setVersionTree] = useState<VersionTreeNode[]>([]);
  const [showTree, setShowTree] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const closeSseRef = useRef<(() => void) | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([fetchJob(jobId), fetchVersions(jobId)])
      .then(([j, v]) => {
        setJob(j);
        setVersions(v);
        setNameInput(j.name ?? "");
        setNlInput(j.nlAdjustments ?? "");
        if (v.length > 0 && !selectedVersion) setSelectedVersion(v[0] ?? null);
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
          } else if (ev.status === "completed") {
            if (ev.stage === "versioning") {
              setLiveStage(null);
              Promise.all([fetchJob(jobId), fetchVersions(jobId)])
                .then(([j, v]) => {
                  setJob(j);
                  setVersions(v);
                  const currentId = selectedVersion?.id;
                  if (currentId) {
                    const fresh = v.find((x) => x.id === currentId);
                    if (fresh) setSelectedVersion(fresh);
                  }
                });
            } else if (ev.stage === "review") {
              fetchJob(jobId).then(setJob);
            }
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

  const handlePromote = async () => {
    if (!selectedVersion) return;
    setPromoting(true);
    try {
      const updated = await promoteVersion(selectedVersion.id);
      setVersions((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
      setSelectedVersion(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPromoting(false);
    }
  };

  const handleRollback = async () => {
    if (!selectedVersion) return;
    setRollingBack(true);
    try {
      const created = await rollbackToVersion(jobId, selectedVersion.id);
      setVersions((prev) => [...prev, created]);
      setSelectedVersion(created);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRollingBack(false);
    }
  };

  const loadVersionTree = async () => {
    try {
      const tree = await fetchVersionTree(jobId);
      setVersionTree(tree);
      setShowTree(true);
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
                <span class="stage-icon"><i class={`ph ${stage.icon}`}></i></span>
                <span class="stage-label">{stage.label}</span>
                {isLive && <span class="pulse-dot" />}
                {isDone && <span class="check-mark">✓</span>}
              </div>
            );
          })}
        </nav>

        {/* Natural-language adjustments */}
        <div class="sidebar-nl">
          <label>NL Adjustments</label>
          <textarea
            class="nl-input"
            rows={4}
            value={nlInput}
            disabled={savingNl}
            onInput={(e) => setNlInput((e.target as HTMLTextAreaElement).value)}
            placeholder="e.g. Make it more energetic, shorten the intro..."
          />
          <button
            class="btn btn-xs"
            disabled={savingNl}
            onClick={async () => {
              setSavingNl(true);
              try {
                const updated = await setNlAdjustments(jobId, nlInput || null);
                setJob(updated);
              } catch (e) {
                console.error(e);
              } finally {
                setSavingNl(false);
              }
            }}
          >
            {savingNl ? "Saving…" : "Save Adjustments"}
          </button>
        </div>

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

        {/* Review panel */}
        {job.status === "in_progress" && job.currentStage === "review" && job.findings && (
          <ReviewPanel
            job={job}
            acceptedFindings={acceptedFindings}
            onToggle={(idx: number) => {
              setAcceptedFindings((prev) => {
                const next = new Set(prev);
                if (next.has(idx)) next.delete(idx); else next.add(idx);
                return next;
              });
            }}
            onAcceptAll={() => {
              const findings = JSON.parse(job.findings!) as unknown[];
              setAcceptedFindings(new Set(findings.map((_, i) => i)));
            }}
            onRejectAll={() => setAcceptedFindings(new Set())}
            onSubmit={async () => {
              setSubmittingReview(true);
              try {
                const findings = JSON.parse(job.findings!) as unknown[];
                const kept = findings.filter((_, i) => acceptedFindings.has(i));
                await submitReview(job.id, kept);
                setAcceptedFindings(new Set());
                fetchJob(jobId).then(setJob);
              } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
              } finally {
                setSubmittingReview(false);
              }
            }}
            submitting={submittingReview}
          />
        )}

        {/* Versions */}
        <div class="version-section">
          <div class="version-section-header">
            <h3>Versions</h3>
            <div class="version-actions">
              {versions.length > 0 && (
                <>
                  <button class="btn btn-xs" onClick={loadVersionTree}>
                    {showTree ? "Hide Tree" : "Version Tree"}
                  </button>
                  {selectedVersion && versions.length > 1 && (
                    <button class="btn btn-xs" onClick={() => setShowDiff(!showDiff)}>
                      {showDiff ? "Hide Diff" : "Compare"}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {versions.length === 0 ? (
            <p class="muted">No versions yet.</p>
          ) : (
            <div class="version-panel">
              {/* Version selector tabs */}
              <div class="version-tabs">
                {versions.map((v) => (
                  <button
                    key={v.id}
                    class={`version-tab${selectedVersion?.id === v.id ? " active" : ""}`}
                    onClick={() => setSelectedVersion(v)}
                  >
                    v{v.number}
                    {v.status === "final" ? " ✓" : ""}
                  </button>
                ))}
              </div>

              {showTree && versionTree.length > 0 && (
                <VersionTreeView nodes={versionTree} onSelect={(v) => setSelectedVersion(v)} />
              )}

              {showDiff && selectedVersion && versions.length > 1 && (
                <VersionDiff
                  versionA={selectedVersion}
                  versions={versions}
                />
              )}

              {/* Artifact editor for selected version */}
              {selectedVersion && (
                <>
                  <div class="version-meta">
                    <span class="muted">
                      v{selectedVersion.number}
                      {selectedVersion.stage && ` — ${selectedVersion.stage.replace(/_/g, " ")}`}
                      {selectedVersion.parentVersionId && " (rollback)"}
                    </span>
                    <span class="muted">
                      {new Date(selectedVersion.createdAt).toLocaleString()}
                    </span>
                    <span class={`badge ${selectedVersion.status === "final" ? "badge-ok" : "badge-pending"}`}>
                      {selectedVersion.status}
                    </span>
                  </div>

                  {selectedVersion.status !== "final" && (
                    <div class="version-actions-bar">
                      <button
                        class="btn btn-xs btn-primary"
                        onClick={handlePromote}
                        disabled={promoting}
                      >
                        {promoting ? "Promoting…" : "Promote to Final"}
                      </button>
                      <button
                        class="btn btn-xs"
                        onClick={handleRollback}
                        disabled={rollingBack}
                      >
                        {rollingBack ? "Rolling back…" : "Rollback to Here"}
                      </button>
                    </div>
                  )}

                  <ArtifactEditor
                    version={selectedVersion}
                    onUpdate={(updated) => {
                      setVersions((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
                      setSelectedVersion(updated);
                    }}
                  />
                </>
              )}
            </div>
          )}
        </div>

        {/* Suno payload preview */}
        <PayloadPreview jobId={jobId} />

        {/* Suno generations */}
        <GenerationPanel jobId={jobId} />
      </main>
    </div>
  );
}

// ── Artifact Editor ───────────────────────────────────────────────────

const ARTIFACT_LABELS: Record<string, string> = {
  title: "Title",
  style: "Style",
  excluded_styles: "Excluded Styles",
  lyrics: "Lyrics",
};

interface ArtifactEditorProps {
  version: VersionInfo;
  onUpdate: (updated: VersionInfo) => void;
}

// ── Review Panel ───────────────────────────────────────────────────────

interface ReviewPanelProps {
  job: JobInfo;
  acceptedFindings: Set<number>;
  onToggle: (idx: number) => void;
  onAcceptAll: () => void;
  onRejectAll: () => void;
  onSubmit: () => Promise<void>;
  submitting: boolean;
}

function ReviewPanel({ job, acceptedFindings, onToggle, onAcceptAll, onRejectAll, onSubmit, submitting }: ReviewPanelProps) {
  let findings: { severity: string; field: string; message: string; autoFixPolicy: string }[] = [];
  try { findings = JSON.parse(job.findings ?? "[]"); } catch { /* ignore */ }

  let compiled: Record<string, string> = {};
  try { compiled = JSON.parse(job.compiledJson ?? "{}"); } catch { /* ignore */ }

  const severityClass = (s: string) => {
    if (s === "error") return "severity-error";
    if (s === "warning") return "severity-warning";
    return "severity-info";
  };

  return (
    <div class="review-panel">
      <h3>Review Findings</h3>

      {/* Compiled artifacts reference */}
      {Object.keys(compiled).length > 0 && (
        <details class="review-compiled">
          <summary>Compiled Output</summary>
          {Object.entries(compiled).map(([key, val]) => (
            <div class="compiled-field" key={key}>
              <label>{key}</label>
              <pre class="code-block">{val}</pre>
            </div>
          ))}
        </details>
      )}

      {/* Findings list */}
      {findings.length === 0 ? (
        <p class="muted">No issues found.</p>
      ) : (
        <>
          <div class="review-batch-actions">
            <button class="btn btn-xs" onClick={onAcceptAll}>Accept All</button>
            <button class="btn btn-xs" onClick={onRejectAll}>Reject All</button>
          </div>

          <div class="findings-list">
            {findings.map((f, i) => {
              const accepted = acceptedFindings.has(i);
              return (
                <div class={`finding-item${accepted ? " accepted" : " rejected"}`} key={i}>
                  <span class={`severity-badge ${severityClass(f.severity)}`}>{f.severity}</span>
                  <div class="finding-body">
                    <span class="finding-field">{f.field}</span>
                    <span class="finding-msg">{f.message}</span>
                    {f.autoFixPolicy && <span class="finding-policy">({f.autoFixPolicy})</span>}
                  </div>
                  <button class="btn btn-xs" onClick={() => onToggle(i)}>
                    {accepted ? "Reject" : "Accept"}
                  </button>
                </div>
              );
            })}
          </div>

          <div class="review-submit">
            <button class="btn btn-primary" onClick={onSubmit} disabled={submitting}>
              {submitting ? "Submitting…" : `Submit Review (${acceptedFindings.size} findings)`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Artifact Editor ───────────────────────────────────────────────────

// ── Suno Generations Panel ─────────────────────────────────────────────

interface GenerationPanelProps {
  jobId: string;
}

function GenerationPanel({ jobId }: GenerationPanelProps) {
  const [generations, setGenerations] = useState<GenerationInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [liveStatus, setLiveStatus] = useState<Record<string, SunoFeedItemInfo | null>>({});
  const [refreshing, setRefreshing] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetchGenerations(jobId)
      .then(setGenerations)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [jobId]);

  const checkLiveStatus = async (id: string) => {
    setRefreshing(id);
    try {
      const feed = await fetchGenerationStatus(id);
      setLiveStatus((prev) => ({ ...prev, [id]: feed }));
    } catch {
      setLiveStatus((prev) => ({ ...prev, [id]: null }));
    } finally {
      setRefreshing(null);
    }
  };

  const handleRetry = async (id: string) => {
    try {
      await retryGeneration(jobId, id);
      load();
    } catch {
      // error handled silently
    }
  };

  return (
    <div class="generation-panel">
      <h3>
        Suno Generations
        <button class="btn btn-xs" onClick={load} disabled={loading}>
          {loading ? "Loading…" : "Refresh"}
        </button>
      </h3>

      {generations.length === 0 && !loading && (
        <p class="muted">No generations yet.</p>
      )}

      {generations.map((gen) => {
        const live = liveStatus[gen.id];
        const displayStatus = live?.status ?? gen.status;
        const displayAudioUrl = live?.audioUrl ?? gen.audioUrl;
        const displayError = live?.error ?? gen.error;

        return (
          <div class={`gen-item gen-${displayStatus}`} key={gen.id}>
            <div class="gen-header">
              <span class={`gen-status-badge status-${displayStatus}`}>
                {displayStatus}
              </span>
              <span class="gen-id" title={gen.id}>
                {gen.id.slice(0, 8)}…
              </span>
              {gen.generatedTitle && (
                <span class="gen-title">{gen.generatedTitle}</span>
              )}
              {gen.duration && (
                <span class="gen-duration">{gen.duration}s</span>
              )}
            </div>

            {displayError && (
              <p class="gen-error error">{displayError}</p>
            )}

            <div class="gen-actions">
              <button
                class="btn btn-xs"
                onClick={() => checkLiveStatus(gen.id)}
                disabled={refreshing === gen.id}
              >
                {refreshing === gen.id ? "Checking…" : "Check Status"}
              </button>
              {displayStatus === "error" && (
                <button class="btn btn-xs" onClick={() => handleRetry(gen.id)}>
                  Retry
                </button>
              )}
            </div>

            {displayAudioUrl && (
              <div class="gen-audio">
                <audio controls src={displayAudioUrl}>
                  Your browser does not support the audio element.
                </audio>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Suno Payload Preview ───────────────────────────────────────────────

interface PayloadPreviewProps {
  jobId: string;
}

function PayloadPreview({ jobId }: PayloadPreviewProps) {
  const [preview, setPreview] = useState<PayloadPreviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPreview = () => {
    setLoading(true);
    setError(null);
    fetchPayloadPreview(jobId)
      .then(setPreview)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    // Auto-load when component mounts
    loadPreview();
  }, [jobId]);

  return (
    <div class="payload-preview">
      <h3>
        Suno Payload Preview
        <button class="btn btn-xs" onClick={loadPreview} disabled={loading}>
          {loading ? "Loading…" : "Refresh"}
        </button>
      </h3>
      {error && <p class="error">{error}</p>}
      {!loading && !error && !preview && <p class="muted">No payload data available.</p>}
      {preview && (
        <details open>
          <summary>Payload to Suno</summary>

          {/* Warnings */}
          {preview.warnings.length > 0 && (
            <div class="payload-warnings">
              {preview.warnings.map((w, i) => (
                <p class="warning" key={i}>⚠ {w.message}</p>
              ))}
            </div>
          )}

          {/* Request fields */}
          <div class="payload-fields">
            <div class="payload-field">
              <label>Title</label>
              <pre class="code-block">{preview.request.title}</pre>
            </div>
            <div class="payload-field">
              <label>Style</label>
              <pre class="code-block">{preview.request.style}</pre>
            </div>
            {preview.request.negativeTags && (
              <div class="payload-field">
                <label>Negative Tags</label>
                <pre class="code-block">{preview.request.negativeTags}</pre>
              </div>
            )}
            <div class="payload-field">
              <label>Lyrics</label>
              <pre class="code-block">{preview.request.prompt || "(instrumental — empty)"}</pre>
            </div>
            <div class="payload-field-row">
              <span><strong>Instrumental:</strong> {preview.request.instrumental ? "Yes" : "No"}</span>
              {preview.request.model && (
                <span><strong>Model:</strong> {preview.request.model}</span>
              )}
            </div>
          </div>
        </details>
      )}
    </div>
  );
}

// ── Version Tree View ──────────────────────────────────────────────────

interface VersionTreeViewProps {
  nodes: VersionTreeNode[];
  onSelect: (v: VersionInfo) => void;
}

function VersionTreeView({ nodes, onSelect }: VersionTreeViewProps) {
  const renderNode = (node: VersionTreeNode, depth: number) => (
    <div key={node.id} class="tree-node" style={{ marginLeft: `${depth * 24}px` }}>
      <div class="tree-node-label" onClick={() => onSelect(node)}>
        <span class={`tree-node-dot ${node.status === "final" ? "dot-final" : "dot-draft"}`} />
        <span>v{node.number}</span>
        {node.status === "final" && <span class="check-mark"> ✓</span>}
        {node.stage && <span class="muted">({node.stage.replace(/_/g, " ")})</span>}
      </div>
      {node.children.map((child) => renderNode(child, depth + 1))}
    </div>
  );

  return (
    <div class="version-tree">
      <h4>Version Tree</h4>
      {nodes.map((n) => renderNode(n, 0))}
    </div>
  );
}

// ── Version Diff View ──────────────────────────────────────────────────

interface VersionDiffProps {
  versionA: VersionInfo;
  versions: VersionInfo[];
  onSelectVersion?: (v: VersionInfo | null) => void;
}

function VersionDiff({ versionA, versions, onSelectVersion }: VersionDiffProps) {
  const [versionB, setVersionB] = useState<VersionInfo | null>(null);

  const otherVersions = versions.filter((v) => v.id !== versionA.id);

  const artifactsA = (versionA.artifacts ?? []) as Array<{ type: string; value: string }>;
  const artifactsB = (versionB?.artifacts ?? []) as Array<{ type: string; value: string }>;

  const allTypes = [...new Set([
    ...artifactsA.map((a) => a.type),
    ...artifactsB.map((a) => a.type),
  ])];

  return (
    <div class="version-diff">
      <h4>Compare Versions</h4>
      <div class="diff-selector">
        <label>Compare v{versionA.number} with:</label>
        <select onChange={(e) => {
          const id = (e.target as HTMLSelectElement).value;
          const found = otherVersions.find((v) => v.id === id);
          setVersionB(found ?? null);
        }}>
          <option value="">Select version…</option>
          {otherVersions.map((v) => (
            <option key={v.id} value={v.id}>v{v.number}</option>
          ))}
        </select>
      </div>

      {versionB && (
        <div class="diff-content">
          {allTypes.map((type) => {
            const valA = artifactsA.find((a) => a.type === type)?.value ?? "";
            const valB = artifactsB.find((a) => a.type === type)?.value ?? "";
            const changed = valA !== valB;

            return (
              <div class={`diff-field ${changed ? "diff-changed" : ""}`} key={type}>
                <label>{ARTIFACT_LABELS[type] ?? type}</label>
                <div class="diff-columns">
                  <div class="diff-side diff-old">
                    <span class="diff-label">v{versionA.number}</span>
                    {type === "lyrics" ? (
                      <pre class="code-block">{valA || "(empty)"}</pre>
                    ) : (
                      <span>{valA || "(empty)"}</span>
                    )}
                  </div>
                  <div class="diff-side diff-new">
                    <span class="diff-label">v{versionB.number}</span>
                    {type === "lyrics" ? (
                      <pre class="code-block">{valB || "(empty)"}</pre>
                    ) : (
                      <span>{valB || "(empty)"}</span>
                    )}
                  </div>
                </div>
                {changed && <span class="diff-badge">changed</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ArtifactEditor({ version, onUpdate }: ArtifactEditorProps) {
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const artifacts = (version.artifacts ?? []) as Array<{ type: string; value: string }>;
  const isFinal = version.status === "final";

  const handleEdit = async (artifactType: string) => {
    const value = editing[artifactType]?.trim();
    if (value === undefined) return;

    setSaving(artifactType);
    setSaveError(null);
    try {
      const updated = await updateArtifact(version.id, artifactType, value);
      onUpdate(updated);
      setEditing((prev) => {
        const next = { ...prev };
        delete next[artifactType];
        return next;
      });
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(null);
    }
  };

  if (artifacts.length === 0) {
    return <p class="muted">No artifacts in this version.</p>;
  }

  return (
    <div class="artifact-editor">
      {saveError && <p class="error">{saveError}</p>}
      {artifacts.map((a) => {
        const label = ARTIFACT_LABELS[a.type] ?? a.type;
        const isEditing = a.type in editing;

        return (
          <div class="artifact-field" key={a.type}>
            <label>{label}</label>
            {a.type === "lyrics" ? (
              <textarea
                class="artifact-input"
                rows={6}
                value={isEditing ? editing[a.type] : a.value}
                disabled={isFinal || saving === a.type}
                onInput={(e) =>
                  setEditing((prev) => ({ ...prev, [a.type]: (e.target as HTMLTextAreaElement).value }))
                }
              />
            ) : (
              <input
                type="text"
                class="artifact-input"
                value={isEditing ? editing[a.type] : a.value}
                disabled={isFinal || saving === a.type}
                onInput={(e) =>
                  setEditing((prev) => ({ ...prev, [a.type]: (e.target as HTMLInputElement).value }))
                }
              />
            )}
            {!isFinal && (
              <button
                class="btn btn-xs"
                onClick={() => handleEdit(a.type)}
                disabled={saving !== null}
              >
                {saving === a.type ? "Saving…" : "Save"}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
