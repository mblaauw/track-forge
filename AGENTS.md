# Track Forge

TypeScript npm-workspace app: Fastify server, Preact/Vite web client, SQLite (Drizzle ORM) persistence, data-driven genre config (YAML), OpenAI-compatible LLM integration, Suno generation through a server-side adapter.

## Quick start

```bash
npm ci
npm run build                              # tsc -b all packages --force + web build
npm test                                   # vitest run (all workspaces)
SUNO_DRY_RUN=true npm run -w apps/server dev   # Fastify on :3000, skips real Suno
npm run -w apps/web dev                        # Vite on :5173, proxies /api → :3000
npx prettier --check .
npx tsc --noEmit
node scripts/validate-genres.mjs
```

### Single file / focused checks

```bash
npx vitest run packages/core/src/pipeline/orchestrator.test.ts   # single test file
npx vitest run -t "test name"                                     # single test by name
npx playwright test e2e/forge-edm-instrumental.spec.ts            # single E2E spec
npx playwright show-report                                        # inspect failed Playwright trace
```

### Full verification order (run before declaring done)

```bash
npm run clean && npm run build && npm test && npx prettier --check . && npx tsc --noEmit && node scripts/validate-genres.mjs
```

If server/web/session code changed, also run `npx playwright test e2e/`.

## Configuration

`track-forge.config.js` (project root, gitignored) with env-var overrides. All env vars prefixed `TRACK_FORGE_` — see `packages/core/src/config.ts` for full list. Default DB path is `./data/track-forge.db`. Set `SUNO_DRY_RUN=true` to skip real Suno calls. Set `TRACK_FORGE_LIVE_SUNO=1` (with explicit approval) for live Suno smoke tests.

## Source of truth

| Concern                | Location                                                                                   |
| ---------------------- | ------------------------------------------------------------------------------------------ |
| Pipeline stages        | `packages/core/src/pipeline/orchestrator.ts` — `compilation → lyrics_writing → versioning` |
| Genre vocabulary       | `config/genres/<id>.yaml` (presets, descriptors, structure, palette)                       |
| Shared API types       | `packages/contracts/src/index.ts`                                                          |
| Genre module types     | `packages/genre-core/src/index.ts` — `SectionFunction`, `Vocal`, `DescriptorCategory`      |
| DB schema              | `packages/core/src/db/schema.ts`                                                           |
| Web session            | `apps/web/src/lib/session.tsx` — `SessionProvider` + `useSession()`                        |
| Suno provider contract | `packages/core/src/suno/client.ts` — `submit()`, `getGenerationStatus()`                   |
| Pipeline deps          | `packages/core/src/pipeline/types.ts` — `PipelineDeps` (no `suno` field)                   |
| Fake test providers    | `packages/test-support/src/providers/` — 10 scenarios                                      |
| Song intent contract   | `packages/song-intent/src/types.ts` — `SongIntentV1`, `StyleInfluence`                     |
| Legacy job → intent    | `packages/song-intent/src/migrate-legacy.ts` — `migrateLegacyJob()`                        |
| E2E tests              | `e2e/` — 7 Playwright specs including `idempotency.spec.ts`                                |
| Server entry           | `apps/server/src/index.ts` — Fastify, registers all routes, static GUI serving             |
| Web entry              | `apps/web/src/main.tsx` — Preact render                                                    |

## Architecture

**Workspaces:** `apps/{server,web}` and `packages/{contracts,core,genre-core,genre-edm,genre-hiphop,genre-ambient,test-support}`. Build order via TypeScript project references: `contracts`/`genre-core` at the bottom, `apps/server` depends on `core` + genre packages, `apps/web` depends only on `contracts` + `genre-core`.

**Pipeline** (`packages/core/src/pipeline/orchestrator.ts`): exactly three stages — `compilation` (deterministic, no LLM) → `lyrics_writing` (the _only_ LLM call; skipped when `lyricsMode === "strict_instrumental"`) → `versioning` (persists artifacts, sets `currentStage: "completed"`). After versioning, the web UI triggers a take via `POST /api/versions/:id/takes`, which submits to Suno and streams render status over SSE. `PipelineDeps` deliberately excludes a `suno` field — the pipeline never calls Suno.

**Genre config is data, not code:** `config/genres/<id>.yaml` holds presets, descriptor vocab/weights, arrangement defaults, and vocal presets. TypeScript genre modules (`packages/genre-*/src/*.ts`) are reduced to `createGenreModule({ id, name, inputSchema, defaults })` — schema/runtime only. Every YAML change needs `node scripts/validate-genres.mjs` to pass. There is a `config/shared.yaml` for cross-genre shared config.

**Server startup** (`apps/server/src/index.ts`): creates Fastify instance with error handler, validates genre configs on startup, registers 8 route modules, resets stuck `in_progress` jobs after crash. Optionally serves static GUI from `config.staticDir`. Graceful shutdown on SIGTERM/SIGINT.

**Suno integration** (`packages/core/src/suno/client.ts`): single adapter with `submit()` (POST `/api/v1/generate`), `getGenerationStatus()` (GET `/api/v1/generate/record-info`), and `waitForCompletion()` (exponential backoff polling). Webhook callback at `POST /api/suno/callback` on the server. `suno_render`/`suno_render_complete`/`suno_render_error` are synthetic SSE stage labels — not real pipeline stages. Never call live Suno in dev/tests without `SUNO_DRY_RUN=true` or explicit `TRACK_FORGE_LIVE_SUNO=1` approval.

**Trace/observability:** Pipeline trace is now via pino logger (silent by default, enabled with `TRACE_LOG_LEVEL=debug`), not the old shared-file append.

## Stable invariants

- Only `compilation → lyrics_writing → versioning` may be extended. `node scripts/check-architecture.mjs` enforces forbidden symbols and file names.
- `PipelineDeps` does not include `suno` — the pipeline never calls Suno directly.
- `completeJob()` sets `currentStage: "completed"`, so `job.currentStage !== "completed"` means still running.
- Stage errors use `failStage()` which retries up to 3 times before failing the job.
- Genre content belongs in YAML unless it is schema or runtime behavior (`GenreModule.inputSchema`/`defaults`).
- Browser never receives provider credentials.
- No live provider calls in tests — use fakes from `packages/test-support/src/providers/` (10 scenarios). Fake `submit()` returns `{ taskId: string }`.
- UI state transitions driven by server events require Playwright browser tests, not only component unit tests.
- Every external-provider contract change needs a fixture update + contract test.
- Web imports types from `@track-forge/contracts` and `@track-forge/genre-core` — never redefine locally.
- Database-destructive actions require explicit user approval.
- `SongIntentV1` (`packages/song-intent`) is the canonical typed intent contract. `SongIntentV1Schema` is `.strict()` — adding a field requires a schema bump. `migrateLegacyJob()` is the lossless bridge from existing `jobs.inputs` JSON.
- `key`/`scale` are optional harmonic hints on `SongIntentV1.musical`, not required by any stage today; presets may still carry them but the validator will warn (Phase 6 enforcement).

## Commands (OpenCode built-in)

| Command               | Location                                   | Purpose                                   |
| --------------------- | ------------------------------------------ | ----------------------------------------- |
| `/verify`             | `.opencode/commands/verify.md`             | Full verification suite                   |
| `/smoke-forge`        | `.opencode/commands/smoke-forge.md`        | E2E forge→take→render with fake providers |
| `/edit-genre`         | `.opencode/commands/edit-genre.md`         | Edit genre YAML with validation           |
| `/trace-generation`   | `.opencode/commands/trace-generation.md`   | Display job pipeline trace                |
| `/audit-reachability` | `.opencode/commands/audit-reachability.md` | Dead code detection                       |

## Code discovery

Prefer `rg`/`fd` for exact symbols, strings, filenames, and local edits. If CodeGraph MCP tools are available, use them for cross-file behavior, call-graph, reachability, and impact analysis — but confirm any dead-code conclusion with `rg` before deleting anything, since CodeGraph freshness isn't guaranteed.

## Review agent

A read-only `track-forge-reviewer` subagent is defined at `.opencode/agents/track-forge-reviewer.md` with architecture regression, YAML-vs-code, pipeline-stage integrity, and provider-isolation checklists.

# Agent Instructions

## Output Style

- **Extreme brevity required.** Omit all greetings, pleasantries, filler, and fluff.
- Output direct answer or code immediately without setup/teardown commentary.
- Keep explanations terse and focused on the "why," not the obvious "what."
- When showing code, show only modified blocks or functions rather than full files.
