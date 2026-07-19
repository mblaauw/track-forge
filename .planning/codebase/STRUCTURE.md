# Codebase Structure

**Analysis Date:** 2026-07-19

## Directory Layout

```
track-forge/
├── apps/
│   ├── server/             # Fastify API server + CLI
│   └── web/                # Preact SPA (Vite)
├── packages/
│   ├── contracts/          # Shared Zod schemas, branded IDs, types
│   ├── core/               # Pipeline engine, DB, LLM, Suno client
│   ├── genre-core/         # GenreModule interface + shared builders
│   ├── genre-edm/          # EDM genre module
│   ├── genre-hiphop/       # HipHop genre module
│   ├── genre-ambient/      # Ambient genre module
│   └── test-support/       # Shared test mocks
├── config/
│   └── genres/             # Genre YAML config files (edm.yaml, hiphop.yaml, ambient.yaml)
├── .github/
│   └── workflows/
│       └── ci.yml          # CI pipeline
├── .planning/              # GSD planning artifacts
├── data/                   # Default SQLite DB location (gitignored)
├── node_modules/
├── package.json            # Root workspace config
├── tsconfig.base.json      # Shared TS compiler options
├── tsconfig.json           # Project references
├── vitest.config.ts        # Vitest root config
├── track-forge.config.js   # Server config (gitignored)
├── AGENTS.md               # Project agent instructions
└── .gitignore
```

## Directory Purposes

**`apps/server/`:**
- Purpose: Fastify HTTP server — API routes, CLI tooling, static file serving
- Contains: TypeScript source, compiled output (`dist/`), test files, SQLite data
- Key files:
  - `src/index.ts` — Server entry point: bootstrap, route registration, static serving, graceful shutdown
  - `src/cli.ts` — CLI commands: `export`, `export-all`, `import`
  - `src/routes/jobs.ts` — Job CRUD + pipeline dispatch (largest route file, 347 lines)
  - `src/routes/versions.ts` — Version listing + takes (Suno generation) CRUD
  - `src/routes/events.ts` — SSE streaming + event history
  - `src/routes/preview-style.ts` — Style prompt preview
  - `src/routes/suno.ts` — Suno callback endpoint
  - `src/routes/import-export.ts` — Bulk job export/import
  - `src/routes/lyrics.ts` — LLM-based lyrics generation
  - `src/routes/health.ts` — Health check
  - `src/lib/genre-config.ts` — YAML loader with mtime cache (199 lines)
  - `src/lib/modules.ts` — Genre module registry + YAML augmentation
  - `src/lib/validate.ts` — Zod schema validation wrappers + request schemas
  - `src/lib/db-utils.ts` — Utility helpers (ApiError, pagination, safeParse)
  - `src/lib/config.ts` — Config singleton wrapper
  - `src/lib/db.ts` — DB singleton wrapper

**`apps/web/`:**
- Purpose: Preact single-page application — Compose workspace UI
- Contains: Preact components, API client, router, session state, CSS
- Key files:
  - `src/main.tsx` — Preact render bootstrap
  - `src/app.tsx` — Root component: Router → SessionProvider → ComposeShell
  - `src/api.ts` — Typed HTTP API client (332 lines) — all backend calls + SSE
  - `src/lib/session.tsx` — SessionContext + SessionProvider + useSession hook
  - `src/lib/router.tsx` — Hash-based client-side router
  - `src/components/compose/ComposeShell.tsx` — Main orchestrator (forge, autosave, layout)
  - `src/components/compose/SetupColumn.tsx` — 6 collapsible setup cards
  - `src/components/compose/BundleCanvas.tsx` — Central bundle display
  - `src/components/compose/ArrangementEditor.tsx` — Section arrangement editor
  - `src/components/compose/LyricsBlock.tsx` — Lyrics editing
  - `src/components/compose/RendersPanel.tsx` — Take cards with waveform
  - `src/components/compose/LibraryPanel.tsx` — Session archive
  - `src/components/compose/ForgeStrip.tsx` — Progress strip (8-bar animation)
  - `src/components/compose/ContextBar.tsx` — Top context bar
  - `src/components/compose/types.ts` — Shared frontend types
  - `src/components/compose/arrangement.ts` — Default sections, colors, constants

**`packages/contracts/`:**
- Purpose: Single source of truth for all shared types
- Contains: `src/index.ts` — All Zod schemas, branded types, interfaces
- Key exports: `Job`, `Version`, `Config`, `GenerationStage`, `JobStatus`, `SunoArtifact`, `LyricsWriterResult`, branded IDs

**`packages/core/`:**
- Purpose: Core engine — pipeline, LLM, Suno, DB, config, utilities
- Key files:
  - `src/index.ts` — Public API exports
  - `src/config.ts` — `loadConfig()` — config from JS file + env overrides
  - `src/json-utils.ts` — `safeJsonParse()`, `readJobInputs()`, `readStageData()`
  - `src/db/schema.ts` — Drizzle schema definitions
  - `src/db/index.ts` — `createDb()` — SQLite init, table creation, migration
  - `src/pipeline/orchestrator.ts` — `runPipeline()` — 3-stage orchestrator
  - `src/pipeline/job-service.ts` — Job/version CRUD, stage transitions, state persistence
  - `src/pipeline/style-compiler.ts` — Deterministic style prompt compilation
  - `src/pipeline/suno-context.ts` — Full Suno context string builder
  - `src/pipeline/events.ts` — Event pub/sub, persistence, SSE formatting
  - `src/pipeline/types.ts` — PipelineDeps, PipelineState, PipelineResult interfaces
  - `src/pipeline/job-abort-controller.ts` — In-memory AbortController per job
  - `src/llm/client.ts` — Unified LLM client (OpenAI/Anthropic/Ollama)
  - `src/llm/types.ts` — LLM types + provider defaults
  - `src/suno/client.ts` — Suno API client
  - `src/suno/types.ts` — Suno API types
  - `src/suno/payload.ts` — Suno payload builder
  - `src/suno/callbacks.ts` — Callback URL resolver
  - `src/suno/capabilities.ts` — Suno capability detection
  - `src/suno/generation-store.ts` — Generation CRUD for SQLite
  - `__tests__/` — 9 test files covering config, DB, events, pipeline, job-service, suno-client, suno-payload

**`packages/genre-core/`:**
- Purpose: Genre module contract + shared building blocks
- Key files:
  - `src/index.ts` — `GenreModule` interface, `createGenreModule()` factory, shared types, `createBaseInputSchema()`

**`packages/genre-edm/`, `packages/genre-hiphop/`, `packages/genre-ambient/`:**
- Purpose: Genre-specific input schemas and defaults
- Pattern: Each exports a module created by `createGenreModule()` with a Zod schema, imported and augmented by server's `modules.ts`

**`packages/test-support/`:**
- Purpose: Shared mock implementations for testing
- Key exports: `mockLlm()`, `mockSuno()`, `mockGenreModule()`

**`config/genres/`:**
- Purpose: Static genre configuration data (no DB)
- Contains: `edm.yaml`, `hiphop.yaml`, `ambient.yaml` — presets, tag categories, song structures, descriptors, lyric themes, vocal presets

## Key File Locations

**Entry Points:**
- `apps/server/src/index.ts`: Server bootstrap (Fastify + routes)
- `apps/server/src/cli.ts`: CLI commands
- `apps/web/src/main.tsx`: Frontend render bootstrap
- `packages/core/src/pipeline/orchestrator.ts` (`runPipeline`): Pipeline entry point

**Configuration:**
- `track-forge.config.js`: Server config file (gitignored)
- `packages/core/src/config.ts`: Config parsing + env override logic
- `tsconfig.base.json`: Shared TypeScript compiler options
- `tsconfig.json`: Project references for tsc --build
- `vitest.config.ts`: Test runner configuration
- `apps/web/vite.config.ts`: Vite dev server + proxy

**Core Logic:**
- `packages/core/src/pipeline/`: Pipeline orchestration (orchestrator, job-service, style-compiler, suno-context, events, job-abort-controller, types)
- `packages/core/src/llm/`: LLM client abstraction
- `packages/core/src/suno/`: Suno API integration
- `packages/core/src/db/`: Database schema + connection

**Testing:**
- `packages/core/__tests__/`: 9 test files (config, db, events, job-abort-controller, job-service, pipeline, suno-client, suno-payload)
- `apps/server/__tests__/`: 4 test files (db-utils, health, import-export, jobs)
- `apps/web/__tests__/`: 1 smoke test
- `packages/test-support/src/index.ts`: Shared mocks

## Naming Conventions

**Files:**
- `kebab-case.ts` for source files: `style-compiler.ts`, `suno-context.ts`, `job-service.ts`, `job-abort-controller.ts`, `db-utils.ts`, `json-utils.ts`
- `PascalCase.tsx` for React/Preact components: `ComposeShell.tsx`, `SetupColumn.tsx`, `BundleCanvas.tsx`, `ArrangementEditor.tsx`, `LyricsBlock.tsx`, `RendersPanel.tsx`, `LibraryPanel.tsx`, `ForgeStrip.tsx`, `ContextBar.tsx`
- `snake_case.test.ts` for test files: `suno-client.test.ts`, `job-service.test.ts`
- `kebab-case.yaml` for config: `edm.yaml`, `hiphop.yaml`, `ambient.yaml`

**Directories:**
- Flat under routes: `routes/jobs.ts`, `routes/versions.ts`, `routes/events.ts`
- Grouped by function under packages: `pipeline/`, `llm/`, `suno/`, `db/`
- UI components grouped under `components/compose/`

**Functions:**
- `camelCase` for functions and methods: `runPipeline()`, `compileStylePrompt()`, `buildSunoContext()`, `createJob()`, `createDb()`, `loadConfig()`, `handleCompilation()`, `handleLyricsWriting()`
- `camelCase` for React hooks: `useSession()`, `useEffect`, `useCallback`
- `PascalCase` for React/Preact components: `ComposeShell`, `SetupColumn`, `SessionProvider`
- `PascalCase` for classes and interfaces: `LlmClient`, `SunoClient`, `ApiError`, `PipelineDeps`, `PipelineState`
- UPPER_SNAKE for constants: `DEFAULT_POLL_INTERVAL`, `STAGE_ORDER`, `STAGE_TO_LABEL`, `STAGE_LABELS`, `DELTA_PALETTE`, `SECTION_PALETTE`

**Variables:**
- `camelCase` for all local variables
- Hungarian-style `s` for session in ComposeShell: `const s = useSession()`

**Types:**
- `PascalCase` for interfaces and type aliases: `Job`, `Version`, `Config`, `PipelineState`, `SessionState`, `GenreModule`
- Enums as `const` objects with `PascalCase` keys: `GenerationStage`, `JobStatus`, `VersionStatus`, `SunoArtifactType`, `SectionType`

## Where to Add New Code

**New Feature (backend):**
- Primary route handler: `apps/server/src/routes/<name>.ts`
- Register in `apps/server/src/index.ts` with matching deps
- Business logic: `packages/core/src/<domain>/`
- Validation schemas: `apps/server/src/lib/validate.ts`
- Tests: `apps/server/__tests__/` for integration, `packages/core/__tests__/` for unit

**New Feature (frontend):**
- Component: `apps/web/src/components/compose/<Name>.tsx`
- API function: `apps/web/src/api.ts`
- State: extend `SessionState` in `apps/web/src/lib/session.tsx`
- Types: update `apps/web/src/components/compose/types.ts`

**New Genre Module:**
- Genre module package: `packages/genre-<name>/src/index.ts` + `packages/genre-<name>/src/schema.ts`
- YAML config: `config/genres/<name>.yaml`
- Register in `tsconfig.json` project references
- Import in `apps/server/src/lib/modules.ts` (`MODULE_IMPORTS`)
- Default sections in `apps/web/src/components/compose/arrangement.ts`

**New Database Table:**
- Drizzle schema: `packages/core/src/db/schema.ts`
- SQL bootstrap: `packages/core/src/db/index.ts` (`createDb()`)

**New Pipeline Stage:**
- Handler function in `packages/core/src/pipeline/orchestrator.ts`
- Add to `STAGE_ORDER` array and `stageHandlers` record
- Stage type in `packages/contracts/src/index.ts` (`GenerationStage`)
- Event publish for started/completed/error

**New External API Integration:**
- Client: `packages/core/src/<service>/client.ts`
- Types: `packages/core/src/<service>/types.ts`
- Barrel export: `packages/core/src/<service>/index.ts`
- Re-export from `packages/core/src/index.ts`

## Special Directories

**`dist/`:**
- Purpose: Compiled TypeScript output (`.js`, `.d.ts`, `.js.map`, `.d.ts.map`)
- Generated: Yes (by `tsc --build`)
- Committed: No (gitignored)

**`node_modules/`:**
- Purpose: Dependencies
- Generated: Yes (by `npm ci`)
- Committed: No (gitignored)

**`data/`:**
- Purpose: Default SQLite database location
- Generated: Yes (runtime)
- Committed: No (gitignored)

**`.codegraph/`:**
- Purpose: Code intelligence index (symbols, edges, call graph)
- Generated: Yes (by codegraph indexing)
- Committed: No (gitignored)

**`.planning/`:**
- Purpose: GSD planning artifacts (phases, milestones, codebase maps)
- Generated: Yes (by GSD workflow)
- Committed: Yes

---

*Structure analysis: 2026-07-19*
