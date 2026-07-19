<!-- refreshed: 2026-07-19 -->
# Architecture

**Analysis Date:** 2026-07-19

## System Overview

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                         WEB (Preact SPA)                                │
│  apps/web/src/                                                          │
│  ┌───────────┐ ┌──────────┐ ┌───────────┐ ┌──────────────┐             │
│  │SessionCtx │ │Router    │ │ComposeShell│ │  API client  │             │
│  │(session   │ │(hash-    │ │(orchestr.)│ │  (api.ts)   │             │
│  │ .tsx)     │ │ router)  │ │           │ │              │             │
│  └───────────┘ └──────────┘ └───────────┘ └──────┬───────┘             │
│                                                   │ HTTP/SSE             │
└───────────────────────────────────────────────────┼─────────────────────┘
                                                    │
┌───────────────────────────────────────────────────┼─────────────────────┐
│                      SERVER (Fastify)              │                     │
│  apps/server/src/                                  │                     │
│  ┌──────────────────────────────────────────────┐ │                     │
│  │  Routes (routes/*.ts)                        │ │                     │
│  │  jobs │ versions │ suno │ events │ health    │ │                     │
│  │  import-export │ preview-style │ lyrics      │ │                     │
│  └──────────┬────────────────────────┬───────────┘ │                     │
│             │                        │               │                     │
│  ┌──────────▼────────┐   ┌──────────▼───────────┐  │                     │
│  │ Server Lib         │   │ Server Lib             │  │                     │
│  │  genre-config.ts   │   │  modules.ts           │  │                     │
│  │  (YAML loader)     │   │  (module registry)    │  │                     │
│  │  db.ts / db-utils  │   │  validate.ts (Zod)    │  │                     │
│  │  config.ts         │   │                        │  │                     │
│  └────────────────────┘   └────────────────────────┘  │                     │
└───────────────────────────────────────────────────────┼─────────────────────┘
                                                        │
┌───────────────────────────────────────────────────────┼─────────────────────┐
│                     CORE PACKAGES                      │                     │
│  packages/                                             │                     │
│                                                        │                     │
│  ┌──────────────────────────────────────────────────┐  │                     │
│  │  @track-forge/core  (packages/core/src/)          │  │                     │
│  │  ┌─────────────┐ ┌────────────┐ ┌──────────────┐ │  │                     │
│  │  │ pipeline/    │ │ llm/       │ │ suno/        │ │  │                     │
│  │  │  orchestrator│ │  client.ts │ │  client.ts   │ │  │                     │
│  │  │  job-service │ │  types.ts  │ │  payload.ts  │ │  │                     │
│  │  │  style-comp. │ └────────────┘ │  callbacks   │ │  │                     │
│  │  │  suno-context│                │  generation-  │ │  │                     │
│  │  │  events.ts   │                │   store.ts    │ │  │                     │
│  │  │  job-abort-  │                │  capabilities │ │  │                     │
│  │  │   controller │                └──────────────┘ │  │                     │
│  │  └─────────────┘                                   │  │                     │
│  │  db/ (schema.ts, index.ts)                         │  │                     │
│  │  config.ts  json-utils.ts                          │  │                     │
│  └──────────────────────────────────────────────────┘  │                     │
│                                                        │                     │
│  ┌──────────────────┐ ┌──────────────────────────────┐ │                     │
│  │ @track-forge/    │ │ @track-forge/genre-*         │ │                     │
│  │ contracts        │ │  (edm, hiphop, ambient)      │ │                     │
│  │  Zod schemas     │ │  extends genre-core           │ │                     │
│  │  + branded types │ │  via createGenreModule()     │ │                     │
│  └──────────────────┘ └──────────────────────────────┘ │                     │
│                                                        │                     │
│  ┌──────────────────┐ ┌──────────────────────────────┐ │                     │
│  │ @track-forge/    │ │ @track-forge/genre-core      │ │                     │
│  │ test-support     │ │  GenreModule interface        │ │                     │
│  │  mocks: llm,     │ │  createGenreModule() factory  │ │                     │
│  │  suno, genre     │ │  shared types + base schema   │ │                     │
│  └──────────────────┘ └──────────────────────────────┘ │                     │
└───────────────────────────────────────────────────────┼─────────────────────┘
                                                         │
                                                         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    DATA LAYER / EXTERNAL                                 │
│                                                                         │
│  SQLite DB (better-sqlite3 + Drizzle ORM)                               │
│  ./data/track-forge.db — WAL mode, auto-created tables                  │
│                                                                         │
│  External APIs:                                                         │
│    • Suno API (music generation) — REST client                          │
│    • LLM API (OpenAI / Anthropic / Ollama) — unified client             │
│                                                                         │
│  Genre Config: config/genres/*.yaml — static YAML data                  │
└─────────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Server entry | Bootstrap Fastify, init dependencies, register routes | `apps/server/src/index.ts` |
| Server CLI | CLI commands (export, export-all, import) | `apps/server/src/cli.ts` |
| Route: jobs | CRUD + pipeline dispatch + favorites + start | `apps/server/src/routes/jobs.ts` |
| Route: versions | Version listing, takes (generations) CRUD | `apps/server/src/routes/versions.ts` |
| Route: suno | Suno callback endpoint | `apps/server/src/routes/suno.ts` |
| Route: events | SSE streaming + event history | `apps/server/src/routes/events.ts` |
| Route: preview-style | Deterministic style prompt compilation | `apps/server/src/routes/preview-style.ts` |
| Route: lyrics | LLM-based lyrics generation | `apps/server/src/routes/lyrics.ts` |
| Route: import-export | Bulk job export/import | `apps/server/src/routes/import-export.ts` |
| Route: health | Health check | `apps/server/src/routes/health.ts` |
| Pipeline orchestrator | 3-stage pipeline (compilation → lyrics → versioning) | `packages/core/src/pipeline/orchestrator.ts` |
| Job service | Job/version CRUD + stage transitions | `packages/core/src/pipeline/job-service.ts` |
| Style compiler | Deterministic style prompt from descriptors | `packages/core/src/pipeline/style-compiler.ts` |
| Suno context builder | Serializes full arrangement context for LLM | `packages/core/src/pipeline/suno-context.ts` |
| Pipeline events | Publish/subscribe + DB persistence + SSE format | `packages/core/src/pipeline/events.ts` |
| Job abort controller | In-memory AbortController map per job | `packages/core/src/pipeline/job-abort-controller.ts` |
| LLM client | Unified HTTP client (OpenAI/Anthropic/Ollama) | `packages/core/src/llm/client.ts` |
| Suno client | Suno API integration | `packages/core/src/suno/client.ts` |
| Suno payload | Payload builder for Suno generation requests | `packages/core/src/suno/payload.ts` |
| DB layer | SQLite init, Drizzle setup, schema, migration | `packages/core/src/db/index.ts` |
| Config | Load config from JS file + env overrides | `packages/core/src/config.ts` |
| Genre config | YAML loader with mtime cache | `apps/server/src/lib/genre-config.ts` |
| Module registry | Augment genre modules with YAML data at runtime | `apps/server/src/lib/modules.ts` |
| Validation | Zod schemas for request body/query/params | `apps/server/src/lib/validate.ts` |
| Contracts | Shared Zod schemas, branded IDs, interfaces | `packages/contracts/src/index.ts` |
| Genre core | GenreModule interface, createGenreModule(), base schemas | `packages/genre-core/src/index.ts` |
| Genre EDM | EDM input schema + defaults | `packages/genre-edm/src/index.ts` |
| Genre hiphop | HipHop input schema + defaults | `packages/genre-hiphop/src/index.ts` |
| Genre ambient | Ambient input schema + defaults | `packages/genre-ambient/src/index.ts` |
| Web entry | Preact render bootstrap | `apps/web/src/main.tsx` |
| Web App | Router + SessionProvider + ComposeShell composition | `apps/web/src/app.tsx` |
| Session context | Central state management for Compose workspace | `apps/web/src/lib/session.tsx` |
| Hash router | Simple hash-based client-side routing | `apps/web/src/lib/router.tsx` |
| API client | HTTP fetch wrapper + typed API functions | `apps/web/src/api.ts` |
| ComposeShell | Main orchestration component (forge, autosave, layout) | `apps/web/src/components/compose/ComposeShell.tsx` |
| SetupColumn | 6 collapsible setup cards | `apps/web/src/components/compose/SetupColumn.tsx` |
| BundleCanvas | Central canvas (title, style console, arrangement) | `apps/web/src/components/compose/BundleCanvas.tsx` |
| ArrangementEditor | Section-delta arrangement editor | `apps/web/src/components/compose/ArrangementEditor.tsx` |
| LyricsBlock | Lyrics editing block | `apps/web/src/components/compose/LyricsBlock.tsx` |
| RendersPanel | Take cards with waveforms | `apps/web/src/components/compose/RendersPanel.tsx` |

## Pattern Overview

**Overall:** Package-based monorepo with dependency inversion. Server and web are thin application shells that delegate to shared packages. Packages follow a layered dependency chain: contracts → core, genre-core → genre-* → server.

**Key Characteristics:**
- **Zod-first types**: All interfaces are defined as Zod schemas in `@track-forge/contracts` and inferred to TypeScript types. Single source of truth for validation and types.
- **Pure-function stage handlers**: Pipeline stages (`handleCompilation`, `handleLyricsWriting`, `handleVersioning`) are focused pure(ish) functions that take state + deps and return new state.
- **Dependency injection**: `PipelineDeps` interface (db, llm, suno, config, signal) is injected into pipeline stages. Routes receive deps via closures in register functions.
- **Event-driven pipeline**: Stages publish events (started/completed/error) via pub/sub. Events persist to DB and stream via SSE to the frontend.
- **Genre module pattern**: Each genre implements `GenreModule` from `@track-forge/genre-core` with a Zod input schema + defaults. Runtime YAML data augments modules at server startup.

## Layers

**Transport Layer:**
- Purpose: HTTP API surface, static file serving, SSE streaming
- Location: `apps/server/src/routes/*.ts`
- Contains: Fastify route handlers, request validation, response formatting
- Depends on: `@track-forge/core`, server lib layers
- Used by: `apps/web` (HTTP client), external API callers

**Server Layer:**
- Purpose: Config initiation, DB connection, module registry, genre YAML loading, validation helpers
- Location: `apps/server/src/lib/*.ts`
- Contains: `config.ts`, `db.ts`, `db-utils.ts`, `genre-config.ts`, `modules.ts`, `validate.ts`
- Depends on: `@track-forge/core`, `@track-forge/genre-*`

**Core Engine Layer:**
- Purpose: Pipeline orchestration, LLM integration, Suno API client, DB schema/access
- Location: `packages/core/src/**`
- Contains: `pipeline/`, `llm/`, `suno/`, `db/`, `config.ts`, `json-utils.ts`
- Depends on: `@track-forge/contracts`, `@track-forge/genre-core`

**Contracts Layer:**
- Purpose: Shared types, Zod schemas, branded IDs
- Location: `packages/contracts/src/index.ts`
- Contains: Type definitions, Zod schemas, brand types
- Depends on: `zod` only
- Used by: All packages

**Genre Module Layer:**
- Purpose: Genre-specific input validation and defaults
- Location: `packages/genre-*/src/`
- Contains: Genre interface, `createGenreModule()`, base schema factories
- Depends on: `@track-forge/genre-core`

**Frontend Layer:**
- Purpose: Single-screen Compose SPA
- Location: `apps/web/src/**`
- Contains: Preact components, session context, API client, hash router, CSS
- Depends on: Fastify server API (HTTP)

## Data Flow

### Primary Request Path — Pipeline Execution

1. User clicks "Forge" in `ComposeShell.tsx` → `handleForge()` fires
2. If no job exists, `POST /api/jobs` creates job via `createJob()` in `job-service.ts` — stores inputs as JSON string in `jobs.inputs`
3. `POST /api/jobs/:id/start` triggers `runPipeline()` in `packages/core/src/pipeline/orchestrator.ts`
4. Pipeline subscribes to SSE events: `connectJobEvents()` in `apps/web/src/api.ts`
5. **Stage 1 — Compilation** (`handleCompilation`):
   - Parses inputs via `parsePipelineInputs()`
   - Calls `compileStylePrompt()` (deterministic, no LLM)
   - Produces `compiledJson` with title, style, excludedStyles
   - No LLM call
6. **Stage 2 — Lyrics Writing** (`handleLyricsWriting`):
   - If `lyricsMode === "strict_instrumental"` → skip (empty result)
   - Calls `buildSunoContext()` to assemble full context string
   - Sends to LLM via `deps.llm.complete()`
   - Parses JSON response into `LyricsWriterResult`
7. **Stage 3 — Versioning** (`handleVersioning`):
   - Builds `SunoArtifact[]` (title, style, lyrics, excludedStyles)
   - Calls `createVersion()` in `job-service.ts` — inserts version row, auto-numbers
   - Calls `completeJob()`
8. Each stage publishes events (`started`/`completed`/`error`) to DB + in-memory subscribers
9. Versioning completion auto-triggers `POST /api/versions/:id/takes` (Suno render)
10. SSE delivers `suno_render` synthetic events driven by the takes endpoint

### Preview Style Flow

1. `POST /api/preview-style` (unsaved) or `POST /api/jobs/:id/preview-style` (saved)
2. Route calls `compileStylePrompt()` from `packages/core/src/pipeline/style-compiler.ts`
3. Returns `{ style, charCount, activeCount }` — no DB write or LLM call

### SSE Event Flow

1. `GET /api/jobs/:id/events` opens SSE connection with history replay
2. Server sends `connected` event, then replays events after `last-event-id`
3. Subscribes via `subscribe()` in `events.ts` for live events
4. 15s keep-alive ping
5. `ComposeShell.tsx` drives forge strip progress bar from SSE events

**State Management:**
- **Server-side**: Job state persisted in SQLite (`jobs.status`, `jobs.currentStage`, `jobs.stageData`). Pipeline state built incrementally in `PipelineState` object across stages.
- **Client-side**: Centralized `SessionState` in React context (`SessionProvider`). Autosave debounced at 800ms to `PATCH /api/jobs/:id/inputs`.
- **Events**: In-memory pub/sub (`Map<jobId, Set<callback>>`) + SQLite persistence.

## Key Abstractions

**GenreModule:**
- Purpose: Contract for genre implementations — defines input validation schema and defaults
- Files: `packages/genre-core/src/index.ts`, `packages/genre-edm/src/index.ts`, `packages/genre-hiphop/src/index.ts`, `packages/genre-ambient/src/index.ts`
- Pattern: Interface + factory (`createGenreModule()`), augmented at runtime with YAML data in `modules.ts`

**PipelineDeps:**
- Purpose: Injectable dependencies for pipeline execution
- File: `packages/core/src/pipeline/types.ts`
- Contains: `Db`, `LlmClient`, `SunoClient`, `Config`, `AbortSignal`
- Pattern: Dependency injection interface

**PipelineState:**
- Purpose: Mutable state accumulated across pipeline stages
- File: `packages/core/src/pipeline/types.ts`
- Contains: `Job`, `GenreModule`, `compiledJson`, `lyricsWriterResult`, `versionId`

**Config:**
- Purpose: Central configuration from JS file + env overrides
- File: `packages/core/src/config.ts`
- Pattern: Zod-validated, `loadConfig()` singleton

**StageData:**
- Purpose: Persisted pipeline stage state (JSON in `jobs.stageData`)
- File: `packages/core/src/pipeline/job-service.ts`
- Contains: `compiledJson`, `lyricsWriterResult`, `lyricsFormat`

**Branded IDs:**
- Purpose: Type-safety for entity IDs (`JobId`, `VersionId`, `GenreId`, `PresetId`, `SourceHash`)
- File: `packages/contracts/src/index.ts`
- Pattern: `string & { readonly __brand: "JobId" }` — nominal typing via intersection

## Entry Points

**Server:**
- Location: `apps/server/src/index.ts`
- Triggers: `node apps/server/dist/index.js`
- Responsibilities: Bootstrap Fastify, init config/DB/LLM/Suno, register routes, static serving, graceful shutdown

**Client CLI:**
- Location: `apps/server/src/cli.ts`
- Triggers: `track-forge export|export-all|import`
- Responsibilities: Data export/import for jobs and versions

**Web Application:**
- Location: `apps/web/src/main.tsx`
- Triggers: Vite dev server, built `dist/` served by Fastify
- Responsibilities: Mount Preact App component

**Pipeline:**
- Location: `packages/core/src/pipeline/orchestrator.ts` — `runPipeline()`
- Triggers: Called by `POST /api/jobs/:id/start` route handler
- Responsibilities: Execute 3-stage pipeline with event publishing and error handling

## Architectural Constraints

- **Threading:** Single-threaded Node.js event loop. All I/O is async. SQLite writes are synchronous via better-sqlite3 (blocking calls) but wrapped in async functions.
- **Global state:**
  - `_config` and `_db` singletons in `apps/server/src/lib/config.ts` and `apps/server/src/lib/db.ts`
  - `subscriptions` Map in `packages/core/src/pipeline/events.ts` — in-memory SSE subscribers
  - `controllers` Map in `packages/core/src/pipeline/job-abort-controller.ts` — AbortController per job
  - `cache` Map in `apps/server/src/lib/genre-config.ts` — YAML mtime cache
- **Circular imports:** Not detected in current structure — dependency graph is acyclic and layered
- **JSON serialization:** `jobs.inputs`, `jobs.stageData`, `jobs.compiledJson`, `versions.artifacts` are all JSON strings stored in SQLite TEXT columns — must parse on read

## Anti-Patterns

### Database schema via raw SQL in application code

**What happens:** Drizzle ORM schema (`packages/core/src/db/schema.ts`) defines tables, but `createDb()` in `packages/core/src/db/index.ts` also creates tables via raw `CREATE TABLE IF NOT EXISTS` SQL and runs `ALTER TABLE` migrations inline. Two sources of truth for schema that can diverge.

**Why it's wrong:** The Drizzle schema file is decorative — actual table creation happens in `createDb()`. Changes to the Drizzle schema without corresponding raw SQL changes cause silent breaks.

**Do this instead:** Use Drizzle Kit migrations or a single migration system. The raw SQL in `createDb()` should be a bootstrap, not the canonical schema.

### JSON fields as opaque strings

**What happens:** Multiple tables store structured data as JSON TEXT columns (`jobs.inputs`, `jobs.stageData`, `versions.artifacts`). Readers must parse with `JSON.parse` and handle errors. The `parseVersion()` helper in `apps/web/src/api.ts` shows the friction.

**Why it's wrong:** No referential integrity, no queryability, fragile error paths. The `safeJsonParse()` utility swallows errors silently.

**Do this instead:** Normalize into related tables or use SQLite JSON functions for querying. At minimum, use Zod to validate parsed JSON on read (partial implementation: `readJobInputs()` in `json-utils.ts` goes unchecked).

### Module-level singletons for mutable state

**What happens:** `events.ts` has a module-level `subscriptions` Map, `job-abort-controller.ts` has a `controllers` Map, `genre-config.ts` has a `cache` Map, `config.ts`/`db.ts` have `_config`/`_db` singletons. All live at module scope and persist for the process lifetime.

**Why it's wrong:** These make testing harder (leakage between test cases), prevent horizontal scaling, and the subscription map is a memory leak risk if cleanup is missed.

**Do this instead:** Encapsulate state in classes instantiated per-scope. `resetTestCounters()` in `events.ts` is a band-aid — a proper `EventBus` class would be cleaner.

### Genre arrangement defaults duplicated in frontend

**What happens:** `apps/web/src/components/compose/arrangement.ts` has hardcoded `defaultSections()` for each genre. This duplicates the arrangement structure knowledge that also exists in `config/genres/*.yaml` and the server's genre-config.

**Why it's wrong:** Adding a new genre requires updating both YAML config and the frontend's `defaultSections()`. They can diverge.

**Do this instead:** Have the server expose a `GET /api/genres/:id/arrangement-defaults` endpoint, or seed the frontend arrangement from the API response.

## Error Handling

**Strategy:** Layered error handling with specific error types.

**Patterns:**
- `ApiError` class in `apps/server/src/lib/db-utils.ts` — thrown in route handlers, caught by Fastify error handler, returns structured JSON with `error` message and `statusCode`
- Pipeline error recovery — `failStage()` in `job-service.ts` implements retry with maxAttempts (default 3), then fails the job
- `safeJsonParse()` in `packages/core/src/json-utils.ts` — all JSON parsing is guarded
- `combineSignals()` in `packages/core/src/llm/client.ts` — timeout + cancellation signal combining with proper cleanup
- Unhandled promise rejection — logged as warning, not fatal
- Uncaught exception — logged as fatal, triggers shutdown
- SSE events — `error` status published to DB on pipeline failure

## Cross-Cutting Concerns

**Logging:** Pino logger throughout. `logger.child({ module })` pattern in LLM and Suno clients. Configurable level via `logLevel` config.

**Validation:** Zod schemas at every API boundary. `validateBody/validateQuery/validateParams()` wrappers in `apps/server/src/lib/validate.ts`. Input validation also at genre module boundary via `mod.inputSchema.safeParse()`.

**Authentication:** None currently. Suno API auth token stored in config. LLM API keys in config/env.

**Configuration:** `track-forge.config.js` (gitignored) + `TRACK_FORGE_*` env vars. `loadConfig()` merges with env precedence, validates via `ConfigSchema`.

---

*Architecture analysis: 2026-07-19*
