# Codebase Structure

**Analysis Date:** 2026-07-15

## Directory Layout

```
track-forge/
├── apps/
│   ├── server/                    # Fastify HTTP API server
│   │   ├── src/
│   │   │   ├── index.ts           # Entry point — Fastify setup, DI wiring, route registration
│   │   │   ├── cli.ts             # CLI tool (export/import jobs)
│   │   │   ├── lib/
│   │   │   │   ├── config.ts      # Config initializer (singleton wrapper)
│   │   │   │   ├── db.ts          # DB initializer (singleton wrapper)
│   │   │   │   ├── modules.ts     # Genre module registry (static import of all genres)
│   │   │   │   └── genre-config.ts# YAML genre config loader (presets, tags, structure)
│   │   │   └── routes/
│   │   │       ├── health.ts      # GET /api/health
│   │   │       ├── jobs.ts        # CRUD + start/cancel/replay/review for jobs (620 lines)
│   │   │       ├── versions.ts    # Version CRUD, artifact locking, tree, promote/rollback
│   │   │       ├── suno.ts        # Suno callback webhook + generation status/takes
│   │   │       ├── events.ts      # SSE event streaming + event history
│   │   │       ├── projects.ts    # Project/draft CRUD
│   │   │       └── import-export.ts # Job import/export via JSON bundle
│   │   └── __tests__/
│   │       └── jobs.test.ts
│   │
│   └── web/                       # Preact SPA (Vite)
│       ├── src/
│       │   ├── main.tsx           # Entry — renders <App /> on #app
│       │   ├── app.tsx            # Root: Router > SessionProvider > AppShell
│       │   ├── api.ts             # REST API client + SSE helper (423 lines, all endpoints)
│       │   ├── style.css          # Design tokens, layout, component styles (~2000 lines)
│       │   ├── lib/
│       │   │   ├── router.tsx     # Custom hash-based router (Router/Route/Link/useRouter)
│       │   │   ├── session.tsx    # Session context provider + useSession hook
│       │   │   └── useAutosave.ts # Auto-save hook for form inputs
│       │   ├── components/
│       │   │   ├── AppShell.tsx   # Shell: NavRail + TransportBar + route dispatch
│       │   │   ├── NavRail.tsx    # Navigation sidebar
│       │   │   ├── TransportBar.tsx # Bottom transport bar (status, forge button)
│       │   │   └── AutoSaveIndicator.tsx # Auto-save spinner indicator
│       │   └── pages/
│       │       ├── Library.tsx     # View: job list, genre cards, delete/favorite
│       │       ├── CreateSession.tsx # View: genre selection, presets, Style Console (969 lines)
│       │       ├── Forge.tsx       # View: 8-stage assembly line with SSE progress
│       │       └── Studio.tsx      # View: version browser, takes player, style/lyric editors
│       └── __tests__/
│
├── packages/
│   ├── contracts/                 # Shared types, Zod schemas, branded IDs
│   │   └── src/index.ts           # ~450 lines — all type definitions in one file
│   │
│   ├── core/                      # Pipeline engine, DB, LLM, Suno, event system
│   │   ├── src/
│   │   │   ├── index.ts           # Public API surface (82 exports)
│   │   │   ├── config.ts          # Config loader (env var + config file merge)
│   │   │   ├── db/
│   │   │   │   ├── index.ts       # createDb() — SQLite init, schema creation, migrations
│   │   │   │   └── schema.ts       # Drizzle ORM schema (all 8 tables)
│   │   │   ├── llm/
│   │   │   │   ├── client.ts      # LlmClient — multi-provider HTTP client (263 lines)
│   │   │   │   ├── types.ts       # Provider config, request/response types
│   │   │   │   └── index.ts       # Re-exports
│   │   │   ├── suno/
│   │   │   │   ├── client.ts      # SunoClient — submit/poll/callback (256 lines)
│   │   │   │   ├── types.ts       # Suno API types
│   │   │   │   ├── payload.ts     # Suno payload generation from artifacts
│   │   │   │   ├── capabilities.ts# Capability detection
│   │   │   │   ├── callbacks.ts   # Callback URL resolution
│   │   │   │   ├── generation-store.ts # DB operations for generations
│   │   │   │   └── index.ts
│   │   │   ├── lyrics/
│   │   │   │   ├── canonical.ts   # LyricsDocument parse/serialize (188 lines)
│   │   │   │   └── index.ts
│   │   │   └── pipeline/          # Core pipeline engine
│   │   │       ├── types.ts       # PipelineDeps, PipelineState, PromptContext (87 lines)
│   │   │       ├── orchestrator.ts # runPipeline() + 8 stage handlers (910 lines)
│   │   │       ├── job-service.ts # Job CRUD, stage advancement, version creation (260 lines)
│   │   │       ├── events.ts      # Pub/sub event system, DB persistence, SSE support
│   │   │       ├── prompt-assembler.ts # Template prompt construction with context injection
│   │   │       ├── critic-runner.ts    # LLM-based critic execution
│   │   │       ├── reference-cache.ts  # LRU reference cache
│   │   │       ├── reference-interpreter.ts # Reference audio analysis
│   │   │       ├── lyrics-patcher.ts   # Surgical lyrics patch application
│   │   │       ├── lock-service.ts     # DB-backed artifact locks
│   │   │       ├── job-abort-controller.ts # Job cancellation with signal propagation
│   │   │       └── index.ts
│   │   └── __tests__/
│   │
│   ├── genre-core/                # GenreModule interface + shared types
│   │   └── src/index.ts           # GenreModule, SongStructure, TagCategory, etc. (198 lines)
│   │
│   ├── genre-edm/                 # EDM genre module
│   │   └── src/
│   │       ├── index.ts           # edmModule export (136 lines)
│   │       ├── schema.ts          # EdmInputs/EdmBlueprint Zod schemas + compileBlueprint
│   │       ├── presets.ts         # EDM_PRESETS (83 presets)
│   │       ├── renderers.ts       # Title, style, excludedStyles, lyrics renderers
│   │       ├── critics.ts         # Genre-specific critic definitions
│   │       ├── validators.ts      # Input + blueprint validators
│   │       ├── tag-categories.ts  # Style Console tag categories
│   │       └── taxonomy.ts        # Subgenre taxonomy (80+ subgenres)
│   │
│   ├── genre-hiphop/              # Hip-Hop genre module
│   ├── genre-pop/                 # Pop genre module (3 presets)
│   ├── genre-ambient/             # Ambient genre module (2 presets)
│   ├── genre-dnb/                 # Drum & Bass genre module (2 presets)
│   │
│   └── test-support/              # Shared test helpers
│       └── src/
│           ├── index.ts
│           ├── test-db.ts         # In-memory SQLite test DB
│           └── test-logger.ts     # No-op test logger
│
├── config/
│   └── genres/                    # YAML genre static config
│       ├── edm.yaml
│       ├── hiphop.yaml
│       ├── pop.yaml
│       ├── ambient.yaml
│       └── dnb.yaml
│
├── data/                          # Default SQLite DB directory (gitignored)
│
├── .github/workflows/
│   └── ci.yml                     # CI: check (tsc + vitest + prettier) then lint (tsc --noEmit)
│
├── .planning/                     # Project planning docs
│
├── package.json                   # Root workspace config (npm workspaces)
├── tsconfig.json                  # Composite project references
├── tsconfig.base.json             # Shared compiler options
├── track-forge.config.js          # Runtime config (gitignored)
├── vitest.config.ts               # Vitest root config
└── AGENTS.md                      # Project documentation for AI agents
```

## Directory Purposes

**`apps/server/` (API Server):**
- Purpose: HTTP API server, CLI tools, genre module augmentation with YAML config
- Contains: Fastify route handlers, lib utilities, CLI entry point
- Key files: `src/index.ts` (entry), `src/cli.ts` (CLI), `src/routes/jobs.ts` (main route file, 620 lines)

**`apps/web/` (Web UI):**
- Purpose: Preact SPA with 4 views — Library, Create, Forge, Studio
- Contains: Page components, shared UI components, API client, custom hash router
- Key files: `src/main.tsx` (entry), `src/api.ts` (full API client, 423 lines), `src/pages/CreateSession.tsx` (largest page, 969 lines)

**`packages/contracts/` (Shared Types):**
- Purpose: Single source of truth for all domain types, Zod schemas, branded IDs
- Contains: Everything in `src/index.ts` (~450 lines, no subdirectories)
- Key files: `src/index.ts`

**`packages/core/` (Core Engine):**
- Purpose: Pipeline orchestration, DB, LLM, Suno integration, event system, lyrics
- Contains: Pipeline engine, platform clients, DB layer
- Key files: `src/pipeline/orchestrator.ts` (910 lines, largest), `src/db/index.ts` (schema+creation), `src/suno/client.ts` (256 lines)

**`packages/genre-*/` (Genre Modules):**
- Purpose: Per-genre logic implementing `GenreModule<TInputs, TBlueprintData>`
- Contains: Schema, presets, renderers, critics, validators, tag categories
- Each genre module follows identical structure: `schema.ts`, `presets.ts`, `renderers.ts`, `critics.ts`, `validators.ts`, `tag-categories.ts`

**`config/genres/` (Genre Static Data):**
- Purpose: Version-controlled genre metadata (presets, tags, structure, defaults)
- Contains: One YAML file per genre
- Key files: `apps/server/src/lib/genre-config.ts` (loader)

## Key File Locations

**Entry Points:**
- `apps/server/src/index.ts`: Fastify server entry — config init, DI, route registration
- `apps/server/src/cli.ts`: CLI entry — job import/export commands
- `apps/web/src/main.tsx`: Preact SPA entry — render `<App />`
- `packages/core/src/pipeline/orchestrator.ts`: Pipeline execution entry — `runPipeline()`

**Configuration:**
- `track-forge.config.js`: Runtime config (DB path, LLM provider, port, etc.) — gitignored
- `tsconfig.base.json`: Shared TypeScript compiler options (ES2022, ESNext modules, composite)
- `tsconfig.json`: Composite project references linking all workspaces
- `vitest.config.ts`: Test runner root config
- `packages/core/src/config.ts`: Config loader — env vars `TRACK_FORGE_*` override config file

**Core Logic:**
- `packages/core/src/pipeline/orchestrator.ts`: 8-stage pipeline orchestration (910 lines)
- `packages/core/src/pipeline/job-service.ts`: Job and version CRUD
- `packages/core/src/pipeline/prompt-assembler.ts`: LLM prompt template system
- `packages/core/src/pipeline/critic-runner.ts`: LLM-based quality checks
- `packages/core/src/suno/client.ts`: Suno AI API client
- `packages/core/src/llm/client.ts`: Multi-provider LLM abstraction

**Testing:**
- `packages/test-support/src/`: Shared test helpers (test DB, test logger)
- `apps/server/__tests__/`: Server integration tests
- `packages/core/__tests__/`: Core unit/integration tests

## Naming Conventions

**Files:**
- PascalCase for React/Preact components: `AppShell.tsx`, `NavRail.tsx`, `CreateSession.tsx`
- kebab-case for utility modules: `job-service.ts`, `prompt-assembler.ts`, `critic-runner.ts`, `reference-cache.ts`, `genre-config.ts`, `import-export.ts`
- camelCase for standard modules: `config.ts`, `main.tsx`, `router.tsx`, `session.tsx`
- Test files: `*.test.ts` (co-located in `__tests__/` directories)

**Directories:**
- Singular names: `lib/`, `db/`, `llm/`, `suno/`, `lyrics/`, `pipeline/`
- Route directories use `routes/`
- Web pages use `pages/`
- Components use `components/`

## Where to Add New Code

**New Feature (API endpoint):**
- Route handler: `apps/server/src/routes/<name>.ts`
- Register in `apps/server/src/index.ts` with `register<Name>Routes()`
- DB schema: `packages/core/src/db/schema.ts` (add table) or `packages/core/src/db/index.ts` (add migration)
- API client: `apps/web/src/api.ts` (add fetch function)
- Types: `packages/contracts/src/index.ts` (add interfaces)

**New Genre Module:**
- Implementation: `packages/genre-<name>/src/` — follow existing pattern (schema, presets, renderers, critics, validators, tag-categories)
- Package registration: `apps/server/src/lib/modules.ts` (add import + MODULES entry)
- Web UI registration: `apps/web/src/pages/CreateSession.tsx` (add import + GENRE_MODULES entry)
- Static config: `config/genres/<name>.yaml`
- YAML config loader: `apps/server/src/lib/genre-config.ts` (add to `listGenreConfigs()` if needed)
- Workspace: Add to root `tsconfig.json` references and root `package.json` workspaces

**New Pipeline Stage:**
- Handler: `packages/core/src/pipeline/orchestrator.ts` — add function matching `StageHandler` signature
- Stage order: Add to `STAGE_ORDER` array in same file
- Stage ID: Add to `GenerationStage` const in `packages/contracts/src/index.ts`
- State: Add field to `PipelineState` in `packages/core/src/pipeline/types.ts`
- Stage data: Add to `StageData` in `packages/core/src/pipeline/job-service.ts`

**New Shared Utility:**
- Server utilities: `apps/server/src/lib/<name>.ts`
- Core utilities: `packages/core/src/<name>/` — create subdirectory with `index.ts` barrel export
- Test helpers: `packages/test-support/src/<name>.ts`

## Special Directories

**`config/genres/`:**
- Purpose: YAML static data files for genre configuration
- Generated: No (hand-authored)
- Committed: Yes
- Loaded at runtime by `apps/server/src/lib/genre-config.ts`

**`data/`:**
- Purpose: Default SQLite database storage
- Generated: Yes (on first server start or when DB doesn't exist)
- Committed: No (in `.gitignore`)

**`.planning/`:**
- Purpose: Project planning artifacts (docs, codebase maps, phase plans)
- Generated: Partially (some human-authored, some AI-generated)
- Committed: Yes

**Build artifacts (`dist/` and `.js`/`.d.ts` alongside source):**
- TypeScript composite build emits `.js`/`.d.ts`/`.js.map`/`.d.ts.map` beside source files
- Generated: Yes (by `tsc --build`)
- Committed: No (gitignored)
- Can cause confusion if stale — run `npm run clean && npm run build` on weird errors

---

*Structure analysis: 2026-07-15*
