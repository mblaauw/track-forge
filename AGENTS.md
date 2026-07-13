# Track Forge — AGENTS.md

## Quick start

```bash
npm ci                     # install
npm run build               # tsc --build all workspaces (standalone, not turbo)
npm test                    # vitest run (all workspaces)
npm run -w <workspace> test # single workspace
npx vitest run --project packages/core  # single package via vitest project mode
npm run dev --workspaces --if-present   # start all dev servers
npm run clean               # remove workspace dist/ output
```

**CI** (`.github/workflows/ci.yml`): two jobs — `check` (tsc --build + vitest + prettier --check) then `lint` (tsc --noEmit). Run both locally: `npm run build && npm test && npx prettier --check . && npx tsc --noEmit`.

**Local apps**: `npm run -w apps/server dev` starts Fastify on `127.0.0.1:3000`; `npm run -w apps/web dev` starts Vite on `127.0.0.1:5173` and proxies `/api` to the server.

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

**Config** (`track-forge.config.js`, gitignored): Env vars override (`TRACK_FORGE_LLM_API_KEY`, `TRACK_FORGE_SUNO_AUTH_TOKEN`, `TRACK_FORGE_DB_PATH`, `TRACK_FORGE_HOST`, `TRACK_FORGE_PORT`, `TRACK_FORGE_STATIC_DIR`, etc.). LLM provider: `openai` | `anthropic` | `ollama` | `openai-compatible`. Custom base URL via `llmBaseUrl` / `TRACK_FORGE_LLM_BASE_URL`.

**DB**: SQLite via better-sqlite3. Schema in `packages/core/src/db/schema.ts`. Tables: projects, projectDrafts, jobs, versions, generations, sunoTracks, jobEvents, artifactLocks, criticFindings, adjustments, jobStageOutputs. User-facing migrations use drizzle-orm.

## LLM model behavior (hard-earned)

**Available models** (`openai-compatible` provider via OpenCode API):
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

## Dev workflow

- **Server dev**: `npm run -w apps/server dev` — tsx watch at `localhost:3000`
- **Web dev**: `npm run -w apps/web dev` — Vite at `localhost:5173`, proxied API
- **Full stack**: start both in separate terminals, or root `npm run dev --workspaces --if-present`

**LLM**: OpenAI-compatible endpoint (`TRACK_FORGE_LLM_BASE_URL`). Currently configured to use Kimi k2.5. Fetch timeout: 180s per call. Default max_tokens: 2048.

**Debug mode**: Set `TRACK_FORGE_LOG_LEVEL=debug` to see every LLM request (prompt, content, reasoning_content, token usage) in server logs.

**Suno**: External audio generation API. Config via `TRACK_FORGE_SUNO_BASE_URL` + `TRACK_FORGE_SUNO_AUTH_TOKEN`.

**Cancel+abort**: Pipeline abort via `POST /api/jobs/:id/cancel`. Uses in-memory `AbortController` map (`job-abort-controller.ts`). LLM fetches combine pipeline+timeout signals via `combineSignals()` helper (Node 26 doesn't have `AbortSignal.any` — custom implementation in `client.ts`).

**GUI verification**: repo has no DOM test harness. For UI changes, run browser-based smoke checks against Vite or static server and verify create/job detail flows manually or with Playwright browser tooling.

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
- **Delete cascade**: must delete FK children in order (sunoTracks → generations ↔ artifactLocks ↔ versions → jobStageOutputs → jobEvents → criticFindings → adjustments → jobs)
- **Zod branded IDs**: `JobId`, `VersionId`, etc. Cast with `as any` at DB boundaries
- **Pipeline errors**: LLM timeouts vs user cancellations distinguished via error message checks in the catch block
- **GUI stack**: Preact app in `apps/web/src/*` with plain CSS and internal router; no Tailwind, no Redux, no component library.

## Common gotchas

- **`compiledJson` on job row can be stale**. Always read from `stageData` (the `stageData` JSON column) for the latest compiled output. The verification critics and review context must parse from `stageData`, not the raw `compiledJson` column.
- **EDM must have `compileBlueprint`** — raw user inputs don't include `arrangement` or `styleClauses` that the renderer needs. The `compileBlueprint()` function builds these from inputs.
- **EDM must have a `planning` prompt fragment** — if missing, the fallback template produces generic/non-EDM song plans.
- **EDM style prompt must include JSON schema** — without it, the LLM returns free-form text which `tryParseStyleResult` can't parse, resulting in empty `titleCandidates` and null `bpm`/`key`.
- **Critic `{{style}}` `{{title}}` `{{lyrics}}` placeholders need injection** — the `handleReview` function must parse `compiledJson` and set these individually on the context, otherwise critics see empty strings.
- **`artifacts` is a JSON string in DB** — the API returns it as a string. The frontend `VersionInfo` interface expects it parsed. Any new version endpoint needs to parse it via `parseVersion()`.
- **`lyricsMode === "strict_instrumental"` skips the lyrics LLM call entirely** — handled in `handleWriting`. Don't touch if it works.
- **Verification false positives**: the `handleVerification` function re-runs critics on patched content. If critics complain about "empty style", check that `compiledJson` in context is from `stageData`, not the stale job column.
