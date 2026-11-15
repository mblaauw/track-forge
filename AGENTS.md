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

| Concern                | Location                                                                                            |
| ---------------------- | --------------------------------------------------------------------------------------------------- |
| Pipeline stages        | `packages/core/src/pipeline/orchestrator.ts` — `compilation → lyrics_writing → versioning`          |
| Genre vocabulary       | `config/genres/<id>.yaml` (presets, descriptors, structure, palette)                                |
| Shared API types       | `packages/contracts/src/index.ts`                                                                   |
| Genre module types     | `packages/genre-core/src/index.ts` — `SectionFunction`, `Vocal`, `DescriptorCategory`               |
| DB schema              | `packages/core/src/db/schema.ts`                                                                    |
| Web session            | `apps/web/src/lib/session.tsx` — `SessionProvider` + `useSession()`                                 |
| Web forge flow         | `apps/web/src/lib/forge.ts` — `useForge()` (save, start, SSE, take, autosave)                       |
| Web UI + design system | `apps/web/src/components/studio/` (zones, `ui.tsx` primitives) and `apps/web/src/style.css` tokens  |
| Suno provider contract | `packages/core/src/suno/client.ts` — `submit()`, `getGenerationStatus()`                            |
| Suno adapter           | `packages/core/src/suno/adapter.ts` — `SunoAdapter` interface + default instance                    |
| Suno v6 contract       | `packages/contracts/src/index.ts` — `SUNO_MODELS`, `SUNO_LIMITS`, `SunoRenderSettingsSchema`        |
| Take-time derivations  | `packages/core/src/suno/render-hints.ts` — `deriveRenderHints()`, `summarizeVocals()`               |
| Pipeline deps          | `packages/core/src/pipeline/types.ts` — `PipelineDeps` (no `suno` field)                            |
| Pipeline state         | `packages/core/src/pipeline/types.ts` — `PipelineState` (resolved, intentRevisionId, compilationId) |
| Fake test providers    | `packages/test-support/src/providers/` — 10 scenarios                                               |
| Song intent contract   | `packages/song-intent/src/types.ts` — `SongIntentV1`, `ResolvedSongIntent`, `StyleInfluence`        |
| Song intent schema     | `packages/song-intent/src/schema.ts` — `SongIntentV1Schema` (`.strict()`)                           |
| Legacy job → intent    | `packages/song-intent/src/migrate-legacy.ts` — `migrateLegacyJob()`                                 |
| Intent materializer    | `packages/song-intent/src/materialize.ts` — `materializeIntent()`, `flattenIntentToInputs()`        |
| Intent resolver        | `packages/song-intent/src/resolve.ts` — `resolveSongIntent()` (4 derivation rules)                  |
| Intent revision        | `packages/core/src/intent-revisions/index.ts` — `freezeIntentRevision()`, `createCompilation()`     |
| Pipeline intent bridge | `packages/core/src/pipeline/intent-bridge.ts` — `resolveIntentFromJob()`, `buildLyricsBrief()`      |
| E2E tests              | `e2e/` — 10 Playwright specs including `idempotency.spec.ts` and `explore-hiphop-trace.spec.ts`     |
| Server entry           | `apps/server/src/index.ts` — Fastify, registers all routes, static GUI serving                      |
| Web entry              | `apps/web/src/main.tsx` — Preact render                                                             |

## Architecture

**Workspaces:** `apps/{server,web}` and `packages/{contracts,core,genre-core,genre-edm,genre-hiphop,genre-ambient,genre-shoegaze,song-intent,test-support}`. Build order via TypeScript project references: `contracts`/`genre-core` at the bottom, `apps/server` depends on `core` + genre packages, `apps/web` depends only on `contracts` + `genre-core`.

**Pipeline** (`packages/core/src/pipeline/orchestrator.ts`): exactly three stages — `compilation` (deterministic, no LLM) → `lyrics_writing` (the _only_ LLM call; skipped when `lyricsMode === "strict_instrumental"`) → `versioning` (persists artifacts, sets `currentStage: "completed"`). Before the stages run, `freezeIntentRevision()` captures an immutable snapshot of the song intent into the `intent_revisions` table. During versioning, `createCompilation()` links the revision to rendered artifacts in the `compilations` table. After versioning, the web UI triggers a take via `POST /api/versions/:id/takes`, which submits to Suno and streams render status over SSE. `PipelineDeps` deliberately excludes a `suno` field — the pipeline never calls Suno.

**Genre config is data, not code:** `config/genres/<id>.yaml` holds presets, descriptor vocab/weights, arrangement defaults, and vocal presets. TypeScript genre modules (`packages/genre-*/src/*.ts`) are reduced to `createGenreModule({ id, name, inputSchema, defaults })` — schema/runtime only. Every YAML change needs `node scripts/validate-genres.mjs` to pass. There is a `config/shared.yaml` for cross-genre shared config.

**Server startup** (`apps/server/src/index.ts`): creates Fastify instance with error handler, validates genre configs on startup, registers 8 route modules, resets stuck `in_progress` jobs after crash. Optionally serves static GUI from `config.staticDir`. Graceful shutdown on SIGTERM/SIGINT.

**Suno integration** (`packages/core/src/suno/client.ts`): single adapter with `submit()` (POST `/api/v1/generate`), `getGenerationStatus()` (GET `/api/v1/generate/record-info`), and `waitForCompletion()` (exponential backoff polling). Webhook callback at `POST /api/suno/callback` on the server. `suno_render`/`suno_render_complete`/`suno_render_error` are synthetic SSE stage labels — not real pipeline stages. Never call live Suno in dev/tests without `SUNO_DRY_RUN=true` or explicit `TRACK_FORGE_LIVE_SUNO=1` approval.

**Suno v6 is the only target.** Suno retired every pre-v6 model on 2026-09-09. The contract lives in `packages/contracts/src/index.ts` (`SUNO_MODELS`, `SUNO_LIMITS`, `SUNO_VARIETY_LEVELS`, `SunoRenderSettingsSchema`, `estimateDurationSec`) and mirrors <https://docs.sunoapi.org/suno-api/generate-music> — change it only against that page.

- Models: `V6` (default, `TRACK_FORGE_SUNO_MODEL`), `V6_WILD`, `V6_MINI`. No older id is accepted anywhere.
- Limits: style 1000, lyrics 5000, negative tags 1000, title 80 characters; duration 10–360 s.
- Lyrics go in the `lyrics` field. The legacy `prompt` field is never sent.
- `duration` is sent on every take (`deriveRenderHints()` → bars × 4 × 60 / BPM, clamped). Without it Suno renders 20 seconds.
- `variety` defaults to 0. At 1+ Suno rewrites the style prompt, which defeats a compiled one.
- Exclusions go in `negativeTags` only. Never write "no X" in the style prompt — v6 can add X.
- The style prompt names the dominant voice (`summarizeVocals()`); the same summary feeds `vocalGender`.
- Instrumental takes carry the real arrangement as a `structure:` note in the style; vocal takes carry it as section tags in the lyrics, never both.
- Per-take settings (model, variety, weirdness, style influence) travel in the `POST /api/versions/:id/takes` body, not in the song intent, so one version can be re-rendered with different settings.

**Re-forging:** a job is a session and can be forged repeatedly. `POST /api/jobs/:id/start` runs any job that is not `in_progress` (409 if it is) as a full fresh run from `compilation`; each run freezes a new intent revision and writes a new version, leaving earlier versions and their takes untouched. `PATCH /api/jobs/:id/inputs` is locked only while a run is in flight, and may carry `genreId`/`presetId` so the job follows a sound switch (inputs are then rebuilt on the new preset). `start` returns `eventCursor`; the web client starts first, then subscribes with `GET /api/jobs/:id/events?after=<cursor>` so it only sees that run's events — subscribing first replays the previous run and triggers a take of the old version.

**Trace/observability:** Pipeline trace is now via pino logger (silent by default, enabled with `TRACE_LOG_LEVEL=debug`), not the old shared-file append.

## Stable invariants

- Only `compilation → lyrics_writing → versioning` may be extended. `node scripts/check-architecture.mjs` enforces forbidden symbols and file names.
- `PipelineDeps` does not include `suno` — the pipeline never calls Suno directly.
- The web client never subscribes to a job's events before its `start` call has succeeded, and always passes the returned `eventCursor`.
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
- `key`/`scale` are optional harmonic hints on `SongIntentV1.musical`, not required by any stage today; presets may still carry them but the validator will warn.
- `freezeIntentRevision()` is called before the pipeline starts; `createCompilation()` during the versioning stage. Both are required for reproducibility.
- `ResolvedSongIntent` flows through all three pipeline stages — the compilation stage enriches it, lyrics_writing reads from it, and versioning persists it.

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
