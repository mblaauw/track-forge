# Track Forge — AGENTS.md

## Quick start

```bash
npm ci                     # install (allowScripts for better-sqlite3 + esbuild)
npm run build               # tsc --build + vite build all workspaces
npm test                    # vitest run (all workspace projects)
npm run -w <workspace> test # single workspace
npx vitest run --project '@track-forge/core'  # single package via vitest project name
npm run -w apps/server dev  # Fastify dev server on :3000
npm run -w apps/web dev     # Vite dev on :5173, proxies /api → :3000
npm run -w apps/server cli:dev export <jobId>  # CLI (tsx, no build needed)
npm run clean               # rm -rf apps/*/dist packages/*/dist
```

**CLI**: Server ships `track-forge export <jobId>` / `export-all` / `import <file>`. Use `cli:dev` for dev, or `npm run -w apps/server cli <command>` after build.

**CI** (`.github/workflows/ci.yml`): two parallel jobs — `check` (tsc --build + vitest + prettier) then `lint` (tsc --noEmit). Local equivalent: `npm run build && npm test && npx prettier --check . && npx tsc --noEmit`.

**Build artifacts**: `tsc --build` emits `.js`/`.d.ts`/`.js.map`/`.d.ts.map` beside sources (gitignored). Vitest runs `.ts` only — stale `.js` in `src/` can confuse the compiler. If weird errors appear, run `npm run clean && npm run build`.

## Config

`track-forge.config.js` (gitignored) overridden by `TRACK_FORGE_*` env vars. Default DB: `./data/track-forge.db` (directory must exist). LLM: `openai`/`anthropic`/`ollama`/`openai-compatible`. Full env list in `packages/core/src/config.ts:20-24`.

## Workspaces

| Path                    | Package                     | Purpose                                                               |
| ----------------------- | --------------------------- | --------------------------------------------------------------------- |
| `apps/server`           | `@track-forge/server`       | Fastify API server. Entry: `src/index.ts`. CLI: `src/cli.ts`          |
| `apps/web`              | `@track-forge/web`          | Preact SPA (Vite). 4 views: Library, Create, Forge, Studio            |
| `packages/contracts`    | `@track-forge/contracts`    | Shared Zod schemas, branded IDs, types                                |
| `packages/core`         | `@track-forge/core`         | Pipeline engine, DB (SQLite+drizzle), LLM/Suno clients, orchestration |
| `packages/genre-core`   | `@track-forge/genre-core`   | `GenreModule` interface + `TagCategory` type + shared builders        |
| `packages/genre-*`      | `@track-forge/genre-*`      | Genre modules: edm, hiphop, pop, ambient, dnb                         |
| `packages/test-support` | `@track-forge/test-support` | Shared test helpers                                                   |

## Backend architecture

**Routes** (`apps/server/src/routes/*`): jobs, versions, projects, health, suno, events, import-export. Routed via route-type name on `server.get/post/patch/delete`.

**Pipeline stages** (`packages/core/src/pipeline/orchestrator.ts`):

```
ref_interpretation → planning → style_writing → compilation → review → revision → verification → versioning
```

Stage state persisted as JSON in `job.stageData`. **`compiledJson` on job row is stale** — read `stageData` JSON column instead.

**SSE**: `GET /api/jobs/:id/events` streams `{ jobId, stage, status, message?, tag?, elapsedMs?, error?, timestamp }`. History replay on reconnect.

**DB**: SQLite via better-sqlite3 + drizzle-orm. Schema in `packages/core/src/db/schema.ts`. Auto-created by `createDb()` with `CREATE TABLE IF NOT EXISTS` + migration `ALTER TABLE` blocks for new columns.

## Frontend architecture

**Hash router** (`apps/web/src/lib/router.tsx`): custom `Router`/`Route`/`Link`/`useRouter` over `hashchange`. Routes match exact segment count — `/forge` won't match `/forge/:id`. NavRail uses `session.jobId` to build correct routes.

**Session context** (`apps/web/src/lib/session.tsx`): `SessionProvider` exposes `{ jobId, name, genreId, bpm, key, status, onForge, forgeLabel, forgeDisabled }`. Views write via `setSession()`.

**CSS design tokens** (`apps/web/src/style.css`): light theme (`--bg: #FFF1E5`, `--panel: #FFFFFF`). Short aliases `--acc` (accent green `#3DDC84`), `--tx` (text `#2D2A24`), `--dim`, `--faint`, `--line2`. Both short and long names defined in `:root`.

**Views**:

- **Library** (`/`): `fetchJobs(100)` + `fetchGenres()`. Click → Studio (completed) or Forge (in_progress).
- **Create** (`/create`): genre selection → presets from `GET /api/genres/:id/presets` → arrangement from `compileBlueprint()` → Style Console with tag categories. Key select splits `"C maj"` → must map `"maj"`→`"major"`, `"min"`→`"minor"`.
- **Forge** (`/forge/:id`): SSE via `connectJobEvents(id, handlers)`. 8-stage assembly line.
- **Studio** (`/studio/:id`): versions + generations (takes). Artifacts parsed from JSON string.

## Genre config (static data)

Presets, tag categories, song structures, taxonomy live in `config/genres/*.yaml` — no DB. The TS genre modules carry minimal fallback arrays; YAML files are the canonical source. Server injects them at startup via `apps/server/src/lib/modules.ts` → `augment()`.

Served through:

- `GET /api/genres` — `color`, `subgenre_count`
- `GET /api/genres/:id/presets` — presets with values
- `GET /api/genres/:id/tag-categories` — category definitions

Executable parts (renderers, critics, validators, `compileBlueprint()`, `promptFragments`) remain TypeScript in `packages/genre-*`.

## Genre modules

Implement `GenreModule<TInputs, TBlueprintData>` from `@track-forge/genre-core`:

- `inputSchema`/`blueprintSchema` — Zod schemas
- `compileBlueprint(inputs, options?)` — arrangement, styleClauses, tags
- `renderers` — `title`, `style`, `excludedStyles`, `lyrics`
- `promptFragments` — keyed by stage
- `tagCategories`, `tagPolicy` — `mandatoryTags`, `forbiddenTags`, `canonicalMap`
- All genres must include `lyricsMode` in inputSchema (`strict_instrumental`, `guided_instrumental`, `full_lyrics`)

## LLM behavior

Kimi k2.5 recommended (~13s/call). DeepSeek v4 flash uses 80-92% tokens on hidden `reasoning_content` — need `max_tokens` ≥ 8192 to see visible output. Per-stage max_tokens tuned for kimi: planning 2048, style 4096, lyrics 2048.

## Common gotchas

- **`compiledJson` on job row is stale** — always read from `stageData` JSON column for latest compiled output.
- **Critic placeholders need injection** — `handleReview`/`handleVerification` must parse `compiledJson` and set `{{style}}`, `{{title}}`, `{{lyrics}}` individually on context, otherwise critics see empty strings.
- **`artifacts` is JSON string in DB** — API returns as string. Frontend `VersionInfo` interface expects parsed. New version endpoints must call `parseVersion()`.
- **`lyricsMode === "strict_instrumental"` skips LLM lyrics call** — handled in `handleWriting`.
- **Pause-after-revision** sets `currentStage = "review"` so review endpoint (`POST /api/jobs/:id/review`) can pick it up.
- **Project delete cascade** must delete in FK order: sunoTracks → generations → artifactLocks → versions → jobStageOutputs → jobEvents → criticFindings → adjustments → jobs.
- **`combineSignals()` returns `{ signal, cleanup }`** — always call `cleanup()` in `finally` to prevent listener leaks.
- **Prompt injection protection**: `buildPromptContext` spreads `...inputs` **before** reserved fields so user inputs cannot override `genreId`, `presetId`, etc.
- **`findings` parse** wraps `JSON.parse` in try/catch — replicate for any new JSON-column reads.
- **Build artifacts in `__tests__/`** are gitignored — if `tsc --build` creates duplicate `.js` test files, delete them and rerun `npm run clean && npm run build`.
- **No prettier config** — uses defaults. `npx prettier --check .` at root.
- **No opencode.json** — AGENTS.md is the single instruction source. MCP config uses `.opencode/` directory.
- **CSS variables `--acc`, `--tx`, `--dim`, `--faint`, `--line2`** are short aliases for long names — use these when referencing CSS properties (they match mockup conventions).
- **Hash router requires exact segment counts** — `/forge` won't match `/forge/:id`. Without a job ID, RUN/MIX buttons are disabled.
- **Server needs `data/` directory** — DB default path is `./data/track-forge.db`. The directory must exist or `createDb()` throws.
- **Key select stores abbreviated scale** — `<option value="C maj">` splits to `["C","maj"]`. `handleKeyChange` must map `"maj"`→`"major"` and `"min"`→`"minor"` before storing in `inputs.scale`. Genre Zod schemas use `z.enum(["major", "minor"])` — `safeParse` rejects `"maj"`/`"min"`, causing silent job creation failures.
