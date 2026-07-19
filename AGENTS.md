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

## Code discovery

CodeGraph first (`.codegraph/` index exists at repo root — use `codegraph_explore`). Fall back to `rg` (ripgrep) for content search and `fd` for file search — do **not** use the built-in `grep`/`find` tools.

**CLI**: Server ships `track-forge export <jobId>` / `export-all` / `import <file>`. Use `cli:dev` for dev, or `npm run -w apps/server cli <command>` after build.

**CI** (`.github/workflows/ci.yml`): two parallel jobs — `check` (tsc --build + vitest + prettier) then `lint` (tsc --noEmit). Local equivalent: `npm run build && npm test && npx prettier --check . && npx tsc --noEmit`.

**Build artifacts**: `tsc --build` emits `.js`/`.d.ts`/`.js.map`/`.d.ts.map` beside sources (gitignored). Vitest runs `.ts` only — stale `.js` in `src/` can confuse the compiler. If weird errors appear, run `npm run clean && npm run build`.

## Config

`track-forge.config.js` (gitignored) overridden by `TRACK_FORGE_*` env vars. Default DB: `./data/track-forge.db` (directory must exist). LLM: `openai`/`anthropic`/`ollama`/`openai-compatible`. Full env list in `packages/core/src/config.ts:20-24`.

## Workspaces

| Path                    | Package                     | Purpose                                                                                                      |
| ----------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `apps/server`           | `@track-forge/server`       | Fastify API server. Entry: `src/index.ts`. CLI: `src/cli.ts`                                                 |
| `apps/web`              | `@track-forge/web`          | Preact SPA (Vite). Single-screen Compose workspace with collapsible panels (Setup, Bundle, Renders, Library) |
| `packages/contracts`    | `@track-forge/contracts`    | Shared Zod schemas, branded IDs, types                                                                       |
| `packages/core`         | `@track-forge/core`         | Pipeline engine, DB (SQLite+drizzle), LLM/Suno clients, orchestration                                        |
| `packages/genre-core`   | `@track-forge/genre-core`   | `GenreModule` interface + `TagCategory` type + shared builders                                               |
| `packages/genre-*`      | `@track-forge/genre-*`      | Genre modules: edm, hiphop, pop, ambient, dnb                                                                |
| `packages/test-support` | `@track-forge/test-support` | Shared test helpers                                                                                          |

## Backend architecture

**Routes** (`apps/server/src/routes/*`): jobs, versions, projects, health, suno, events, import-export, preview-style. Routed via route-type name on `server.get/post/patch/delete`.

**Preview style endpoints**:

- `POST /api/preview-style` — compiles style prompt from a raw bundle body (unsaved sessions). Accepts `{ genreId, presetIds, descriptors, bpm, key, scale, sections, lyricsMode, vocalType }`. Returns `{ style, charCount, activeCount }`.
- `POST /api/jobs/:id/preview-style` — same but for saved sessions (validates job exists).

Both use the shared `compileStylePrompt()` in `packages/core/src/pipeline/style-compiler.ts`.

**Synthetic SSE events**:
Bar 8 of the forge strip ("Rendering with Suno") is driven by synthetic SSE events emitted when `POST /api/versions/:id/takes` is called:

- `progress { stage: "suno_render", status: "started" }`
- `progress { stage: "suno_render_complete", status: "completed" }`
- `progress { stage: "suno_render_error", status: "error" }`

These live in a display-only label map, NOT in `STAGE_ORDER`/`GenerationStage`.

**Pipeline stages** (`packages/core/src/pipeline/orchestrator.ts`):

```
compilation (deterministic, no LLM) → lyrics_writing (LLM) → versioning
```

- **compilation** — reads session inputs from job, calls `compileStylePrompt()` to produce the deterministic style from weighted descriptors. No LLM call.
- **lyrics_writing** — the **only** LLM call in the pipeline. Sends `buildSunoContext()` (compiled style + arrangement structure + vocal delivery + lyric brief) to the LLM with a lyric-writing instruction. Skipped if `lyricsMode === "strict_instrumental"`.
- **versioning** — persists version artifacts (title, style, lyrics, excludedStyles) to DB, completes job.

**Removed stages** (old pipeline): `ref_interpretation`, `planning`, `style_writing`, `review`, `revision`, `verification` — all obsolete because:
- Style is deterministically compiled from weighted descriptors, not LLM-generated
- Arrangement is user-defined in the Arrangement Editor, not LLM-planned
- No review/critic stage needed since style is deterministic

Stage state persisted as JSON in `job.stageData`. **`compiledJson` on job row is deprecated and no longer written as of 4a** — always read `stageData` JSON column instead. Column retained pending removal.

**Section-delta contract**: Each section carries exactly one function verb (`fn`: establish/introduce/escalate/contrast/remove/peak/resolve) and a list of local `deltas`. Global sonic traits belong in the Style Console/descriptors, not in deltas. `buildSunoContext()` in `packages/core/src/pipeline/suno-context.ts` serializes the full Suno context string.

**Descriptor model**: Weighted (1–3) descriptors in 5 categories (sound/rhythm/atmosphere/production/energy). Configured per-genre in `config/genres/*.yaml`. Server-compiled via `compileStylePrompt()`.

**Genre config (static data)**:

Presets, tag categories, song structures, taxonomy, **descriptor categories + defaults, lyric themes, section functions, delta palette, section palette, vocal presets** live in `config/genres/*.yaml` — no DB. The TS genre modules carry only executable parts (renderers, critics, validators, `compileBlueprint()`, `promptFragments`).

## Frontend architecture

**Single-screen Compose workspace** — the app has one view with 4-column CSS grid:

- Setup column (left, 270px, collapsible to 42px): 6 collapsible cards (GENRE, PRESET, LYRICS, TEMPO & KEY, DESCRIPTORS, REFERENCE)
- Bundle canvas (center, scrolls, max-width 720px): 4 blocks (TITLE, STYLE CONSOLE, ARRANGEMENT STRUCTURE, ARRANGEMENT)
- Renders panel (right, 320px, collapsible to 42px): take cards with waveforms
- Library panel (far right, 300px, collapsible to 42px): session archive

**Hash router**: Only `#/session/:id` deep-link support (`lib/router.tsx`). No nav-rail route switching.

**Session context** (`apps/web/src/lib/session.tsx`): `SessionProvider` exposes the full bundle state: `{ jobId, name, title, genreId, presetId, presetIds[], bpm, key, scale, status, reference, lyricsMode, lyricTopic, lyricAngle, lyricThemes[], lyricLines, lyricsGenerated, tags[], sections[], selSectionId, arrangeSource, takes[], cards{}, leftCollapsed, rightCollapsed, libraryCollapsed, forgeRunning, forgeStageIdx, forgeStageLabel, onForge, forgeLabel, forgeDisabled }`. Views write via `setSession()`.

**SSE**: `connectJobEvents(id, handlers)` in `api.ts`. Drives the 8-bar forge strip (7 pipeline stages + 1 Suno render via synthetic `suno_render` events). History replay on reconnect.

**Key module locations**:

- Arrangement editor: `apps/web/src/components/compose/ArrangementEditor.tsx`
- Lyrics block: `apps/web/src/components/compose/LyricsBlock.tsx`
- Library panel: `apps/web/src/components/compose/LibraryPanel.tsx`

## Genre modules

Implement `GenreModule<TInputs, TBlueprintData>` from `@track-forge/genre-core`:

- `inputSchema`/`blueprintSchema` — Zod schemas
- `compileBlueprint(inputs, options?)` — arrangement with `fn`/`deltas`/`vocal`, styleClauses, tags
- `renderers` — `title`, `style`, `excludedStyles`, `lyrics`
- `promptFragments` — keyed by stage
- `descriptorConfig?` — `GenreDescriptorConfig` with categories, defaults, presetSeeds
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
- **Hash router is now `#/session/:id` only** — the old nav-rail routing (4 separate pages) was replaced by the single-screen Compose workspace. No route segments to match.
- **Server needs `data/` directory** — DB default path is `./data/track-forge.db`. The directory must exist or `createDb()` throws.
- **Key select stores abbreviated scale** — `<option value="C maj">` splits to `["C","maj"]`. The UI handler must map `"maj"`→`"major"` and `"min"`→`"minor"` before storing in session `scale`. Genre Zod schemas use `z.enum(["major", "minor"])` — `safeParse` rejects `"maj"`/`"min"`, causing silent job creation failures.
- **Session defaults** — `genreId` defaults to `"edm"`, `bpm` to `128`, `key` to `"C"`, `scale` to `"minor"`. On first load the SetupColumn seed effect auto-selects the first preset, seeds 5 descriptor tags from YAML defaults, and populates the default arrangement sections. Wait for `descDefaults` and `presets` API responses before relying on seeded state.
- **Descriptor/vocab data is YAML-served** — `GET /api/genres/:id/descriptor-defaults` returns `{ categories, defaults, lyricThemes, sectionFunctions, deltaPalette, sectionPalette, vocalPresets }`. The UI no longer has hardcoded `LYRIC_THEMES`, `DELTA_PALETTE`, etc. — test against the API, not local constants. The old `DESCRIPTOR_DATA` TS constant was deleted in 4a.
- **Vocal delivery editor visibility** — gated solely by `sectionIsVocal(sec)`. It checks `deltas` for `"instrumental"` (hides), `"vocal focus"`/`"catchy"` (shows), or section name matching `/verse|chorus|hook|pre-chorus|refrain|bridge|drop/` (shows). The old `lyricsMode !== "strict_instrumental"` gate was removed because vocal delivery settings are independent of lyric generation mode.
- **Autosave is debounced** — `ComposeShell.tsx` calls `updateJobInputs()` with an 800ms debounce on session state changes. Only fires when `jobId` is set (first forge creates the job row). Manual `PATCH /api/jobs/:id/inputs` is still available for direct saves.
