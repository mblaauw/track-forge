import { useState, useEffect } from "preact/hooks";
import { fetchJobs, deleteJob, type JobInfo } from "../api";
import { Link } from "../lib/router";
import { StatusBadge } from "../components/DynamicForm";

const GENRE_LABELS: Record<string, string> = {
  edm: "EDM",
  hiphop: "Hip-Hop",
};

export function JobList() {
  const [jobs, setJobs] = useState<JobInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [genreFilter, setGenreFilter] = useState("");

  const load = () => {
    setLoading(true);
    fetchJobs()
      .then(setJobs)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const genres = [...new Set(jobs.map((j) => j.genreId))];
  const completedCount = jobs.filter((j) => j.status === "completed").length;
  const activeCount = jobs.filter((j) => j.status === "in_progress").length;
  const genreCount = new Set(jobs.map((j) => j.genreId)).size;

  const filtered = jobs.filter((j) => {
    if (genreFilter && j.genreId !== genreFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (j.name ?? "").toLowerCase().includes(q) ||
      j.id.toLowerCase().includes(q) ||
      j.genreId.toLowerCase().includes(q)
    );
  });

  const handleDelete = async (id: string, name: string | null, e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Delete project "${name ?? id.slice(0, 8)}"?`)) return;
    try {
      await deleteJob(id);
      setJobs((prev) => prev.filter((j) => j.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const statusIcon = (status: string) => {
    if (status === "completed") return "ph-check-circle";
    if (status === "failed" || status === "cancelled") return "ph-x-circle";
    if (status === "in_progress" || status === "pending") return "ph-hourglass";
    return "ph-dot";
  };

  if (loading) {
    return (
      <div class="page-shell">
        <section class="page-hero">
          <div>
            <p class="hero-kicker">Library</p>
            <h2>Project Library</h2>
            <p class="hero-copy">Browse jobs, inspect versions, and keep generation work moving.</p>
          </div>
        </section>
        <div class="surface-card">
          <div class="card-grid">
            {[1, 2, 3].map((i) => (
              <div key={i} class="job-card">
                <div class="job-card-body">
                  <div class="skeleton skeleton-lg" style="margin-bottom:6px" />
                  <div class="skeleton skeleton-sm" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) return <p class="error">Error: {error}</p>;

  return (
    <div class="page-shell">
      <section class="page-hero">
        <div>
          <p class="hero-kicker">Library</p>
          <h2>Project Library</h2>
          <p class="hero-copy">Browse jobs, inspect versions, and keep generation work moving.</p>
          <div class="hero-metrics">
            <span class="metric-pill">{jobs.length} total</span>
            <span class="metric-pill">{activeCount} active</span>
            <span class="metric-pill">{completedCount} done</span>
            <span class="metric-pill">{genreCount} genres</span>
          </div>
        </div>
        <div class="hero-actions">
          <Link to="/create"><button class="btn btn-primary">+ New Project</button></Link>
        </div>
      </section>

      <section class="surface-card list-panel">
        <div class="filter-bar">
          <input
            type="text"
            placeholder="Search projects…"
            value={search}
            onInput={(e) => setSearch((e.target as HTMLInputElement).value)}
            class="search-input"
          />
          <select
            value={genreFilter}
            onChange={(e) => setGenreFilter((e.target as HTMLSelectElement).value)}
            class="filter-select"
          >
            <option value="">All Genres</option>
            {genres.map((g) => (
              <option key={g} value={g}>{GENRE_LABELS[g] ?? g}</option>
            ))}
          </select>
        </div>

        {filtered.length === 0 ? (
          <div class="empty-state">
            <div class="empty-state-icon"><i class="ph ph-music-note"></i></div>
            <p class="empty-state-title">No projects found</p>
            <p class="empty-state-desc">Create your first project to start generating music with AI.</p>
            <Link to="/create"><button class="btn btn-accent">+ New Project</button></Link>
          </div>
        ) : (
          <div class="card-grid">
            {filtered.map((job) => (
              <Link to={`/job/${job.id}`}>
                <div class="job-card" style="cursor:pointer">
                  <div class="job-card-body">
                    <div class="job-card-title">
                      <i class={`ph ${statusIcon(job.status)}`} style="margin-right:6px;color:var(--color-muted)"></i>
                      {job.name || job.id.slice(0, 8)}
                      {!job.name && <span class="muted"> (unnamed)</span>}
                    </div>
                    <div class="job-card-meta">
                      {GENRE_LABELS[job.genreId] ?? job.genreId}
                      {job.currentStage ? ` · ${job.currentStage.replace(/_/g, " ")}` : ""}
                      {` · ${new Date(job.createdAt).toLocaleDateString()}`}
                    </div>
                  </div>
                  <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
                    <StatusBadge status={job.status} />
                    <button
                      class="btn btn-sm btn-danger"
                      onClick={(e) => handleDelete(job.id, job.name, e)}
                      title="Delete project"
                    >
                      <i class="ph ph-trash"></i>
                    </button>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
