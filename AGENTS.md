# Track Forge — AGENTS.md

## Quick start

```bash
npm ci                     # install (allowScripts for better-sqlite3 + esbuild)
npm run build               # tsc --build + vite build all workspaces
npm test                    # vitest run (all workspaces — 249+ tests, ~2s)
npm run -w <workspace> test # single workspace
npx vitest run --project '@track-forge/core'  # single package via vitest project name
npm run -w apps/web dev     # Vite on :5173, proxies /api → :3000
npm run -w apps/server dev  # Fastify on :3000
npm run clean               # rm -rf apps/*/dist packages/*/dist
```

**CI** (`.github/workflows/ci.yml`): two jobs — `check` (tsc --build + vitest + prettier) then `lint` (tsc --noEmit). Run both locally: `npm run build && npm test && npx prettier --check . && npx tsc --noEmit`.

**Build artifacts**: `tsc --build` emits `.js`/`.d.ts`/`.js.map`/`.d.ts.map` beside source files. These are gitignored. Vitest runs `.ts` only — stale `.js` in `src/` can cause build confusion; delete and rebuild if weird errors appear.

## Workspaces

| Path                     | Package                      | Purpose                                                               |
| ------------------------ | ---------------------------- | --------------------------------------------------------------------- |
| `apps/server`            | `@track-forge/server`        | Fastify API server. Entry: `src/index.ts`                             |
| `apps/web`               | `@track-forge/web`           | Preact SPA (Vite). 4-views: Library, Create, Forge, Studio            |
| `packages/contracts`     | `@track-forge/contracts`     | Shared Zod schemas, branded IDs (`JobId`, `VersionId`, etc.), types   |
| `packages/core`          | `@track-forge/core`          | Pipeline engine, DB (SQLite+drizzle), LLM/Suno clients, orchestration |
| `packages/genre-core`    | `@track-forge/genre-core`    | `GenreModule` interface + `TagCategory` type                          |
| `packages/genre-edm`     | `@track-forge/genre-edm`     | EDM genre module                                                      |
| `packages/genre-hiphop`  | `@track-forge/genre-hiphop`  | Hip-Hop genre module                                                  |
| `packages/genre-pop`     | `@track-forge/genre-pop`     | Pop genre module (3 presets)                                          |
| `packages/genre-ambient` | `@track-forge/genre-ambient` | Ambient genre module (2 presets)                                      |
| `packages/genre-dnb`     | `@track-forge/genre-dnb`     | Drum & Bass genre module (2 presets)                                  |
| `packages/test-support`  | `@track-forge/test-support`  | Shared test helpers                                                   |

## Frontend architecture

**4-view hash router** (`apps/web/src/lib/router.tsx`): custom hash-based router with `Router`/`Route`/`Link`/`useRouter`. Route component passes `{ params }` extracted via `match()`. Nav to `/forge/:id` or `/studio/:id` requires a job ID — without it the route won't match and viewport stays blank.

**Session context** (`apps/web/src/lib/session.tsx`): `SessionProvider` wrapping the app provides `{ jobId, name, genreId, bpm, key, status, onForge, forgeLabel }` to all views. TransportBar reads this for live breadcrumb/status/button. Views write into it via `useSession().setSession()`.

**AppShell** (`apps/web/src/components/AppShell.tsx`): composes NavRail + TransportBar + viewport. Route dispatch inside viewport renders one of 4 views.

**CSS design tokens** (`apps/web/src/style.css`, ~2000 lines): current theme is light (`--bg: #FFF1E5`, `--panel: #FFFFFF`). Colors use short aliases — `--acc` (accent green `#3DDC84`), `--tx` (text `#2D2A24`), `--dim` (muted), `--faint` (muted), `--line2` (secondary border). Both short and long names are defined in `:root`.

**Views**:

- **Library** (`/`): fetches `fetchJobs(100)` + `fetchGenres()`. Cards show genre badge, status badge, waveform, star/favorite, delete. Click → Studio (completed) or Forge (in_progress).
- **Create** (`/create`): genre selection, presets from `GET /api/genres/:id/presets`, arrangement from `compileBlueprint()`, Style Console with tag categories from `GET /api/genres/:id/tag-categories`. Panels are accordion-foldable; Style Console and compiled prompt stay visible. Key select splits `"C maj"` → `["C","maj"]` and must map `"maj"`→`"major"`, `"min"`→`"minor"`.
- **Forge** (`/forge/:id`): fetches job, connects SSE via `connectJobEvents(id, handlers)`. 8-stage assembly line. Actions depend on job status.
- **Studio** (`/studio/:id`): fetches job + versions + generations (takes). Style + lyric artifacts parsed from version artifacts JSON. Play/pause simulated via `setInterval`.

## Genre config (static data)

Genre presets, tag categories, defaults, tag policies, and adjustment vocabularies live in `config/genres/*.yaml` — version-controlled, no DB required. The server loads them at startup via `apps/server/src/lib/genre-config.ts` and serves them through:

- `GET /api/genres` — includes `color` and `subgenre_count`
- `GET /api/genres/:id/presets` — presets with values
- `GET /api/genres/:id/tag-categories` — category definitions with suggestions

The executable parts (renderers, critics, validators, `compileBlueprint()`, `promptFragments`) remain TypeScript code in `packages/genre-*`.


## Backend architecture

**Server routes** (`apps/server/src/routes/*`): jobs, versions, projects, health, suno, events, import-export.

**Pipeline stages** (`packages/core/src/pipeline/orchestrator.ts`):

```
ref_interpretation → planning → style_writing → compilation → review → revision → verification → versioning
```

Stage state on `PipelineState`, persisted as JSON in `job.stageData`.

**SSE**: `GET /api/jobs/:id/events` streams `{ jobId, stage, status, message?, tag?, elapsedMs?, error?, timestamp }`. History replay on reconnect.

**DB**: SQLite via better-sqlite3 + drizzle-orm. Schema in `packages/core/src/db/schema.ts`. Tables: projects, projectDrafts, jobs, versions, generations, sunoTracks, jobEvents, criticFindings, adjustments, artifactLocks, jobStageOutputs. Auto-created by `createDb()` with `CREATE TABLE IF NOT EXISTS` + migration `ALTER TABLE` blocks for new columns.

**Config**: `TRACK_FORGE_*` env vars or `track-forge.config.js`. Default DB path: `./data/track-forge.db`. LLM supports `openai`/`anthropic`/`ollama`/`openai-compatible`.

## Genre modules

Implement `GenreModule<TInputs, TBlueprintData>` from `@track-forge/genre-core`:

- `inputSchema` / `blueprintSchema` — Zod schemas
- `compileBlueprint(inputs, options?)` — builds arrangement, styleClauses, tags. Optional `arrangementOverride?: { section, bars }[]`
- `renderers` — `title`, `style`, `excludedStyles`, `lyrics`
- `promptFragments` — keyed by stage, including `style_tag_suggestions`
- `tagCategories: TagCategory[]` — colored category groups with suggestions for Style Console
- `tagPolicy` — `mandatoryTags`, `forbiddenTags`, `canonicalMap`
- All genres must include `lyricsMode` in inputSchema and handle it in renderers (strict_instrumental, guided_instrumental, full_lyrics)

## LLM behavior

Kimi k2.5 recommended (~13s/call). DeepSeek v4 flash uses 80-92% tokens on hidden `reasoning_content` — need `max_tokens` ≥ 8192 to see visible output. Per-stage max_tokens tuned for kimi: planning 2048, style 4096, lyrics 2048.

## Common gotchas

- **`compiledJson` on job row is stale** — always read from `stageData` JSON column for latest compiled output.
- **Critic placeholders need injection** — `handleReview`/`handleVerification` must parse `compiledJson` and set `{{style}}`, `{{title}}`, `{{lyrics}}` individually on context, otherwise critics see empty strings.
- **`artifacts` is JSON string in DB** — API returns as string. Frontend `VersionInfo` interface expects parsed. New version endpoints must call `parseVersion()`.
- **`lyricsMode === "strict_instrumental"` skips LLM lyrics call** — handled in `handleWriting`.
- **Pause-after-revision** sets `currentStage = "review"` so review endpoint (`POST /api/jobs/:id/review`) can pick it up. Review endpoint checks `currentStage === "review"`.
- **Project delete cascade** must delete in FK order: sunoTracks → generations → artifactLocks → versions → jobStageOutputs → jobEvents → criticFindings → adjustments → jobs.
- **`combineSignals()` returns `{ signal, cleanup }`** — always call `cleanup()` in `finally` to prevent listener leaks.
- **Prompt injection protection**: `buildPromptContext` spreads `...inputs` **before** reserved fields so user inputs cannot override `genreId`, `presetId`, etc.
- **`findings` parse** wraps `JSON.parse` in try/catch — replicate for any new JSON-column reads.
- **Build artifacts in `__tests__/`** are gitignored — if `tsc --build` creates duplicate `.js` test files, delete them and rerun `npm test`.
- **No prettier config** — uses defaults. `npx prettier --check .` at root.
- **CSS variables `--acc`, `--tx`, `--dim`, `--faint`, `--line2`** are aliases for the long names — both defined. If adding a new CSS property reference, use these short aliases (they match the mockup conventions).
- **Hash router requires exact segment counts** — `/forge` won't match `/forge/:id`. NavRail uses `session.jobId` to build correct routes. Without a job ID, RUN/MIX buttons are disabled.
- **Server needs `data/` directory** — DB default path is `./data/track-forge.db`. The directory must exist or `createDb()` throws.
- **Key select stores abbreviated scale** — `<option value="C maj">` splits to `["C","maj"]`. `handleKeyChange` must map `"maj"` → `"major"` and `"min"` → `"minor"` before storing in `inputs.scale`. Genre Zod schemas use `z.enum(["major", "minor"])` — `safeParse` rejects `"maj"`/`"min"`, causing silent job creation failures.
