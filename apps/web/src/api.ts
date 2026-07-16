const API_BASE =
  typeof import.meta !== "undefined" &&
  (import.meta as unknown as Record<string, unknown>).env
    ? ((
        (import.meta as unknown as Record<string, unknown>).env as Record<
          string,
          string
        >
      ).VITE_API_BASE ?? "")
    : "";

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const hasBody = !!(
    init?.body &&
    typeof init.body === "string" &&
    init.body.length > 0
  );
  const res = await fetch(`${API_BASE}${url}`, {
    headers: {
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
    ...init,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
  }
  if (res.status === 204 || Number(res.headers.get("content-length")) === 0) {
    return undefined as unknown as Promise<T>;
  }
  return res.json() as Promise<T>;
}

// ── Types matching server responses ──────────────────────────────────

export interface GenreInfo {
  id: string;
  name: string;
  color?: string;
  subgenre_count?: string;
}

export interface JobInfo {
  id: string;
  name: string | null;
  genreId: string;
  presetId: string;
  status: string;
  currentStage: string;
  reference: string | null;
  sourceHash: string | null;
  inputs: string | null;
  nlAdjustments: string | null;
  findings: string | null;
  compiledJson: string | null;
  stageAttempt: number;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  isFavorite?: boolean;
}

export interface VersionInfo {
  id: string;
  jobId: string;
  status: string;
  number: number;
  artifacts: { type: string; value: string; versionId: string }[];
  stage: string | null;
  parentVersionId: string | null;
  finalizedAt: string | null;
  createdAt: string;
}

export interface VersionTreeNode extends VersionInfo {
  children: VersionTreeNode[];
}

// ── API functions ────────────────────────────────────────────────────

export function fetchGenres(): Promise<GenreInfo[]> {
  return api("/api/genres");
}

export interface GenrePreset {
  id: string;
  name: string;
  description: string;
  values: Record<string, unknown>;
}

export interface TagCategoryInfo {
  id: string;
  name: string;
  color: string;
  suggestions: string[];
}

export function fetchPresets(genreId: string): Promise<GenrePreset[]> {
  return api(`/api/genres/${encodeURIComponent(genreId)}/presets`);
}

export function fetchTagCategories(genreId: string): Promise<TagCategoryInfo[]> {
  return api(`/api/genres/${encodeURIComponent(genreId)}/tag-categories`);
}

export function createJob(body: {
  genreId: string;
  presetId: string;
  inputs: Record<string, unknown>;
  reference?: string;
  name?: string;
}): Promise<JobInfo> {
  return api("/api/jobs", { method: "POST", body: JSON.stringify(body) });
}

export function renameJob(id: string, name: string): Promise<JobInfo> {
  return api(`/api/jobs/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });
}

export function favoriteJob(id: string): Promise<JobInfo> {
  return api(`/api/jobs/${encodeURIComponent(id)}/favorite`, {
    method: "PATCH",
  });
}

export function deleteJob(id: string): Promise<void> {
  return api(`/api/jobs/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function updateJobInputs(
  id: string,
  patch: { inputs?: Record<string, unknown>; name?: string },
): Promise<JobInfo> {
  return api(`/api/jobs/${encodeURIComponent(id)}/inputs`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export function fetchJobs(limit = 20, offset = 0): Promise<JobInfo[]> {
  return api(`/api/jobs?limit=${limit}&offset=${offset}`);
}

export function fetchJob(id: string): Promise<JobInfo> {
  return api(`/api/jobs/${encodeURIComponent(id)}`);
}

export function startJob(
  id: string,
): Promise<{ status: string; jobId: string }> {
  return api(`/api/jobs/${encodeURIComponent(id)}/start`, { method: "POST" });
}

export function cancelJob(
  id: string,
): Promise<{ status: string; jobId: string }> {
  return api(`/api/jobs/${encodeURIComponent(id)}/cancel`, { method: "POST" });
}

export function replayJob(
  id: string,
  stage?: string,
): Promise<{ status: string; jobId: string }> {
  return api(`/api/jobs/${encodeURIComponent(id)}/replay`, {
    method: "POST",
    body: JSON.stringify(stage ? { stage } : {}),
  });
}

export function retryJob(
  id: string,
): Promise<{ status: string; jobId: string }> {
  return api(`/api/jobs/${encodeURIComponent(id)}/retry`, { method: "POST" });
}

/** Parse artifacts from JSON string to array (server returns string) */
function parseVersion(v: VersionInfo): VersionInfo {
  if (typeof v.artifacts === "string") {
    try {
      v.artifacts = JSON.parse(v.artifacts);
    } catch {
      v.artifacts = [];
    }
  }
  return v;
}

function parseVersionTree(v: VersionTreeNode): VersionTreeNode {
  parseVersion(v);
  if (v.children) v.children = v.children.map(parseVersionTree);
  return v;
}

export function fetchVersions(jobId: string): Promise<VersionInfo[]> {
  return api<VersionInfo[]>(
    `/api/jobs/${encodeURIComponent(jobId)}/versions`,
  ).then((vs) => vs.map(parseVersion));
}

export function promoteVersion(id: string): Promise<VersionInfo> {
  return api<VersionInfo>(`/api/versions/${encodeURIComponent(id)}/promote`, {
    method: "POST",
  }).then(parseVersion);
}

export function rollbackToVersion(
  jobId: string,
  versionId: string,
): Promise<VersionInfo> {
  return api<VersionInfo>(
    `/api/jobs/${encodeURIComponent(jobId)}/versions/${encodeURIComponent(versionId)}/rollback`,
    { method: "POST" },
  ).then(parseVersion);
}

export function fetchVersionTree(jobId: string): Promise<VersionTreeNode[]> {
  return api<VersionTreeNode[]>(
    `/api/jobs/${encodeURIComponent(jobId)}/versions/tree`,
  ).then((vs) => vs.map(parseVersionTree));
}

// ── Payload preview ──────────────────────────────────────────────────

// ── Review ────────────────────────────────────────────────────────────

export function submitReview(
  id: string,
  findings: unknown[],
): Promise<{ status: string; jobId: string }> {
  return api(`/api/jobs/${encodeURIComponent(id)}/review`, {
    method: "POST",
    body: JSON.stringify({ findings }),
  });
}

// ── NL Adjustments ───────────────────────────────────────────────────

export function setNlAdjustments(
  id: string,
  nlAdjustments:
    | string
    | {
        parameter: string;
        operator: string;
        value: unknown;
        confidence: number;
      }[]
    | null,
): Promise<JobInfo> {
  return api(`/api/jobs/${encodeURIComponent(id)}/nl-adjustments`, {
    method: "PATCH",
    body: JSON.stringify({ nlAdjustments }),
  });
}

// ── Artifacts ────────────────────────────────────────────────────────

export function updateArtifact(
  versionId: string,
  artifactType: string,
  value: string,
): Promise<VersionInfo> {
  return api(`/api/versions/${encodeURIComponent(versionId)}/artifacts`, {
    method: "PATCH",
    body: JSON.stringify({ artifactType, value }),
  });
}

// ── Suno status & generations ───────────────────────────────────────

export interface GenerationInfo {
  id: string;
  jobId: string;
  versionId?: string;
  status: string;
  audioUrl?: string;
  imageUrl?: string;
  videoUrl?: string;
  duration?: number;
  generatedTitle?: string;
  style?: string;
  error?: string;
  isFavorite?: boolean;
  seed?: number;
}

export function fetchTakes(versionId: string): Promise<GenerationInfo[]> {
  return api(`/api/versions/${encodeURIComponent(versionId)}/takes`);
}

export function createTake(versionId: string): Promise<GenerationInfo> {
  return api(`/api/versions/${encodeURIComponent(versionId)}/takes`, {
    method: "POST",
  });
}

export function favoriteTake(takeId: string): Promise<GenerationInfo> {
  return api(`/api/takes/${encodeURIComponent(takeId)}/favorite`, {
    method: "PATCH",
  });
}

// ── Import / Export ─────────────────────────────────────────────────

export interface ExportBundle {
  formatVersion: number;
  exportedAt: string;
  jobs: Array<{
    job: JobInfo;
    versions: VersionInfo[];
  }>;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: { index: number; message: string }[];
}

// ── SSE progress events ────────────────────────────────────────────

export interface ProgressEvent {
  jobId: string;
  stage: string;
  status: "started" | "completed" | "error";
  error?: string;
  message?: string;
  tag?: string;
  elapsedMs?: number;
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
  const es = new EventSource(
    `${API_BASE}/api/jobs/${encodeURIComponent(jobId)}/events`,
  );

  es.addEventListener("connected", () => {
    handlers.onConnected?.();
  });

  es.addEventListener("progress", (e: MessageEvent) => {
    try {
      const data = JSON.parse(e.data) as ProgressEvent;
      handlers.onProgress?.(data);
    } catch {
      console.warn("SSE: failed to parse progress event", e.data);
    }
  });

  es.addEventListener("error", (e: Event) => {
    handlers.onError?.(e);
  });

  return () => es.close();
}
