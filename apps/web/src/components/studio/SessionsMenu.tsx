import { useEffect, useMemo, useState } from "preact/hooks";
import {
  CaretDown,
  MagnifyingGlass,
  Plus,
  Star,
  Trash,
} from "@phosphor-icons/react";
import {
  deleteJob,
  favoriteJob,
  fetchJobs,
  fetchPresets,
  fetchTakes,
  fetchVersions,
  type JobInfo,
} from "../../api";
import { useSession } from "../../lib/session";
import { Popover, useToast } from "./ui";

function ago(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} h ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

const STATUS_WORD: Record<string, string> = {
  completed: "Forged",
  in_progress: "Forging",
  failed: "Failed",
};

/** Saved sessions, behind one button: open, start a new one, or delete. */
export function SessionsMenu() {
  const s = useSession();
  const toast = useToast();
  const [jobs, setJobs] = useState<JobInfo[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const refresh = () =>
    fetchJobs(50)
      .then((list) => {
        setJobs(list);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));

  useEffect(() => {
    refresh();
  }, [s.lastForgeTimestamp, s.jobId]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return jobs.filter((j) => !q || (j.name ?? "").toLowerCase().includes(q));
  }, [jobs, query]);

  const open = async (job: JobInfo) => {
    let inputs: Record<string, unknown> = {};
    try {
      if (job.inputs) inputs = JSON.parse(job.inputs);
    } catch {
      // unreadable inputs — open with defaults
    }
    const saved = inputs.presetIds as string[] | undefined;
    const presetIds =
      saved && saved.length > 0 ? saved : job.presetId ? [job.presetId] : [];

    let takes: unknown[] = [];
    let presetLabels = presetIds;
    try {
      // Newest first — index 0 is the latest forged version.
      const latest = (await fetchVersions(job.id))[0];
      if (latest) takes = await fetchTakes(latest.id);
    } catch {
      // takes stay empty
    }
    try {
      const names = new Map(
        (await fetchPresets(job.genreId)).map((p) => [p.id, p.name]),
      );
      presetLabels = presetIds.map((id) => names.get(id) ?? id);
    } catch {
      // fall back to ids
    }

    const sections = (inputs.sections ?? []) as never[];
    s.setSession({
      jobId: job.id,
      name: job.name ?? "",
      title: (inputs.title as string) ?? job.name ?? "",
      genreId: job.genreId,
      presetId: presetIds[0] ?? job.presetId,
      presetIds,
      presetLabels,
      bpm: (inputs.bpm as number) ?? 128,
      energy: (inputs.energy as number) ?? 5,
      complexity: (inputs.complexity as number) ?? 5,
      status: job.status === "in_progress" ? "idle" : job.status,
      forgeError: "",
      // A forge running for the session being left carries on in the
      // background; this session starts out idle.
      forgeRunning: false,
      forgeStageIdx: 0,
      forgeStageLabel: "",
      reference: job.reference ?? (inputs.reference as string) ?? "",
      excludedStyles: (inputs.excludedStyles as string) ?? "",
      lyricsMode:
        (inputs.lyricsMode as "full_lyrics" | "strict_instrumental") ??
        "strict_instrumental",
      lyricTopic: (inputs.lyricTopic as string) ?? "",
      lyricAngle:
        (inputs.lyricAngle as typeof s.lyricAngle | undefined) ??
        "first_person",
      lyricThemes: (inputs.lyricThemes as string[]) ?? [],
      lyricLines: (inputs.lyricLines as Record<string, string[]>) ?? {},
      lyricsGenerated: (inputs.lyricsGenerated as boolean) ?? false,
      tags: (inputs.tags ?? []) as never[],
      sections,
      selSectionId: (sections[0] as { id?: string } | undefined)?.id ?? null,
      arrangeSource:
        (inputs.arrangeSource as "default" | "custom" | undefined) ?? "custom",
      takes: takes as never[],
      zone: "song",
    });
  };

  const remove = async (job: JobInfo) => {
    try {
      await deleteJob(job.id);
      setJobs((list) => list.filter((j) => j.id !== job.id));
      if (s.jobId === job.id) s.resetSession();
      toast({ message: `Deleted ${job.name || "untitled session"}` });
    } catch {
      toast({ message: "Could not delete the session", tone: "error" });
    } finally {
      setConfirmId(null);
    }
  };

  const favourite = async (job: JobInfo) => {
    try {
      const updated = await favoriteJob(job.id);
      setJobs((list) =>
        list.map((j) =>
          j.id === job.id ? { ...j, isFavorite: updated.isFavorite } : j,
        ),
      );
    } catch {
      toast({ message: "Could not update the favourite", tone: "error" });
    }
  };

  return (
    <Popover
      label="Sessions"
      panelClass="sessions-pop"
      trigger={({ toggle, ref, open: _open, ...aria }) => (
        <button
          type="button"
          class="btn btn-quiet sessions-btn"
          ref={ref}
          data-testid="sessions-button"
          onClick={() => {
            setQuery("");
            setConfirmId(null);
            refresh();
            toggle();
          }}
          {...aria}
        >
          Sessions
          {jobs.length > 0 && <span class="count">{jobs.length}</span>}
          <CaretDown size={13} />
        </button>
      )}
    >
      {(close) => (
        <div data-testid="library-panel">
          <div class="sessions-top">
            <div class="search">
              <MagnifyingGlass size={15} />
              <input
                class="search-input"
                data-testid="session-search"
                placeholder="Search sessions"
                aria-label="Search sessions"
                value={query}
                onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
              />
            </div>
            <button
              type="button"
              class="btn btn-strong"
              data-testid="new-session"
              onClick={() => {
                s.resetSession();
                close();
              }}
            >
              <Plus size={15} /> New session
            </button>
          </div>

          {shown.length === 0 ? (
            <p class="option-empty">
              {!loaded
                ? "Loading sessions…"
                : jobs.length === 0
                  ? "No saved sessions yet. A session is saved the first time you forge it."
                  : "No session matches that search."}
            </p>
          ) : (
            <ul class="session-list">
              {shown.map((job) => {
                const current = job.id === s.jobId;
                return (
                  <li
                    key={job.id}
                    class={`session${current ? " current" : ""}`}
                  >
                    {confirmId === job.id ? (
                      <div
                        class="session-confirm"
                        role="alertdialog"
                        aria-label="Confirm delete"
                      >
                        <span>
                          Delete "{job.name || "Untitled"}" and its takes?
                        </span>
                        <button
                          type="button"
                          class="btn btn-danger-solid"
                          onClick={() => remove(job)}
                        >
                          Delete
                        </button>
                        <button
                          type="button"
                          class="btn btn-quiet"
                          // Focus lands on the safe choice.
                          ref={(el) => el?.focus()}
                          onClick={() => setConfirmId(null)}
                        >
                          Keep
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          class="session-open"
                          data-testid={`library-row-${job.id}`}
                          aria-current={current ? "true" : undefined}
                          onClick={() => {
                            open(job);
                            close();
                          }}
                        >
                          <span class="session-name">
                            {job.name || "Untitled"}
                          </span>
                          <span class="session-meta">
                            <span class={`genre-tag genre-${job.genreId}`}>
                              {job.genreId === "hiphop"
                                ? "Hip-hop"
                                : job.genreId === "edm"
                                  ? "EDM"
                                  : job.genreId.charAt(0).toUpperCase() +
                                    job.genreId.slice(1)}
                            </span>
                            <span>{STATUS_WORD[job.status] ?? "Draft"}</span>
                            <span>{ago(job.updatedAt)}</span>
                          </span>
                        </button>
                        <button
                          type="button"
                          class={`icon-btn${job.isFavorite ? " starred" : ""}`}
                          aria-pressed={!!job.isFavorite}
                          aria-label={
                            job.isFavorite
                              ? `Remove ${job.name || "session"} from favourites`
                              : `Favourite ${job.name || "session"}`
                          }
                          onClick={() => favourite(job)}
                        >
                          <Star
                            size={16}
                            weight={job.isFavorite ? "fill" : "regular"}
                          />
                        </button>
                        <button
                          type="button"
                          class="icon-btn"
                          aria-label={`Delete ${job.name || "session"}`}
                          onClick={() => setConfirmId(job.id)}
                        >
                          <Trash size={16} />
                        </button>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </Popover>
  );
}
