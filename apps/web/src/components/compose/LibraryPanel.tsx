import { useState, useEffect, useMemo } from "preact/hooks";
import {
  CaretLeft,
  CaretRight,
  Stack,
  MagnifyingGlass,
  Plus,
  Star,
  Trash,
} from "@phosphor-icons/react";
import { useSession } from "../../lib/session";
import { fetchJobs, favoriteJob, deleteJob, type JobInfo } from "../../api";

function wave(seed: string, n: number): number[] {
  let h = seed.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const bars: number[] = [];
  for (let i = 0; i < n; i++) {
    h = (h * 1103515245 + 12345) & 0x7fffffff;
    bars.push(3 + (h % 26));
  }
  return bars;
}

const GENRE_HUE_MAP: Record<string, string> = {
  edm: "var(--hue-cyan)",
  hiphop: "var(--hue-amber)",
  ambient: "var(--hue-violet)",
};

function formatUpdated(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString();
}

export function LibraryPanel() {
  const s = useSession();
  const { libraryCollapsed, togglePanel } = s;
  const [jobs, setJobs] = useState<JobInfo[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const loadJobs = () => {
    setLoading(true);
    fetchJobs(50)
      .then(setJobs)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadJobs();
  }, []);

  const filtered = useMemo(
    () =>
      jobs.filter(
        (j) =>
          !search ||
          (j.name || "").toLowerCase().includes(search.toLowerCase()),
      ),
    [jobs, search],
  );

  const loadSession = async (job: JobInfo) => {
    let inputs: Record<string, unknown> = {};
    try {
      if (job.inputs) inputs = JSON.parse(job.inputs);
    } catch {
      // ignore parse errors
    }

    s.setSession({
      jobId: job.id,
      name: job.name ?? "",
      genreId: job.genreId,
      presetId: job.presetId,
      presetIds:
        (inputs.presetIds as string[]) ?? (job.presetId ? [job.presetId] : []),
      presetLabels: [],
      bpm: (inputs.bpm as number) ?? 128,
      key: (inputs.key as string) ?? "C",
      scale: (inputs.scale as "major" | "minor") ?? "minor",
      status: job.status,
      reference: job.reference ?? "",
      lyricsMode:
        (inputs.lyricsMode as
          "full_lyrics" | "strict_instrumental" | "guided_instrumental") ??
        "strict_instrumental",
      lyricTopic: (inputs.lyricTopic as string) ?? "",
      lyricAngle:
        (inputs.lyricAngle as
          "first_person" | "story" | "abstract" | "anthemic") ?? "first_person",
      lyricThemes: (inputs.lyricThemes as string[]) ?? [],
      lyricLines: {},
      lyricsGenerated: false,
      tags: (inputs.tags ?? []) as any[],
      sections: (inputs.sections ?? []) as any[],
      selSectionId: null,
      arrangeSource:
        (inputs.arrangeSource as "default" | "custom") ?? "default",
      title: (inputs.title as string) ?? "",
      takes: [],
    });
  };

  const handleDelete = async (id: string, e: Event) => {
    e.stopPropagation();
    try {
      await deleteJob(id);
      setJobs((prev) => prev.filter((j) => j.id !== id));
    } catch {
      // ignore
    }
  };

  const handleFavorite = async (id: string, e: Event) => {
    e.stopPropagation();
    try {
      const updated = await favoriteJob(id);
      setJobs((prev) =>
        prev.map((j) =>
          j.id === id ? { ...j, isFavorite: updated.isFavorite } : j,
        ),
      );
    } catch {
      // ignore
    }
  };

  if (libraryCollapsed) {
    return (
      <div
        class="col-rail collapsed"
        onClick={() => togglePanel("library")}
        title="Expand library"
      >
        <CaretLeft size={16} />
        <span class="rail-vertical-label">LIBRARY</span>
      </div>
    );
  }

  return (
    <div class="library-panel">
      <div class="col-header">
        <button
          class="col-collapse-btn"
          onClick={() => togglePanel("library")}
          title="Collapse library"
        >
          <CaretRight size={16} />
        </button>
        <span class="col-pill">
          <Stack size={14} />
          Library · {jobs.length}
        </span>
      </div>
      <div class="col-body tf-scroll">
        <div class="library-search-wrap">
          <MagnifyingGlass size={14} class="library-search-icon" />
          <input
            class="library-search"
            placeholder="Search sessions…"
            value={search}
            onInput={(e) => setSearch((e.target as HTMLInputElement).value)}
          />
        </div>
        <div class="library-subheader">
          <span class="library-subheader-label">SESSION ARCHIVE</span>
          <button class="library-new-btn" onClick={() => s.resetSession()}>
            <Plus size={14} /> New
          </button>
        </div>

        {filtered.length === 0 && !loading && (
          <p class="library-empty">No sessions yet.</p>
        )}

        <div
          class="library-list"
          style="display:flex;flex-direction:column;gap:8px"
        >
          {filtered.map((job) => {
            const bars = wave(job.id, 16);
            const genreHue = GENRE_HUE_MAP[job.genreId] ?? "var(--hue-slate)";
            const statusColor =
              job.status === "completed"
                ? "var(--success-text)"
                : job.status === "in_progress"
                  ? "var(--hue-amber)"
                  : "var(--faint)";
            const statusLabel =
              job.status === "completed"
                ? "FINAL"
                : job.status === "in_progress"
                  ? "FORGING"
                  : "DRAFT";

            return (
              <button
                class="library-row"
                key={job.id}
                onClick={() => loadSession(job)}
              >
                <div class="library-row-top">
                  <span class="library-row-name">
                    {job.name || "Untitled Session"}
                  </span>
                  <span class="library-row-time">
                    {formatUpdated(job.updatedAt)}
                  </span>
                </div>
                <div class="library-row-actions">
                  <button
                    class="library-star-btn"
                    onClick={(e) => handleFavorite(job.id, e)}
                  >
                    <Star
                      size={14}
                      weight={job.isFavorite ? "fill" : "regular"}
                      style={{
                        color: job.isFavorite
                          ? "var(--hue-amber)"
                          : "var(--faint)",
                      }}
                    />
                  </button>
                  <button
                    class="library-delete-btn"
                    onClick={(e) => handleDelete(job.id, e)}
                  >
                    <Trash size={14} />
                  </button>
                </div>
                <div class="library-waveform" style={{ opacity: 0.55 }}>
                  {bars.map((h, i) => (
                    <div
                      key={i}
                      class="library-wave-bar"
                      style={{
                        height: `${h * 0.9}px`,
                        background: genreHue,
                      }}
                    />
                  ))}
                </div>
                <div class="library-row-footer">
                  <span
                    class="library-genre-dot"
                    style={{ background: genreHue }}
                  />
                  <span class="library-genre-name">
                    {job.genreId.toUpperCase()}
                  </span>
                  <span
                    class="library-status-pill"
                    style={{
                      background:
                        job.status === "completed"
                          ? "var(--success-fill)"
                          : job.status === "in_progress"
                            ? "var(--amber-dim)"
                            : "var(--inset)",
                      color: statusColor,
                    }}
                  >
                    {statusLabel}
                  </span>
                  <span class="library-tempo">
                    {/* bpm not in JobInfo top-level — extracted from inputs */}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
