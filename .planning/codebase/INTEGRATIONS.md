# External Integrations

**Analysis Date:** 2026-07-15

## APIs & External Services

### LLM Providers

The codebase supports four LLM providers through a unified client at `packages/core/src/llm/client.ts`. All use raw `fetch()` — no SDK dependencies.

| Provider | Config Value | Default Base URL | Auth Mechanism |
|----------|-------------|------------------|----------------|
| OpenAI | `openai` | `https://api.openai.com/v1` | Bearer token (`Authorization: Bearer`) |
| OpenAI-compatible | `openai-compatible` | (configurable) | Bearer token (`Authorization: Bearer`) |
| Anthropic | `anthropic` | `https://api.anthropic.com/v1` | `x-api-key` header |
| Ollama | `ollama` | `http://localhost:11434` | None |

**LLM Client Details (`packages/core/src/llm/client.ts`):**
- Endpoint: OpenAI-compatible calls `/chat/completions`, Anthropic calls `/messages`, Ollama calls `/api/chat`
- Timeout: 180s on OpenAI/OpenAI-compatible requests via `AbortController`; no timeout on Anthropic/Ollama
- Token tracking: Reports `usage` (prompt/completion/total tokens) for OpenAI and Anthropic; not available for Ollama
- Reasoning extraction: Reads `reasoning_content` from OpenAI responses (used for DeepSeek v4 flash compatibility)
- Per-stage max_tokens tuning documented for pipeline: planning 2048, style 4096, lyrics 2048
- Provider defaults defined in `packages/core/src/llm/types.ts`

### Suno Music API (via sunoapi.org)

Suno client at `packages/core/src/suno/client.ts` communicates with a third-party Suno API proxy (`sunoapi.org` by default).

| Aspect | Details |
|--------|---------|
| SDK/Client | Custom `SunoClient` class — raw `fetch()` only |
| Base URL | Configurable via `TRACK_FORGE_SUNO_BASE_URL` or `sunoBaseUrl` config |
| Auth | Bearer token via `TRACK_FORGE_SUNO_AUTH_TOKEN` |
| Default model | `V4_5ALL` |

**Endpoints Used:**
- `POST /api/v1/generate` — Submit generation task (`packages/core/src/suno/client.ts:48`)
- `GET /api/v1/generate/record-info?taskId=` — Poll generation status (`packages/core/src/suno/client.ts:119`)
- Callback: `POST /api/suno/callback` (server-side webhook at `apps/server/src/routes/suno.ts`)

**Capabilities (`packages/core/src/suno/capabilities.ts`):**
- Model registry: `V4`, `V4_5`, `V4_5PLUS`, `V4_5ALL`, `V5`, `V5_5`
- Tracks per-model max lengths, negative tag support, callback support, batch size
- Default polling: 5s interval, exponential backoff to 20s, 5min timeout

**Payload Generation (`packages/core/src/suno/payload.ts`):**
- Transforms compiled pipeline artifacts into `SunoGenerateRequest`
- Applies genre transforms (BPM, mood, energy)
- Auto-detects instrumental mode (empty lyrics)
- Validates/truncates against model capabilities
- Returns warnings for out-of-range values

**Callback Flow:**
- `resolveCallbackUrl()` in `packages/core/src/suno/callbacks.ts` derives URL from `publicBaseUrl`
- Server webhook at `POST /api/suno/callback` (`apps/server/src/routes/suno.ts`)
- Checks generation ID for a matching pending generation in DB

## Data Storage

**Databases:**
- **SQLite** via better-sqlite3 ^12.0.0
- Connection: `TRACK_FORGE_DB_PATH` or `dbPath` config (default `./data/track-forge.db`)
- Drizzle ORM ^0.38.0 for type-safe queries
- WAL mode enabled, `busy_timeout` 5000ms, `foreign_keys = ON`

**Tables (11 total, auto-created in `packages/core/src/db/index.ts`):**
| Table | Purpose |
|-------|---------|
| `projects` | Music project metadata |
| `project_drafts` | Project drafts (pre-creation) |
| `jobs` | Pipeline orchestration jobs |
| `versions` | Job version snapshots with artifacts JSON |
| `generations` | Suno generation records |
| `suno_tracks` | Individual tracks within a generation |
| `job_events` | Pipeline event log (SSE history) |
| `job_stage_outputs` | Per-stage pipeline outputs |
| `critic_findings` | Critic analysis records |
| `adjustments` | User NL adjustments |
| `artifact_locks` | Concurrent edit locks with TTL |

**No file storage service** — audio/images referenced by URL from Suno API responses only.

**Caching:**
- **Reference Cache** (`packages/core/src/pipeline/reference-cache.ts`): In-memory Map keyed by `sourceHash` for reference analysis
- **Genre Config Cache** (`apps/server/src/lib/genre-config.ts`): In-memory `Map<string, GenreConfigYaml>` for parsed YAML
- **No Redis or external cache**

## Authentication & Identity

**No auth provider.** The application has no user authentication, no multi-tenancy, no API key auth on endpoints.

- Suno API calls are authenticated (Bearer token) — this is the only auth in the system
- LLM API calls are authenticated (Bearer or x-api-key) — provider-specific
- All endpoints are public (designed for local/single-user deployment)

## Monitoring & Observability

**Logging:**
- **Pino ^9.6.0** — Structured JSON logging throughout server and core
- Log level configurable via `TRACK_FORGE_LOG_LEVEL` (trace/debug/info/warn/error/fatal)
- Module-scoped child loggers: `suno`, `llm`, `suno-client`
- Fastify uses `pino` internally via `{ logger: { level: config.logLevel } }`

**Error Tracking:** None (no Sentry, no external error reporting)

**Health Endpoint:**
- `GET /health` at `apps/server/src/routes/health.ts` — returns `{ status: "ok" }`

## CI/CD & Deployment

**Hosting:** Not specified. The application is designed for self-hosting on bare metal or VPS.

**CI Pipeline:** GitHub Actions (`.github/workflows/ci.yml`)
- Trigger: pushes to `main` and pull requests
- Two jobs:
  - `check`: `tsc --build` + `vitest run` + `prettier --check`
  - `lint`: `tsc --noEmit` (separate job for type-checking only)

**No Docker, no deployment pipeline, no container registry.**

## Environment Configuration

**Required env vars (no defaults — must configure for Suno/LLM integration):**
- `TRACK_FORGE_SUNO_BASE_URL` — Suno API proxy base URL
- `TRACK_FORGE_SUNO_AUTH_TOKEN` — Suno API bearer token

**Optional env vars (with defaults):**
| Variable | Default | Purpose |
|----------|---------|---------|
| `TRACK_FORGE_PUBLIC_BASE_URL` | (none) | Public server URL for Suno callbacks |
| `TRACK_FORGE_DB_PATH` | `./data/track-forge.db` | SQLite database file path |
| `TRACK_FORGE_LOG_LEVEL` | `info` | Pino log level |
| `TRACK_FORGE_PORT` | `3000` | HTTP server port |
| `TRACK_FORGE_HOST` | `127.0.0.1` | HTTP server bind address |
| `TRACK_FORGE_STATIC_DIR` | (none) | Path to built web GUI |
| `TRACK_FORGE_LLM_PROVIDER` | `openai` | LLM provider (`openai`, `openai-compatible`, `anthropic`, `ollama`) |
| `TRACK_FORGE_LLM_API_KEY` | (none) | LLM API key |
| `TRACK_FORGE_LLM_BASE_URL` | (provider default) | LLM API base URL |
| `TRACK_FORGE_LLM_MODEL` | `gpt-4o` | LLM model name |

**Secrets location:**
- `track-forge.config.js` (gitignored via `*.js` in `.gitignore`)
- Environment variables at runtime

## Webhooks & Callbacks

**Incoming:**
- `POST /api/suno/callback` — Suno generation completion callback (`apps/server/src/routes/suno.ts`)
  - Updates generation status in DB
  - Validates generation ID against pending records
  - Avoids duplicate processing

**Outgoing:**
- Suno API callbacks — automatically configured with `callBackUrl` parameter on generation submit
  - URL derived from `publicBaseUrl` + `/api/suno/callback`
  - Configurable via `TRACK_FORGE_PUBLIC_BASE_URL`

## SSE (Server-Sent Events)

**Internal real-time streaming** (not external, but significant):
- `GET /api/jobs/:id/events` — SSE stream for pipeline progress (`apps/server/src/routes/events.ts`)
  - `last-event-id` support for reconnection history replay
  - 15s keepalive pings
  - Cleanup on client disconnect
- `GET /api/jobs/:id/events/history` — Paginated event log query
- Frontend consumes via `connectJobEvents()` at `apps/web/src/api.ts`

## Import/Export

**JSON bundle export/import** (`apps/server/src/routes/import-export.ts`):
- `GET /api/projects/:id/export` — Export project + jobs + versions as `ExportBundle`
- `GET /api/jobs/:id/export` — Export single job as bundle
- `POST /api/projects/import` — Import bundle with genre validation and duplicate detection
- `POST /api/jobs/export` — Legacy bulk export by job IDs

No external storage — exports are generated on-the-fly as JSON responses.

---

*Integration audit: 2026-07-15*
