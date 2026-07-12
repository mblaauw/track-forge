import { useState, useEffect } from "preact/hooks";
import { fetchJobs, type JobInfo } from "../api";
import { Link } from "../lib/router";
import { StatusBadge } from "../components/DynamicForm";

export function JobList() {
  const [jobs, setJobs] = useState<JobInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchJobs()
      .then(setJobs)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p class="muted">Loading jobs…</p>;
  if (error) return <p class="error">Error: {error}</p>;

  return (
    <div>
      <div class="page-header">
        <h2>Jobs</h2>
        <Link to="/create">
          <button class="btn btn-primary">+ New Job</button>
        </Link>
      </div>

      {jobs.length === 0 ? (
        <p class="muted">No jobs yet. Create your first one!</p>
      ) : (
        <table class="job-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Genre</th>
              <th>Status</th>
              <th>Stage</th>
              <th>Created</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id}>
                <td class="mono">{job.id.slice(0, 8)}…</td>
                <td>{job.genreId}</td>
                <td>
                  <StatusBadge status={job.status} />
                </td>
                <td>{job.currentStage?.replace(/_/g, " ")}</td>
                <td class="muted">{new Date(job.createdAt).toLocaleDateString()}</td>
                <td>
                  <Link to={`/job/${job.id}`}>
                    <button class="btn btn-sm">View</button>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
