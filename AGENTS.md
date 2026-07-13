# Track Forge — AGENTS.md

## Quick start

```bash
npm ci                     # install (allowScripts for better-sqlite3 + esbuild)
npm run build               # tsc --build all workspaces (generates .js/.d.ts in src/ + __tests__/)
npm test                    # vitest run (all workspaces — 28 files, 249 tests, ~2s)
npm run -w <workspace> test # single workspace (each has its own vitest run)
npx vitest run --project '@track-forge/core'  # single package via vitest project name
npm run dev --workspaces --if-present          # start all dev servers
npm run clean               # rm -rf apps/*/dist packages/*/dist
```

**CI** (`.github/workflows/ci.yml`): two separate jobs — `check` (tsc --build + vitest + prettier --check) then `lint` (tsc --noEmit). Run both locally: `npm run build && npm test && npx prettier --check . && npx tsc --noEmit`.

**Local apps**: `npm run -w apps/server dev` starts Fastify on `127.0.0.1:3000`; `npm run -w apps/web dev` starts Vite on `127.0.0.1:5173` and proxies `/api` to the server.

**Full stack**: start both in separate terminals, or root `npm run dev --workspaces --if-present`.

**Build artifacts**: `tsc --build` writes `.js`/`.d.ts`/`.js.map`/`.d.ts.map` alongside source files in `src/` and `__tests__/`. These are gitignored (`__tests__/*.js`, `__tests__/*.d.ts`). Vitest runs `.ts` files only — `.js` artifacts in `src/` can be deleted before rebuild if stale.

## Workspaces

| Path | Package | Purpose |
|------|---------|---------|
| `apps/server` | `@track-forge/server` | Fastify API server (port 3000). Entry: `src/index.ts` |
| `apps/web` | `@track-forge/web` | Preact SPA (Vite, port 5173). Proxies `/api` → `localhost:3000` |
| `packages/contracts` | `@track-forge/contracts` | Shared Zod schemas, types, branded IDs. Lowest dep — no runtime deps |
| `packages/core` | `@track-forge/core` | Pipeline engine, DB (SQLite+drizzle-orm), LLM/Suno clients, orchestration |
| `packages/genre-core` | `@track-forge/genre-core` | `GenreModule` interface + sub-types. Zero runtime deps |
| `packages/genre-edm` | `@track-forge/genre-edm` | EDM genre module: schema, renderers, validators, presets, prompts |
| `packages/genre-hiphop` | `@track-forge/genre-hiphop` | Hip-Hop genre module |
| `packages/test-support` | `@track-forge/test-support` | Shared test helpers, mock factories |

Genre packages have `ui/` sub-packages (`packages/genre-*/ui/src/index.ts`) that export `VERSION` only — stubs, not wired into anything.

## Architecture

**Pipeline stages** (sequential, in `packages/core/src/pipeline/orchestrator.ts`):
```
ref_interpretation → planning → style_writing → compilation → review → revision → verification → versioning
```

Each stage handler lives in `orchestrator.ts`. State is built up on `PipelineState` and persisted via `StageData` in the `stageData` JSON column of the jobs table.
If you touch pipeline, review, revision, or Suno payload logic, start in `packages/core/src/pipeline/orchestrator.ts` and `packages/core/src/suno/*`.

**Server routes** live in `apps/server/src/routes/*`. Core areas are health, projects, jobs, versions, Suno, SSE events, and import/export.

**Genre modules** implement `GenreModule` from `@track-forge/genre-core`:
- `inputSchema` / `blueprintSchema` — Zod validation for user-facing inputs and internal blueprint
- `compileBlueprint(inputs) → TBlueprintData` — transforms user inputs to full blueprint (must provide `arrangement`, `styleClauses`, `tags`, etc.)
- `renderers` — produce Suno artifacts from compiled blueprint
- `critics` — LLM-based review definitions
- `validators` — input + blueprint validation
- `promptFragments` — LLM prompt templates per stage
- `presets` — named preset configurations

**Config** (`track-forge.config.js`, gitignored): Env vars override (`TRACK_FORGE_LLM_API_KEY`, `TRACK_FORGE_SUNO_AUTH_TOKEN`, `TRACK_FORGE_DB_PATH`, `TRACK_FORGE_HOST`, `TRACK_FORGE_PORT`, `TRACK_FORGE_STATIC_DIR`, etc.). LLM provider: `openai` | `anthropic` | `ollama` | `openai-compatible`. Custom base URL via `llmBaseUrl` / `TRACK_FORGE_LLM_BASE_URL`. Fetch timeout: 180s per call.

**DB**: SQLite via better-sqlite3. Schema in `packages/core/src/db/schema.ts`. Tables: projects, projectDrafts, jobs, versions, generations, sunoTracks, jobEvents, artifactLocks, criticFindings, adjustments, jobStageOutputs. User-facing migrations use drizzle-orm.

## LLM model behavior (hard-earned)

The app's LLM client talks to an OpenAI-compatible endpoint (`TRACK_FORGE_LLM_BASE_URL`). Currently configured to use OpenCode API with `kimi-k2.5`.

**Available models** (tested via openai-compatible provider):
- `kimi-k2.5` — **recommended**. ~13s/call, no hidden reasoning, content in `message.content`. Best speed/quality.
- `deepseek-v4-flash` — reasoning model. 80-92% of tokens go to hidden `reasoning_content`. Empty content unless `max_tokens` > 4096. 20-30s/call.
- `qwen3.7-plus` — very slow (>30s even for trivial prompts). Not recommended.
- `minimax-m3` — fast (~11s) but less tested.

**Reasoning overhead problem**: DeepSeek and some others consume most of the `max_tokens` budget on internal thinking. The visible `content` comes back empty when the budget is too small. This is NOT a prompt quality issue — the model needs more tokens.

**Measured pipeline timing** (Kimi k2.5):
- Planning: ~30s
- Style+Lyrics (parallel): ~30s
- Review: ~15s
- Compilation→Version: <1s
- **Total: ~76s** (vs 150s with DeepSeek)

**Per-stage max_tokens** (tuned for kimi-k2.5):
- Planning: 2048
- Style: 4096
- Lyrics: 2048
- Default (client.ts): 2048

If switching to DeepSeek, bump all to 8192 minimum.

## Debugging

**LLM debug**: `TRACK_FORGE_LOG_LEVEL=debug` prints every LLM request (prompt, content, reasoning_content, token usage) in server logs.

**Suno**: External audio generation API. Config via `TRACK_FORGE_SUNO_BASE_URL` + `TRACK_FORGE_SUNO_AUTH_TOKEN`.

**Cancel+abort**: Pipeline abort via `POST /api/jobs/:id/cancel`. Uses in-memory `AbortController` map (`job-abort-controller.ts`). LLM fetches combine pipeline+timeout signals via `combineSignals()` helper — returns `{ signal, cleanup }`; cleanup called in `finally` to prevent listener leaks.

## Testing

- Vitest project mode: root config runs `packages/*` + `apps/*` as separate projects
- Server tests use Fastify `server.inject()` (no real sockets). Temp SQLite DBs per test.
- Web tests are smoke-only (no DOM). No Playwright/Cypress in repo.
- To add a test to a package: create `__tests__/*.test.ts` in that workspace.
- Genre modules have renderers + validators tests in-genre.

## Conventions

- **No comments in production code** — state intent through naming, not prose
- **No emoji icons** — use Phosphor (`@phosphor-icons/react`) SVG icons
- **CSS**: custom properties/design tokens in `style.css`. No Tailwind. Dark theme (#0F0F23 bg, #F8FAFC text, #22C55E accent). Inter font.
- **No zustand/redux** — plain `useState` + `useEffect` in Preact
- **API responses**: DELETE returns 204 (no body). Other endpoints return JSON.
- **Zod branded IDs**: `JobId`, `VersionId`, etc. Cast with `as any` at DB boundaries
- **Pipeline errors**: LLM timeouts vs user cancellations distinguished via error message checks in the catch block

## Common gotchas

- **`compiledJson` on job row can be stale**. Always read from `stageData` (the `stageData` JSON column) for the latest compiled output. The verification critics and review context must parse from `stageData`, not the raw `compiledJson` column.
- **EDM must have `compileBlueprint`** — raw user inputs don't include `arrangement` or `styleClauses` that the renderer needs. The `compileBlueprint()` function builds these from inputs.
- **EDM must have a `planning` prompt fragment** — if missing, the fallback template produces generic/non-EDM song plans.
- **EDM style prompt must include JSON schema** — without it, the LLM returns free-form text which `tryParseStyleResult` can't parse, resulting in empty `titleCandidates` and null `bpm`/`key`.
- **Critic `{{style}}` `{{title}}` `{{lyrics}}` placeholders need injection** — `handleReview` and `handleVerification` must parse `compiledJson` and set these individually on the context, otherwise critics see empty strings. `handleVerification` was missing this injection until recently — check that stage if critics report empty fields.
- **`artifacts` is a JSON string in DB** — the API returns it as a string. The frontend `VersionInfo` interface expects it parsed. Any new version endpoint needs to parse it via `parseVersion()`.
- **`lyricsMode === "strict_instrumental"` skips the lyrics LLM call entirely** — handled in `handleWriting`. Don't touch if it works.
- **`handleVerification` re-runs critics on patched content**. If critics complain about "empty style", check that `compiledJson` in context is from `stageData`, not the stale job column.
- **Pause-after-revision** sets `currentStage = "review"` on the job so the review endpoint (`POST /api/jobs/:id/review`) can accept it. The review endpoint checks `currentStage === "review"`.
- **Findings parse** in pipeline init wraps `JSON.parse(job.findings)` in try/catch — if the stored JSON is malformed, it gracefully defaults to `null` instead of crashing the pipeline.
- **Prompt injection protection**: `buildPromptContext` in `prompt-assembler.ts` spreads `...inputs` **before** reserved fields (`genreId`, `genreName`, `presetId`, `reference`, etc.) so user inputs cannot override them.
- **Project delete cascade** (`projects.ts`) must delete in FK order: sunoTracks → generations → artifactLocks → versions → jobStageOutputs → jobEvents → criticFindings → adjustments → jobs. Missing any orphans rows.
- **`combineSignals()`** returns `{ signal, cleanup }` — always call `cleanup()` in the `finally` block to remove abort listeners. Without it, every LLM call leaks listener closures.
- **`JSON.parse` in DB boundary callbacks (`findings`, `artifacts`, `nlAdjustments`)** can throw on corrupted data. New pipeline init wraps findings parse in try/catch; replicate that pattern for any new JSON-column reads.
- **Build artifacts (`.js`, `.d.ts`) in `__tests__/` are gitignored** — if `tsc --build` creates duplicate test files, delete them and rerun `npm test` to verify the count (249, not 498).
- **No prettier config file** — prettier uses defaults. `npx prettier --check .` at root.
- **genre-core/ui was deleted** (orphaned, no workspace registration). genre-edm/ui and genre-hiphop/ui exist as VERSION-only stubs.
