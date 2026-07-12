import { useState, useEffect } from "preact/hooks";
import { fetchJobs, deleteJob, type JobInfo } from "../api";
import { Link } from "../lib/router";
import { StatusBadge } from "../components/DynamicForm";

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

  useEffect(() => {
    load();
  }, []);

  // Collect unique genres for filter
  const genres = [...new Set(jobs.map((j) => j.genreId))];

  // Filter by search text and genre
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

  if (loading) return <p class="muted">Loading projects…</p>;
  if (error) return <p class="error">Error: {error}</p>;

  return (
    <div>
      <div class="page-header">
        <h2>Project Library</h2>
        <Link to="/create">
          <button class="btn btn-primary">+ New Project</button>
        </Link>
      </div>

      {/* Filters */}
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
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <p class="muted">No projects found.</p>
      ) : (
        <table class="job-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Genre</th>
              <th>Status</th>
              <th>Stage</th>
              <th>Created</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtered.map((job) => (
              <tr key={job.id}>
                <td>
                  <strong>{job.name || job.id.slice(0, 8)}</strong>
                  {!job.name && <span class="muted"> (unnamed)</span>}
                </td>
                <td>{job.genreId}</td>
                <td>
                  <StatusBadge status={job.status} />
                </td>
                <td>{job.currentStage?.replace(/_/g, " ")}</td>
                <td class="muted">{new Date(job.createdAt).toLocaleDateString()}</td>
                <td class="action-cell">
                  <Link to={`/job/${job.id}`}>
                    <button class="btn btn-sm">Open</button>
                  </Link>
                  <button
                    class="btn btn-sm btn-danger"
                    onClick={(e) => handleDelete(job.id, job.name, e)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
