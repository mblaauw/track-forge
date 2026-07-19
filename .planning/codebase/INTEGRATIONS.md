# External Integrations

**Analysis Date:** 2026-07-19

## APIs & External Services

**LLM Providers (multi-provider support via `LlmClient` in `packages/core/src/llm/client.ts`):**
- **OpenAI / OpenAI-compatible** — primary provider
  - Endpoint: `POST /chat/completions` (default `https://api.openai.com/v1`)
  - Auth: Bearer token via `TRACK_FORGE_LLM_API_KEY`
  - Supports `reasoning_content` field (used by DeepSeek-style models)
  - Usage tracking: `prompt_tokens`, `completion_tokens`, `total_tokens`

- **Anthropic** — secondary provider
  - Endpoint: `POST /messages` (default `https://api.anthropic.com/v1`)
  - Auth: `x-api-key` header via `TRACK_FORGE_LLM_API_KEY`
  - Protocol: `anthropic-version: 2023-06-01`
  - Usage tracking: `input_tokens`, `output_tokens`

- **Ollama** — local provider
  - Endpoint: `POST /api/chat` (default `http://localhost:11434`)
  - No auth
  - Stream disabled (`stream: false`)

- Default model: `gpt-4o` (overridable via `TRACK_FORGE_LLM_MODEL` or `track-forge.config.js`)
- LLM used for: **lyrics writing only** (the single LLM step in the pipeline — `packages/core/src/pipeline/orchestrator.ts`)
- Timeout: 180s with combined abort signal support (`packages/core/src/llm/client.ts:128-132`)

**Suno Music Generation API — `packages/core/src/suno/client.ts`:**
- Endpoint: `/api/v1/generate` (default `https://api.sunomusic.com`)
- Auth: Bearer token via `TRACK_FORGE_SUNO_AUTH_TOKEN`
- Models: V4, V4_5, V4_5PLUS, V4_5ALL (default), V5, V5_5
- Capabilities registry in `packages/core/src/suno/capabilities.ts`
- Status polling: `GET /api/v1/generate/record-info?taskId=...`
- Poll interval: 5s (exponential backoff to 20s max)
- Poll timeout: 300s (5 minutes)
- Features: custom mode lyrics, instrumental mode, negative tags, persona, vocal gender, style weight, audio weight, callback webhooks
- Callback URL: resolves via `resolveCallbackUrl()` in `packages/core/src/suno/callbacks.ts` — derives from `publicBaseUrl` config as `${publicBaseUrl}/api/suno/callback`

**Google Fonts — frontend CDN (`apps/web/index.html`):**
- Archivo (weights 400, 500, 600, 700, 800)
- JetBrains Mono (weights 400, 500, 600)
- Preconnect hints for `fonts.googleapis.com` and `fonts.gstatic.com`

## Data Storage

**Databases:**
- SQLite via `better-sqlite3` (synchronous driver)
  - ORM: Drizzle ORM `^0.38.0`
  - Connection: local file path from `TRACK_FORGE_DB_PATH` config (default `./data/track-forge.db`)
  - WAL mode enabled, busy timeout 5000ms, foreign keys ON
  - Auto-creates tables and runs migration ALTERs on startup (`packages/core/src/db/index.ts`)
  - Tables: `projects`, `jobs`, `versions`, `generations`, `job_events`, `suno_tracks`
  - Cascade delete order: sunoTracks → generations → versions → jobEvents → jobs

**File Storage:**
- Local filesystem only
- DB file stored at configured path (`data/` directory must exist)
- JSON export/import via CLI uses local filesystem (`apps/server/src/cli.ts`)

**Caching:**
- No external caching service
- In-memory Map cache for YAML genre configs with mtime-based invalidation (`apps/server/src/lib/genre-config.ts:75`)

## Authentication & Identity

**Auth Provider:**
- None — no authentication layer on the API
- Suno API uses a static bearer token (config-only, no user identity)
- LLM APIs use static API keys (one per deployment, no user identity)
- No user accounts, no sessions, no JWT

**API Security:**
- No auth middleware on any route
- Static file serving path-traversal protection (`apps/server/src/index.ts:115-118`)

## Monitoring & Observability

**Error Tracking:**
- None — no Sentry, no external error tracker
- Unhandled rejection handler logs and continues (`apps/server/src/index.ts:151-153`)
- Uncaught exception handler logs and shuts down (`apps/server/src/index.ts:154-156`)

**Logs:**
- pino structured JSON logging
  - Server module: `fastify` logger at configured level
  - Suno client: child logger with `module: "suno-client"` tag
  - LLM client: child logger with `module: "llm"` tag
  - LLM request/response logged at debug level (truncated to 500 chars content, 2000 chars reasoning)
  - Log level configurable via `TRACK_FORGE_LOG_LEVEL` or config

## CI/CD & Deployment

**Hosting:**
- Self-hosted model (no platform detected)
- Server binds to configurable host:port (default `127.0.0.1:3000`)
- Optional production static file serving for SPA via `staticDir` config
- Graceful shutdown on SIGTERM/SIGINT

**CI Pipeline:**
- No CI detected (`.github/workflows/` directory does not exist)

**Process Management:**
- Dev: `npx tsx watch src/index.ts` (auto-restart on file changes)
- Production: `node dist/index.js` (requires `npm run build` first)

## Environment Configuration

**Required env vars:**
- None strictly required (all have defaults or can be set in config file)

**Critical env vars for Suno integration:**
- `TRACK_FORGE_SUNO_AUTH_TOKEN` — required to call Suno API

**Critical env vars for LLM integration:**
- `TRACK_FORGE_LLM_API_KEY` — required for OpenAI/Anthropic providers

**Secrets location:**
- `track-forge.config.js` (gitignored — listed in `.gitignore`)
- Environment variables (`TRACK_FORGE_*`)

## Webhooks & Callbacks

**Incoming:**
- `POST /api/suno/callback` — Suno API callback when generation completes (`apps/server/src/routes/suno.ts`)
  - URL derived from `publicBaseUrl` config: `${publicBaseUrl}/api/suno/callback`
  - Optional — when not configured, Suno client uses polling fallback

**Outgoing:**
- None — the application does not send webhooks to external systems
- Suno API is called via HTTP fetch (not webhook)

## Event Stream

**Server-Sent Events (SSE):**
- `GET /api/jobs/:id/events` — real-time pipeline progress via SSE (`apps/server/src/routes/events.ts`)
- Events: `connected`, `progress`, `error`
- Frontend connects via `EventSource` in `apps/web/src/api.ts:304`
- History replay on reconnect
- Synthetic `suno_render` events emitted on take creation for forge strip display

---

*Integration audit: 2026-07-19*
