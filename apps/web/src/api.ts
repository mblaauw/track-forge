const API_BASE =
  (typeof import.meta !== "undefined" && (import.meta as unknown as Record<string, unknown>).env
    ? ((import.meta as unknown as Record<string, unknown>).env as Record<string, string>).VITE_API_BASE ?? ""
    : "");

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
  }
  return res.json() as Promise<T>;
}

// ── Types matching server responses ──────────────────────────────────

export interface GenreInfo {
  id: string;
  name: string;
}

export interface JobInfo {
  id: string;
  genreId: string;
  presetId: string;
  status: string;
  currentStage: string;
  reference: string | null;
  sourceHash: string | null;
  inputs: string | null;
  stageAttempt: number;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VersionInfo {
  id: string;
  jobId: string;
  status: string;
  number: number;
  artifacts: { type: string; value: string; versionId: string }[];
  finalizedAt: string | null;
  createdAt: string;
}

// ── API functions ────────────────────────────────────────────────────

export function fetchGenres(): Promise<GenreInfo[]> {
  return api("/api/genres");
}

export function createJob(body: {
  genreId: string;
  presetId: string;
  inputs: Record<string, unknown>;
  reference?: string;
}): Promise<JobInfo> {
  return api("/api/jobs", { method: "POST", body: JSON.stringify(body) });
}

export function fetchJobs(limit = 20, offset = 0): Promise<JobInfo[]> {
  return api(`/api/jobs?limit=${limit}&offset=${offset}`);
}

export function fetchJob(id: string): Promise<JobInfo> {
  return api(`/api/jobs/${encodeURIComponent(id)}`);
}

export function startJob(id: string): Promise<{ status: string; jobId: string }> {
  return api(`/api/jobs/${encodeURIComponent(id)}/start`, { method: "POST" });
}

export function fetchVersions(jobId: string): Promise<VersionInfo[]> {
  return api(`/api/jobs/${encodeURIComponent(jobId)}/versions`);
}

export function fetchVersion(id: string): Promise<VersionInfo> {
  return api(`/api/versions/${encodeURIComponent(id)}`);
}

// ── SSE progress events ────────────────────────────────────────────

export interface ProgressEvent {
  jobId: string;
  stage: string;
  status: "started" | "completed" | "error";
  error?: string;
  timestamp: string;
}

export interface JobEventHandlers {
  onProgress?: (event: ProgressEvent) => void;
  onConnected?: () => void;
  onError?: (err: Event) => void;
}

export function connectJobEvents(
  jobId: string,
  handlers: JobEventHandlers,
): () => void {
  const es = new EventSource(`${API_BASE}/api/jobs/${encodeURIComponent(jobId)}/events`);

  es.addEventListener("connected", () => {
    handlers.onConnected?.();
  });

  es.addEventListener("progress", (e: MessageEvent) => {
    const data = JSON.parse(e.data) as ProgressEvent;
    handlers.onProgress?.(data);
  });

  es.addEventListener("error", (e: Event) => {
    handlers.onError?.(e);
  });

  return () => es.close();
}
