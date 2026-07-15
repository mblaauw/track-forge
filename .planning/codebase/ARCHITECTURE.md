<!-- refreshed: 2026-07-15 -->
# Architecture

**Analysis Date:** 2026-07-15

## System Overview

```text
┌────────────────────────────────────────────────────────────────┐
│                        Web UI (Preact SPA)                      │
│           `apps/web/` — Hash Router, 4 views                    │
├────────────────────────────────────────────────────────────────┤
│                          REST / SSE                              │
├────────────────────────────────────────────────────────────────┤
│                  Server (Fastify HTTP API)                      │
│            `apps/server/` — Routes, Genre Registry              │
├──────────────────────┬──────────────────────┬──────────────────┤
│     LLM Clients      │    Suno AI Client    │    SQLite DB      │
│   `packages/core/llm`│  `packages/core/suno`│ `packages/core/db`│
├──────────────────────┴──────────────────────┴──────────────────┤
│                    Core Pipeline Engine                         │
│              `packages/core/src/pipeline/`                      │
│   8-stage orchestrator: ref → plan → write → compile → review → │
│                       revision → verify → versioning            │
├────────────────────────────────────────────────────────────────┤
│                     Genre Modules (Plugin)                      │
│ `packages/genre-{edm,hiphop,pop,ambient,dnb}/`                 │
│           Implement GenreModule<TInputs, TBlueprintData>        │
├────────────────────────────────────────────────────────────────┤
│                 Genre Config (YAML Static Data)                  │
│            `config/genres/*.yaml` — presets, tags, vocab        │
└────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Web UI | Preact SPA with hash routing, 4 views (Library/Create/Forge/Studio) | `apps/web/src/` |
| Server | Fastify HTTP server, route registration, genre module loading | `apps/server/src/index.ts` |
| Contracts | Shared Zod schemas, branded IDs, type definitions | `packages/contracts/src/index.ts` |
| Core Pipeline | Orchestrates 8-stage generation pipeline | `packages/core/src/pipeline/orchestrator.ts` |
| LLM Client | Multi-provider LLM abstraction (OpenAI/Anthropic/Ollama/openai-compatible) | `packages/core/src/llm/client.ts` |
| Suno Client | Suno AI API integration (submit, poll, callback) | `packages/core/src/suno/client.ts` |
| DB Layer | SQLite via better-sqlite3 + drizzle-orm, auto-migration | `packages/core/src/db/index.ts` |
| Event System | Pub/sub with DB persistence, SSE delivery | `packages/core/src/pipeline/events.ts` |
| Genre Core | GenreModule interface, SongStructure, TagPolicy | `packages/genre-core/src/index.ts` |
| Genre Modules | EDM, HipHop, Pop, Ambient, DNB implementations | `packages/genre-*/src/index.ts` |
| Genre Config | YAML-based static genre data (presets, tags, structure) | `apps/server/src/lib/genre-config.ts` |

## Pattern Overview

**Overall:** Multi-package monorepo with layered architecture + plugin-based genre modules.

**Key Characteristics:**
- **Monorepo** managed via npm workspaces with TypeScript composite project references
- **Plugin architecture** for genre modules — each genre implements `GenreModule<TInputs, TBlueprintData>` from `@track-forge/genre-core`
- **Pipeline-as-code** — 8 sequential stages driven by an orchestrator loop with state persistence
- **Event-driven progress** — every stage transition emits events persisted to DB and streamed via SSE
- **Static genre config** — genre metadata lives in YAML files, not the DB

## Layers

**Web UI Layer:**
- Purpose: Client-side SPA with hash-based routing, session state, and API integration
- Location: `apps/web/src/`
- Contains: `main.tsx` (entry), `app.tsx` (root), `pages/` (4 views), `components/` (shell, nav, transport), `lib/` (router, session, autosave)
- Depends on: REST API at `/api/*`, genre modules for form schemas
- Used by: End users (browser)

**Server Layer:**
- Purpose: HTTP API server, genre module loading, static SPA serving, CLI tools
- Location: `apps/server/src/`
- Contains: `index.ts` (entry, Fastify setup), `routes/` (7 route files), `lib/` (config, db, modules, genre-config)
- Depends on: `@track-forge/core`, `@track-forge/contracts`, `@track-forge/genre-*`
- Used by: Web UI, CLI operators, Suno webhooks

**Core Layer:**
- Purpose: Pipeline execution, DB access, LLM integration, Suno integration, event system
- Location: `packages/core/src/`
- Contains: `pipeline/` (orchestrator, job-service, events, prompt-assembler, critic-runner, etc.), `llm/`, `suno/`, `db/`, `lyrics/`, `config.ts`
- Depends on: `@track-forge/contracts`, `@track-forge/genre-core`
- Used by: Server, genre modules

**Contracts Layer:**
- Purpose: Shared types, Zod schemas, branded IDs, config schema
- Location: `packages/contracts/src/index.ts`
- Contains: All type definitions (Job, Version, SunoArtifact, CriticFinding, etc.), Zod config schema
- Depends on: `zod` only
- Used by: All other packages

**Genre Layer:**
- Purpose: Genre-specific logic — input schemas, renderers, critics, validators, tag categories
- Location: `packages/genre-*/src/`
- Contains: `GenreModule` implementations for edm, hiphop, pop, ambient, dnb
- Depends on: `@track-forge/genre-core`, `@track-forge/contracts`
- Used by: Server (via registry), Web UI (Create page imports genre modules directly)

## Data Flow

### Primary Request Path (Job Creation → Pipeline Execution)

1. User submits job via `POST /api/jobs` (`apps/server/src/routes/jobs.ts:38`)
2. Server validates inputs against genre module's `inputSchema` (`apps/server/src/routes/jobs.ts:57`)
3. `createJob()` creates a DB row with status `pending` (`packages/core/src/pipeline/job-service.ts:35`)
4. `POST /api/jobs/:id/start` triggers `runPipeline()` (`packages/core/src/pipeline/orchestrator.ts:630`)
5. Pipeline loops through 8 stages (ref_interpretation → planning → style_writing → compilation → review → revision → verification → versioning)
6. Each stage calls `publish()` to persist events and notify SSE subscribers (`packages/core/src/pipeline/events.ts:49`)
7. After versioning, job marked `completed` with artifacts stored in version row
8. Client receives final result via SSE

### Event Streaming

1. Server exposes `GET /api/jobs/:id/events` SSE endpoint (`apps/server/src/routes/events.ts:13`)
2. On connect, replays last 50 events from DB history
3. Subscribes to in-memory pub/sub for live events
4. Keep-alive ping every 15s
5. Clean unsubscribe on client disconnect

### Genre Config Flow

1. Server starts: `initConfig()` → `initDb()` → registers routes (`apps/server/src/index.ts:21-44`)
2. Route handlers call `getModuleOrThrow(genreId)` → loads from module registry (`apps/server/src/lib/modules.ts`)
3. `augment()` attaches `songStructure` from YAML config (`apps/server/src/lib/genre-config.ts:106`)
4. Genre config endpoints serve presets (`GET /api/genres/:id/presets`) and tag categories (`GET /api/genres/:id/tag-categories`)

**State Management:**
- Pipeline state mutable in memory; persisted to DB `stage_data` column after each stage
- Job status, compiled JSON, findings, and stage data all stored on the `jobs` table row
- In-memory event pub/sub with DB persistence for reconnect replay

## Key Abstractions

**PipelineDeps & PipelineState:**
- Purpose: Injectable dependencies and mutable state for pipeline execution
- Files: `packages/core/src/pipeline/types.ts`
- Pattern: Interface + mutable object passed through stage handlers

**GenreModule<TInputs, TBlueprintData>:**
- Purpose: Plugin contract for genre-specific logic (input schemas, renderers, critics, validators)
- Files: `packages/genre-core/src/index.ts:53-103`
- Pattern: Generic interface, implemented by each genre package

**PromptAssembler:**
- Purpose: Resolves stage-specific prompts from genre module's `promptFragments` with `{{placeholder}}` replacement
- Files: `packages/core/src/prompt-assembler.ts`
- Pattern: Template-based prompt construction with context injection

**SunoClient:**
- Purpose: Suno AI API client — submit generations, poll status, handle callbacks
- Files: `packages/core/src/suno/client.ts`
- Pattern: Class-based HTTP client with polling and configurable intervals

**ReferenceCache:**
- Purpose: LRU cache for interpreted reference files to avoid re-interpreting identical sources
- Files: `packages/core/src/pipeline/reference-cache.ts`
- Pattern: Module-level singleton with hash-based dedup

**LockService:**
- Purpose: Artifact locking for multi-server concurrency, with periodic cleanup
- Files: `packages/core/src/pipeline/lock-service.ts`
- Pattern: DB-backed advisory locks with TTL

## Entry Points

**Server HTTP:**
- Location: `apps/server/src/index.ts`
- Triggers: `npm run -w apps/server dev` or `node apps/server/dist/index.js`
- Responsibilities: Fastify setup, DI wiring, route registration, static SPA serving, periodic lock cleanup

**Server CLI:**
- Location: `apps/server/src/cli.ts`
- Triggers: `node apps/server/dist/cli.js export|export-all|import`
- Responsibilities: Job export/import from JSON files

**Web App:**
- Location: `apps/web/src/main.tsx`
- Triggers: Vite dev server or static file load in browser
- Responsibilities: Render Preact app with hash router, session context, and API integration

**Pipeline Execution:**
- Location: `packages/core/src/pipeline/orchestrator.ts` — `runPipeline()`
- Triggers: `POST /api/jobs/:id/start` route handler
- Responsibilities: Execute 8 pipeline stages in sequence with abort support and state persistence

## Architectural Constraints

- **Threading:** Single-threaded Node.js event loop. Pipeline stages are async/await. LLM and Suno calls are non-blocking HTTP requests. No worker threads.
- **Global state:** Module-level singletons: `_refCache` (`packages/core/src/pipeline/orchestrator.ts:51`), event subscriptions map (`packages/core/src/pipeline/events.ts:25`), `_config` (`apps/server/src/lib/config.ts:4`), `_db` (`apps/server/src/lib/db.ts:5`), genre config cache (`apps/server/src/lib/genre-config.ts:57`).
- **Circular imports:** None detected — dependency direction is contracts → core → server/web, with genre modules only importing genre-core + contracts.
- **Genre module loading:** Genre modules are imported statically by both server (`apps/server/src/lib/modules.ts`) and web UI (`apps/web/src/pages/CreateSession.tsx`). This means adding a new genre requires updating both.
- **DB consistency:** No migration framework — `createDb()` uses `CREATE TABLE IF NOT EXISTS` + try/catch `ALTER TABLE` for schema evolution.

## Anti-Patterns

### JSON column parse without type guard

**What happens:** `compiledJson`, `findings`, `stageData`, `artifacts`, and `inputs` are stored as serialized JSON strings in SQLite TEXT columns. Multiple files use try/catch `JSON.parse()` without runtime type guards.

**Why it's wrong:** A corrupted or unexpected-shaped JSON string silently becomes a default value, masking data corruption.

**Do this instead:** Use Zod runtime validation on parse (e.g., `CompiledJsonSchema.safeParse(parsed)`) as shown in `packages/core/src/pipeline/orchestrator.ts:654-661` — but this pattern isn't consistently applied across all JSON reads.

### Static genre-to-module mapping

**What happens:** Both `apps/server/src/lib/modules.ts` and `apps/web/src/pages/CreateSession.tsx` maintain a hardcoded `Record<string, GenreModule>` mapping. Adding a genre requires editing two files.

**Why it's wrong:** Violates DRY. A new genre needs registration in both the server module registry and the web UI's CreateSession page.

**Do this instead:** Use a dynamic genre module discovery mechanism or a single registry package that both server and web import.

## Error Handling

**Strategy:** Try/catch at pipeline stage boundaries and route handlers. Pipeline errors are caught in `runPipeline()` catch block (`packages/core/src/pipeline/orchestrator.ts:795`).

**Patterns:**
- Pipeline errors → publish error event → `failStage()` → return `{ success: false, error }`
- Route errors → Fastify error handling → HTTP 4xx/5xx responses
- LLM timeouts detected by message string matching
- JSON parse errors → silent defaults (try/catch with no fallback logging)
- Event callback errors → swallowed silently

## Cross-Cutting Concerns

**Logging:** pino logger throughout. Server creates root logger, passes `logger.child({ module: "..." })` to sub-systems. LLM and Suno clients create their own child loggers.

**Validation:** Zod schemas at boundaries — `ConfigSchema` for config, genre module `inputSchema` for job inputs, `blueprintSchema` for internal validation. No shared request/response validation layer — each route validates ad-hoc.

**Authentication:** None currently. Suno auth token stored in config `sunoAuthToken`. LLM API key in `llmApiKey`. No user auth on the API.

**Static file serving:** Production mode serves the built SPA from `staticDir` with path traversal protection (`apps/server/src/index.ts:89`).

---

*Architecture analysis: 2026-07-15*
