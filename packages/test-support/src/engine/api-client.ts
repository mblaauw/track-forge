/**
 * Typed API client wrapping Fastify's `server.inject()`.
 *
 * Every known endpoint has a typed method. Methods always:
 * 1. Log the request via the passed TestLogger
 * 2. Call server.inject()
 * 3. Log the response
 * 4. Parse and return the body
 *
 * The caller provides a `inject` function that wraps Fastify's inject,
 * so this works with both real servers and the TestEngine.
 */

import type { TestLogger } from "./test-logger.js";

// ── Injected dependency ──────────────────────────────────────────────────────

export type InjectFn = (opts: {
  method: string;
  url: string;
  headers?: Record<string, string>;
  payload?: unknown;
}) => Promise<{
  statusCode: number;
  payload: string;
  headers: Record<string, string>;
}>;

// ── Public types ─────────────────────────────────────────────────────────────

export interface HealthResponse {
  status: string;
  timestamp: string;
}

export interface GenreEntry {
  id: string;
  name: string;
}

export interface JobInputs {
  bpm: number;
  key?: string;
  scale?: string;
  mood?: string;
  energy?: number;
  lyricsMode?: string;
  [key: string]: unknown;
}

export interface CreateJobRequest {
  genreId: string;
  presetId: string;
  inputs: JobInputs;
  reference?: string | null;
  name?: string | null;
}

export interface ListJobsQuery {
  limit?: number;
  offset?: number;
}

export interface JobResponse {
  id: string;
  genreId: string;
  presetId: string;
  status: string;
  currentStage: string;
  inputs: string;
  name: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

export interface VersionResponse {
  id: string;
  jobId: string;
  status: string;
  number: number;
  artifacts: string;
  createdAt: string;
  [key: string]: unknown;
}

export interface GenerationResponse {
  id: string;
  jobId: string;
  versionId: string;
  status: string;
  audioUrl?: string;
  duration?: number;
  generatedTitle?: string;
  style?: string;
  lyrics?: string;
  error?: string;
  createdAt: string;
  tracks?: TrackResponse[];
  [key: string]: unknown;
}

export interface TrackResponse {
  id: string;
  index: number;
  title?: string;
  audioUrl?: string;
  duration?: number;
  [key: string]: unknown;
}

export interface StartPipelineResponse {
  status: string;
  jobId: string;
}

export interface CancelResponse {
  status: string;
  jobId: string;
}

export interface EventEntry {
  id: string;
  jobId: string;
  stage?: string;
  status: string;
  sequence: number;
  data?: string;
  error?: string;
  timestamp: string;
}

export interface CreateTakeResponse {
  id: string;
  status: string;
  [key: string]: unknown;
}

export interface PreviewStyleRequest {
  genreId: string;
  presetIds?: string[];
  bpm: number;
  sections?: { name: string; fn?: string }[];
  lyricsMode?: string;
  [key: string]: unknown;
}

export interface PreviewStyleResponse {
  style: string;
  [key: string]: unknown;
}

export interface LyricGenerateRequest {
  genreId: string;
  presetIds?: string[];
  bpm: number;
  key?: string;
  scale?: string;
  sections?: {
    id: string;
    name: string;
    bars?: number;
    fn?: string;
    deltas?: string[];
    tags?: string[];
    vocal?: {
      type: string;
      delivery: string;
      energy: number;
      adlibs: boolean;
      harmonies: boolean;
    };
  }[];
  lyricsMode?: string;
  lyricTopic?: string;
  lyricThemes?: string[];
  lyricAngle?: string;
  [key: string]: unknown;
}

export interface LyricGenerateResponse {
  lyrics: string;
  [key: string]: unknown;
}

export interface ExportBundleResponse {
  formatVersion: number;
  exportedAt: string;
  projects: unknown[];
}

export interface ImportResultResponse {
  imported: number;
  skipped: number;
  errors: { index: number; message: string }[];
}

// ── ApiClient ────────────────────────────────────────────────────────────────

export class ApiClient {
  constructor(
    private inject: InjectFn,
    private log: TestLogger,
  ) {}

  // ── Health ──────────────────────────────────────────────────────────

  async health(): Promise<{ status: number; body: HealthResponse }> {
    return this.get("/health");
  }

  // ── Genres ──────────────────────────────────────────────────────────

  async listGenres(): Promise<{ status: number; body: GenreEntry[] }> {
    return this.get("/api/genres");
  }

  async getGenrePresets(
    genreId: string,
  ): Promise<{ status: number; body: unknown[] }> {
    return this.get(`/api/genres/${genreId}/presets`);
  }

  async getGenreDescriptorDefaults(
    genreId: string,
  ): Promise<{ status: number; body: unknown[] }> {
    return this.get(`/api/genres/${genreId}/descriptor-defaults`);
  }

  // ── Jobs ────────────────────────────────────────────────────────────

  async createJob(
    req: CreateJobRequest,
  ): Promise<{ status: number; body: JobResponse }> {
    return this.post("/api/jobs", req);
  }

  async listJobs(
    query?: ListJobsQuery,
  ): Promise<{ status: number; body: JobResponse[] }> {
    const queryStr = query
      ? `?${new URLSearchParams(
          Object.fromEntries(
            Object.entries(query).map(([k, v]) => [k, String(v)]),
          ),
        ).toString()}`
      : "";
    return this.get(`/api/jobs${queryStr}`);
  }

  async getJob(id: string): Promise<{ status: number; body: JobResponse }> {
    return this.get(`/api/jobs/${id}`);
  }

  async renameJob(
    id: string,
    name: string,
  ): Promise<{ status: number; body: JobResponse }> {
    return this.patch(`/api/jobs/${id}`, { name });
  }

  async toggleJobFavorite(
    id: string,
  ): Promise<{ status: number; body: JobResponse }> {
    return this.patch(`/api/jobs/${id}/favorite`);
  }

  async updateJobInputs(
    id: string,
    inputs: Record<string, unknown>,
    name?: string,
  ): Promise<{ status: number; body: JobResponse }> {
    return this.patch(`/api/jobs/${id}/inputs`, { inputs, name });
  }

  async deleteJob(id: string): Promise<{ status: number; body: string }> {
    return this.del(`/api/jobs/${id}`);
  }

  async startPipeline(
    id: string,
  ): Promise<{ status: number; body: StartPipelineResponse }> {
    return this.post(`/api/jobs/${id}/start`);
  }

  async cancelJob(
    id: string,
  ): Promise<{ status: number; body: CancelResponse }> {
    return this.post(`/api/jobs/${id}/cancel`);
  }

  // ── Versions ────────────────────────────────────────────────────────

  async listVersions(
    jobId: string,
  ): Promise<{ status: number; body: VersionResponse[] }> {
    return this.get(`/api/jobs/${jobId}/versions`);
  }

  async getVersion(
    id: string,
  ): Promise<{ status: number; body: VersionResponse }> {
    return this.get(`/api/versions/${id}`);
  }

  async listTakes(
    versionId: string,
  ): Promise<{ status: number; body: GenerationResponse[] }> {
    return this.get(`/api/versions/${versionId}/takes`);
  }

  async createTake(
    versionId: string,
  ): Promise<{ status: number; body: CreateTakeResponse }> {
    return this.post(`/api/versions/${versionId}/takes`);
  }

  async toggleTakeFavorite(
    takeId: string,
  ): Promise<{ status: number; body: GenerationResponse }> {
    return this.patch(`/api/takes/${takeId}/favorite`);
  }

  // ── Events ──────────────────────────────────────────────────────────

  async getEventHistory(
    jobId: string,
    query?: { limit?: number; offset?: number; since?: number },
  ): Promise<{ status: number; body: EventEntry[] }> {
    const params = new URLSearchParams();
    if (query?.limit != null) params.set("limit", String(query.limit));
    if (query?.offset != null) params.set("offset", String(query.offset));
    if (query?.since != null) params.set("since", String(query.since));
    return this.get(`/api/jobs/${jobId}/events/history?${params.toString()}`);
  }

  // ── Suno ────────────────────────────────────────────────────────────

  async listGenerations(
    jobId: string,
  ): Promise<{ status: number; body: GenerationResponse[] }> {
    return this.get(`/api/suno/jobs/${jobId}/generations`);
  }

  async sendSunoCallback(
    body: Record<string, unknown>,
  ): Promise<{ status: number; body: { received: boolean } }> {
    return this.post("/api/suno/callback", body);
  }

  // ── Preview ─────────────────────────────────────────────────────────

  async previewStyle(
    req: PreviewStyleRequest,
  ): Promise<{ status: number; body: PreviewStyleResponse }> {
    return this.post("/api/preview-style", req);
  }

  async previewStyleForJob(
    jobId: string,
    req: Omit<PreviewStyleRequest, "genreId">,
  ): Promise<{ status: number; body: PreviewStyleResponse }> {
    return this.post(`/api/jobs/${jobId}/preview-style`, req);
  }

  // ── Lyrics ──────────────────────────────────────────────────────────

  async generateLyrics(
    req: LyricGenerateRequest,
  ): Promise<{ status: number; body: LyricGenerateResponse }> {
    return this.post("/api/lyrics/generate", req);
  }

  // ── Import / Export ─────────────────────────────────────────────────

  async exportJob(
    jobId: string,
  ): Promise<{ status: number; body: ExportBundleResponse }> {
    return this.get(`/api/jobs/${jobId}/export`);
  }

  async bulkExport(
    jobIds: string[],
  ): Promise<{ status: number; body: ExportBundleResponse }> {
    return this.post("/api/jobs/export", { ids: jobIds });
  }

  async importBundle(
    bundle: ExportBundleResponse,
  ): Promise<{ status: number; body: ImportResultResponse }> {
    return this.post("/api/projects/import", bundle);
  }

  // ── Internal ────────────────────────────────────────────────────────

  private async get(url: string): Promise<{ status: number; body: any }> {
    return this.request("GET", url);
  }

  private async post(
    url: string,
    payload?: unknown,
  ): Promise<{ status: number; body: any }> {
    return this.request("POST", url, payload);
  }

  private async patch(
    url: string,
    payload?: unknown,
  ): Promise<{ status: number; body: any }> {
    return this.request("PATCH", url, payload);
  }

  private async del(url: string): Promise<{ status: number; body: any }> {
    return this.request("DELETE", url);
  }

  private async request(
    method: string,
    url: string,
    body?: unknown,
  ): Promise<{ status: number; body: any }> {
    const start = performance.now();
    this.log.request(method, url, body);

    const res = await this.inject({
      method,
      url,
      headers:
        body !== undefined ? { "content-type": "application/json" } : undefined,
      payload: body !== undefined ? body : undefined,
    });

    const duration = Math.round(performance.now() - start);
    let parsed: unknown;
    try {
      parsed = res.payload ? JSON.parse(res.payload) : undefined;
    } catch {
      parsed = res.payload;
    }

    this.log.response(method, url, res.statusCode, parsed, duration);
    return { status: res.statusCode, body: parsed };
  }
}
