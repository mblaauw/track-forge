import { useEffect, useState } from "preact/hooks";
import { useRouter } from "../lib/router";
import { fetchJobs, deleteJob, fetchGenres, favoriteJob, type JobInfo, type GenreInfo } from "../api";
import { useSession } from "../lib/session";

function hashString(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash) + s.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

const GENRE_COLORS: Record<string, string> = {
  edm: "cyan",
  hiphop: "amber",
  pop: "violet",
  ambient: "accent",
  dnb: "red",
};

function genreColorClass(id: string): string {
  return GENRE_COLORS[id] ?? "accent";
}

const STATUS_LABELS: Record<string, string> = {
  pending: "draft",
  in_progress: "forging",
  completed: "final",
  failed: "failed",
  cancelled: "cancelled",
};

function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

export function Library() {
  const { navigate } = useRouter();
  const { resetSession } = useSession();

  useEffect(() => { resetSession(); }, []);
  const [jobs, setJobs] = useState<JobInfo[]>([]);
  const [genres, setGenres] = useState<GenreInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [genreFilter, setGenreFilter] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchJobs(100), fetchGenres()])
      .then(([jobs, genres]) => {
        setJobs(jobs);
        setGenres(genres);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const genreMap = Object.fromEntries(genres.map((g) => [g.id, g.name]));

  const filtered = jobs.filter((job) => {
    if (genreFilter && job.genreId !== genreFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!job.name?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const allGenreIds = [...new Set(jobs.map((j) => j.genreId))];

  const toggleFavorite = async (id: string, e: Event) => {
    e.stopPropagation();
    try {
      const updated = await favoriteJob(id);
      setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, isFavorite: updated.isFavorite } : j)));
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string, e: Event) => {
    e.stopPropagation();
    if (!confirm("Delete this session?")) return;
    try {
      await deleteJob(id);
      setJobs(jobs.filter((j) => j.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const cardClick = (job: JobInfo) => {
    if (job.status === "in_progress") {
      navigate(`/forge/${job.id}`);
    } else {
      navigate(`/studio/${job.id}`);
    }
  };

  if (loading) {
    return (
      <div>
        <div class="library-header">
          <h1 class="library-title">Library</h1>
          <p class="library-subtitle">Your session archive</p>
        </div>
        <div class="card-grid">
          {Array.from({ length: 4 }, (_, i) => (
            <div class="session-card skeleton" key={i}>
              <div class="skeleton-block" style={{ height: 20, width: "40%", borderRadius: 4 }} />
              <div class="skeleton-block" style={{ height: 30, width: "100%", borderRadius: 2 }} />
              <div class="skeleton-block" style={{ height: 16, width: "60%", borderRadius: 4 }} />
              <div class="skeleton-block" style={{ height: 12, width: "40%", borderRadius: 4 }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div class="library-header">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
          <div>
            <h1 class="library-title">Library</h1>
            <p class="library-subtitle">Your session archive</p>
          </div>
          <button
            onClick={() => navigate("/create")}
            class="btn-primary gradient"
            style={{ display: "flex", alignItems: "center", gap: 9 }}
          >
            <i class="ph-plus" />
            New session
          </button>
        </div>
        <div class="library-controls">
          <input
            class="library-search"
            placeholder="Search sessions..."
            value={search}
            onInput={(e) => setSearch((e.target as HTMLInputElement).value)}
          />
          <div class="filter-chips">
            <button
              class={`filter-chip${genreFilter === null ? " active" : ""}`}
              onClick={() => setGenreFilter(null)}
            >
              All
            </button>
            {genres.map((g) => (
              <button
                key={g.id}
                class={`filter-chip${genreFilter === g.id ? " active" : ""}`}
                onClick={() => setGenreFilter(g.id)}
              >
                {g.name}
              </button>
            ))}
          </div>
          <span class="library-stats">
            {jobs.length} {jobs.length === 1 ? "bundle" : "bundles"}
          </span>
        </div>
      </div>

      <div class="card-grid">
        {filtered.map((job) => (
          <div class="session-card" onClick={() => cardClick(job)} key={job.id}>
            <div class="session-card-top">
              <span class={`session-genre-badge ${genreColorClass(job.genreId)}`}>
                {genreMap[job.genreId] ?? job.genreId}
              </span>
              <span class={`session-status-badge ${statusLabel(job.status)}`}>
                {statusLabel(job.status)}
              </span>
            </div>
            <div class="session-waveform">
              {Array.from({ length: 30 }, (_, i) => {
                const h = 3 + (hashString(job.id + String(i)) % 24);
                return <div class="bar" style={{ height: `${h}px` }} />;
              })}
            </div>
            <div class="session-card-body">
              <div class="session-name">{job.name ?? "Untitled"}</div>
              <div class="session-meta">{job.presetId} · {job.genreId}</div>
            </div>
            <div class="session-card-footer">
              <button
                class="card-delete"
                onClick={(e) => handleDelete(job.id, e)}
                title="Delete"
              >
                <i class="ph-trash" />
              </button>
              <span
                class={`session-star${job.isFavorite ? " active" : ""}`}
                onClick={(e) => toggleFavorite(job.id, e)}
              >
                <i class={job.isFavorite ? "ph-star-fill" : "ph-star"} />
              </span>
            </div>
          </div>
        ))}
        <div class="session-card card-add" onClick={() => navigate("/create")}>
          <div class="card-add-icon">
            <i class="ph-plus" />
          </div>
          <span class="card-add-label">NEW SESSION</span>
        </div>
      </div>

      {filtered.length === 0 && !loading && (
        <div style={{ textAlign: "center", padding: 60, color: "var(--text-dim)" }}>
          <p style={{ fontSize: 16, marginBottom: 8 }}>No sessions found</p>
          <p style={{ fontSize: 13 }}>
            {search
              ? "Try a different search term"
              : "Create your first session to get started"}
          </p>
        </div>
      )}
    </div>
  );
}
