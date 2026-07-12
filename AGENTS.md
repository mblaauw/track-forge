# Track Forge — AGENTS.md

## Quick start

```bash
npm ci                     # install
npm run build               # tsc --build all workspaces
npm test                    # vitest run (all workspaces)
npm run -w <workspace> test # single workspace
npx vitest run --project packages/core  # single package via vitest project mode
npm run dev --workspaces --if-present   # start all dev servers
```

**CI** (`.github/workflows/ci.yml`): two jobs — `check` (tsc --build + vitest + prettier --check) then `lint` (tsc --noEmit). Run both locally: `npm run build && npm test && npx prettier --check . && npx tsc --noEmit`.

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

**Genre modules** implement `GenreModule` from `@track-forge/genre-core`:
- `inputSchema` / `blueprintSchema` — Zod validation for user-facing inputs and internal blueprint
- `compileBlueprint(inputs) → TBlueprintData` — transforms user inputs to full blueprint (must provide `arrangement`, `styleClauses`, `tags`, etc.)
- `renderers` — produce Suno artifacts from compiled blueprint
- `critics` — LLM-based review definitions
- `validators` — input + blueprint validation
- `promptFragments` — LLM prompt templates per stage
- `presets` — named preset configurations

**Config** (`track-forge.config.js`, gitignored): Env vars override (`TRACK_FORGE_LLM_API_KEY`, `TRACK_FORGE_SUNO_AUTH_TOKEN`, `TRACK_FORGE_DB_PATH`, etc.). LLM provider: `openai` | `anthropic` | `ollama` | `openai-compatible`. Custom base URL via `llmBaseUrl` / `TRACK_FORGE_LLM_BASE_URL`.

**DB**: SQLite via better-sqlite3. Schema in `packages/core/src/db/schema.ts`. Tables: jobs, versions, generations, sunoTracks, jobEvents, artifactLocks, criticFindings, adjustments, jobStageOutputs. User-facing migrations use drizzle-orm.

## Dev workflow

- **Server dev**: `npm run -w apps/server dev` — tsx watch at `localhost:3000`
- **Web dev**: `npm run -w apps/web dev` — Vite at `localhost:5173`, proxied API
- **Full stack**: start both in separate terminals, or root `npm run dev --workspaces --if-present`

**LLM**: OpenAI-compatible endpoint (`TRACK_FORGE_LLM_BASE_URL`). DeepSeek-v4-flash model consumes reasoning tokens. Default `max_tokens`: 8192. Fetch timeout: 180s per call. If content comes back empty, increase max_tokens — reasoning fills the budget before visible output.

**Suno**: External audio generation API. Config via `TRACK_FORGE_SUNO_BASE_URL` + `TRACK_FORGE_SUNO_AUTH_TOKEN`.

**Cancel+abort**: Pipeline abort via `POST /api/jobs/:id/cancel`. Uses in-memory `AbortController` map (`job-abort-controller.ts`). LLM fetches combine pipeline+timeout signals via `combineSignals()` helper (Node 26 doesn't have `AbortSignal.any`).

## Testing

- Vitest project mode: root config runs `packages/*` + `apps/*` as separate projects
- 249 tests across 28 files. All pass on main.
- Server tests use Fastify `server.inject()` (no real sockets). Temp SQLite DBs per test.
- Web tests are smoke-only (no DOM). No Playwright/Cypress.
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
