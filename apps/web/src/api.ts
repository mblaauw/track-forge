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
  if (res.status === 204) {
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

export function fetchPresets(genreId: string): Promise<GenrePreset[]> {
  return api(`/api/genres/${encodeURIComponent(genreId)}/presets`);
}

export interface DescriptorCategoryPoolInfo {
  cat: string;
  label: string;
  hue: string;
  chips: string[];
}

export interface DescriptorDefaultInfo {
  label: string;
  cat: string;
  weight: number;
}

export interface GenreDescriptorDefaults {
  categories: DescriptorCategoryPoolInfo[];
  defaults: DescriptorDefaultInfo[];
  lyricThemes: string[];
  lyricAngles: { id: string; label: string }[];
  sectionFunctions: string[];
  deltaPalette: string[];
  sectionPalette: string[];
  vocalPresets: {
    type: string;
    deliveryStyle: string;
    defaultEnergy: number;
  }[];
}

export function fetchDescriptorDefaults(
  genreId: string,
): Promise<GenreDescriptorDefaults> {
  return api(`/api/genres/${encodeURIComponent(genreId)}/descriptor-defaults`);
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

export interface PreviewStyleBody {
  genreId: string;
  presetIds: string[];
  descriptors: { label: string; cat: string; weight: number }[];
  bpm: number;
  key: string;
  scale: string;
  sections: { name: string; fn: string }[];
  lyricsMode: string;
  vocalType?: string | null;
}

export interface PreviewStyleResult {
  style: string;
  charCount: number;
  activeCount: number;
}

export function previewStyle(
  body: PreviewStyleBody,
): Promise<PreviewStyleResult> {
  return api("/api/preview-style", {
    method: "POST",
    body: JSON.stringify(body),
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

export function startJob(
  id: string,
): Promise<{ status: string; jobId: string }> {
  return api(`/api/jobs/${encodeURIComponent(id)}/start`, { method: "POST" });
}

/** Parse artifacts from JSON string to array (server returns string) */
function parseVersion(v: VersionInfo): VersionInfo {
  try {
    const parsed = JSON.parse(v.artifacts as unknown as string);
    return { ...v, artifacts: parsed };
  } catch {
    return v;
  }
}

export function fetchVersions(jobId: string): Promise<VersionInfo[]> {
  return api<VersionInfo[]>(
    `/api/jobs/${encodeURIComponent(jobId)}/versions`,
  ).then((vs) => vs.map(parseVersion));
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
  let closed = false;
  const es = new EventSource(
    `${API_BASE}/api/jobs/${encodeURIComponent(jobId)}/events`,
  );

  es.addEventListener("connected", () => {
    if (closed) return;
    handlers.onConnected?.();
  });

  es.addEventListener("progress", (e: MessageEvent) => {
    if (closed) return;
    try {
      const data = JSON.parse(e.data) as ProgressEvent;
      handlers.onProgress?.(data);
    } catch {
      console.warn("SSE: failed to parse progress event", e.data);
    }
  });

  es.addEventListener("error", (e: Event) => {
    if (closed) return;
    handlers.onError?.(e);
  });

  return () => {
    closed = true;
    es.close();
  };
}
