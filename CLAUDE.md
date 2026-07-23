# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Track Forge: TypeScript npm-workspace app. Fastify server + Preact/Vite web client, SQLite (Drizzle ORM) persistence, data-driven genre configuration (YAML), OpenAI-compatible LLM integration, Suno music generation through a server-side adapter.

## Commands

```bash
npm ci
npm run build                                    # tsc -b all packages (force) + web build
npm test                                         # vitest run (all workspaces)
npm run test:watch                               # vitest watch mode
npx vitest run <path/to/file.test.ts>            # single test file
npx vitest run -t "<test name>"                  # single test by name
npm run lint                                     # tsc --noEmit
npm run clean                                    # remove dist/, .tsbuildinfo, generated test artifacts
node scripts/validate-genres.mjs                 # validate config/genres/*.yaml
node scripts/check-architecture.mjs              # fail if removed systems/stage names resurface

SUNO_DRY_RUN=true npm run -w apps/server dev      # Fastify on :3000, skips real Suno calls
npm run -w apps/web dev                           # Vite on :5173, proxies /api → :3000

npx playwright test                               # full E2E suite (needs server+web running)
npx playwright test e2e/forge-edm-instrumental.spec.ts   # single E2E spec
npx playwright show-report                        # inspect a failed Playwright trace
```

Full verification order (mirrors CI, run before declaring anything done):

```bash
npm run clean && npm run build && npm test && npx prettier --check . && npx tsc --noEmit && node scripts/validate-genres.mjs
```

If server/web/session code changed, also run `npx playwright test e2e/`.

## Source of truth

| Concern                | Location                                                                                        |
| ---------------------- | ----------------------------------------------------------------------------------------------- |
| Pipeline stages        | `packages/core/src/pipeline/orchestrator.ts` — `compilation → lyrics_writing → versioning`      |
| Genre vocabulary       | `config/genres/<id>.yaml` (presets, descriptors, structure, palette)                            |
| Shared API types       | `packages/contracts/src/index.ts`                                                               |
| Genre module types     | `packages/genre-core/src/index.ts` — `SectionFunction`, `Vocal`, `DescriptorCategory`, etc.     |
| DB schema              | `packages/core/src/db/schema.ts`                                                                |
| Web session state      | `apps/web/src/lib/session.tsx` — `SessionProvider` + `useSession()` (no `onForge` in state)     |
| Suno provider contract | `packages/core/src/suno/client.ts` — `submit()`, `getGenerationStatus()`, `waitForCompletion()` |
| Fake test providers    | `packages/test-support/src/providers/` — fake LLM, fake Suno, 10 scenarios                      |
| Pipeline deps          | `packages/core/src/pipeline/types.ts` — `PipelineDeps` (no `suno` field)                        |
| E2E tests              | `e2e/` — Playwright, including idempotency tests in `e2e/idempotency.spec.ts`                   |
| Playwright config      | `playwright.config.ts` — base URL `http://localhost:5173`                                       |

## Architecture

Npm workspaces: `apps/{server,web}` and `packages/{contracts,core,genre-core,genre-edm,genre-hiphop,genre-ambient,test-support}`. TypeScript project references wire the build order (`tsconfig.json`); `packages/contracts` and `packages/genre-core` sit at the bottom, `apps/server` depends on `core` + genre packages, `apps/web` depends only on `contracts` + `genre-core`.

**Pipeline** (`packages/core/src/pipeline/orchestrator.ts`): three stages only — `compilation` (deterministic, no LLM) → `lyrics_writing` (the _only_ stage that calls the LLM, skipped when `lyricsMode === "strict_instrumental"`) → `versioning` (persists artifacts, sets `job.currentStage = "completed"`, single `createVersion` with MAX+1 numbering in `job-service.ts`). After versioning, `ComposeShell` (web) triggers a take via `POST /api/versions/:id/takes`, which submits to Suno and streams render status back over SSE. The pipeline itself never calls Suno — `PipelineDeps` deliberately excludes a `suno` field.

**Genre config is data, not code**: `config/genres/<id>.yaml` holds presets, descriptor vocabulary/weights, arrangement defaults, and vocal presets, served via `GET /api/genres`, `/api/genres/:id/descriptor-defaults`, `/api/genres/:id/presets`, `/api/genres/:id/tag-categories`. TypeScript genre modules are reduced to `createGenreModule({ id, name, inputSchema, defaults })` — schema/runtime behavior only, never vocabulary. Every YAML change needs `node scripts/validate-genres.mjs` to pass (checks duplicate IDs, dangling descriptor-category refs, BPM ranges 40–220, descriptor weights 1–3, vocal/lyrics-mode coherence).

**Web session** (`apps/web/src/lib/session.tsx`): `SessionProvider`/`useSession()` is the single source of UI state (genre/preset, tags, sections, lyricsMode, forge progress, takes, jobId). `ComposeShell.tsx` owns SSE subscriptions and maps pipeline events to forge-strip state (`compilation started` → stage 0, `lyrics_writing started` → stage 1, `versioning started` → stage 2, `suno_render started` → stage 3, `suno_render_complete`/`suno_render_error` → stage 4 / clear). Autosave debounces `updateJobInputs()` by 800ms, only once `jobId` exists. Panels: `SetupColumn` (genre/preset/descriptors), `BundleCanvas` (title/style/arrangement), `RendersPanel` (takes/waveforms), `LibraryPanel` (session archive).

**Idempotency**: every pipeline stage persists to `stageData` in the `jobs` table. `POST /api/jobs/:id/start` runs `runPipeline()`, writing after each stage; `GET /api/jobs/:id/events/history` replays persisted events by sequence number so a closed browser can recover mid-forge from the Library. `POST /api/jobs/:id/cancel` works on pending and in-progress jobs. See `e2e/idempotency.spec.ts`.

**Suno integration** (`packages/core/src/suno/client.ts`): single adapter for submit/poll/callback. Webhook at `POST /api/suno/callback`; polling via `/api/v1/generate/record-info`; `suno_render`/`suno_render_complete`/`suno_render_error` are synthetic SSE stage labels (in `STAGE_LABELS`, not in `STAGE_ORDER`/`GenerationStage`) — don't confuse them with real pipeline stages. Never call live Suno in dev/tests; `SUNO_DRY_RUN=true` skips it. A live smoke test requires `TRACK_FORGE_LIVE_SUNO=1` plus explicit user confirmation.

## Stable invariants

- Only `compilation → lyrics_writing → versioning` may be extended. Do not resurrect `critic-runner`, `reference-interpreter`, `prompt-assembler`, `lyrics-patcher`, or old stage names (`ref_interpretation`, `planning`, `style_writing`, `review`, `revision`, `verification`). `node scripts/check-architecture.mjs` enforces this via forbidden-symbol/file scanning — run it after touching pipeline or genre code.
- `PipelineDeps` does **not** include `suno` — the pipeline never calls Suno directly.
- `job.currentStage !== "completed"` is the "still running" check (versioning sets `"completed"`, not `"versioning"`).
- Stage errors use `failStage()`, which retries up to 3 times before failing the job.
- Genre content belongs in YAML unless it is schema or runtime behavior (`GenreModule.inputSchema`/`defaults`).
- The browser never receives provider credentials (LLM or Suno).
- No live provider calls in tests — use fakes from `packages/test-support/src/providers/` (10 scenarios: instrumental/vocal/ambient success, llm-timeout, llm-malformed, suno-submit-fails, suno-pending-then-{complete,failed}, suno-callback-before-poll, job-cancelled). Fake `submit()` returns `{ taskId: string }`, matching the real `SunoClient` contract.
- A UI state transition driven by a server event needs a browser (Playwright) test, not just a component unit test.
- Every external-provider contract change needs a fixture update (`packages/test-support/src/providers/fake-suno-server.ts`) plus a contract test.
- Web imports `SectionFunction`, `Vocal`, `DescriptorCategory`, `DescriptorWeight`, `LyricsMode` from `@track-forge/contracts`/`@track-forge/genre-core` — never redefine these locally.
- Database-destructive actions require explicit user approval first.

## Config

`track-forge.config.js` (project root) with env-var overrides (`TRACK_FORGE_DB_PATH`, `TRACK_FORGE_LLM_API_KEY`, etc.). Default DB path is `./data/track-forge.db` (relative to CWD).

## Code discovery

Prefer `rg`/`fd` for exact symbols, strings, filenames, and local edits. If CodeGraph MCP tools are available, use them for cross-file behavior, call-graph, reachability, and impact analysis — but confirm any dead-code conclusion with `rg` before deleting anything, since CodeGraph freshness isn't guaranteed.
