# Codebase Concerns

**Analysis Date:** 2026-07-19

## Tech Debt

### Config file uses `new Function()` eval pattern

- **Issue:** `readConfigFileSync()` in `packages/core/src/config.ts:73-87` strips `export default` from the JS config file and passes the result through `new Function()` for synchronous evaluation. This is effectively `eval()` and bypasses all module resolution.
- **Files:** `packages/core/src/config.ts:73-87`
- **Impact:** If the config file (`track-forge.config.js`) is replaced by a malicious actor, arbitrary code execution is possible. Also prevents static analysis and bundler optimization.
- **Fix approach:** Use dynamic `import()` (async loading) or a JSON-based config file with Zod validation instead of executing arbitrary JS.

### Heavy `as any` type casting throughout core

- **Issue:** 44+ `as any` or `as unknown as` casts in `packages/core/` alone, plus many more in test files. This erodes TypeScript type safety and makes refactoring risky — the compiler cannot catch type mismatches.
- **Files:** `packages/core/src/db/index.ts:14`, `packages/core/src/pipeline/job-service.ts:225,239`, `packages/core/src/llm/client.ts:168-187`, `packages/core/src/pipeline/events.ts:138`, and all test files
- **Impact:** Type errors that would be caught at compile time slip through. The `PipelineDeps` config field is typed `Config` but tests pass partial objects with `as any` — a full `Config` is never actually required.
- **Fix approach:** Replace `as any` with proper discriminated unions, branded type constructors, and `satisfies` expressions. Create proper factory functions for test configs.

### Duplicated DDL between Drizzle schema and manual SQL

- **Issue:** Table definitions exist in both `packages/core/src/db/schema.ts` (Drizzle ORM) and `packages/core/src/db/index.ts:33-154` (raw `CREATE TABLE IF NOT EXISTS`). The manual SQL duplicates Drizzle's schema with subtle differences — e.g., the raw SQL uses `INTEGER NOT NULL DEFAULT 0` for `is_favorite` but Drizzle's schema uses `boolean` mode.
- **Files:** `packages/core/src/db/schema.ts`, `packages/core/src/db/index.ts:33-154`
- **Impact:** Schema drift over time. Adding a column requires updating both the Drizzle schema and the raw CREATE/ALTER statements. The raw SQL is the actual schema; Drizzle schema is a client-side representation that can fall out of sync.
- **Fix approach:** Use Drizzle Kit migrations (or a proper migration tool) instead of manual `CREATE TABLE` + `ALTER TABLE` statements. Remove the duplicated DDL from `createDb()`.

### Manual migration statements with silent try/catch

- **Issue:** `createDb()` in `packages/core/src/db/index.ts:79-120` runs 8+ `ALTER TABLE ADD COLUMN` statements wrapped in bare `try {} catch {}` blocks that swallow all errors silently. This was needed to migrate existing databases, but it means any future column addition is invisible to automated migration tooling.
- **Files:** `packages/core/src/db/index.ts:79-120,132-140`
- **Impact:** Migration errors are invisible. If a migration silently fails for a real reason (disk full, constraint violation), nothing reports it. Adding a new column that already exists is expected to throw — but so would a real failure.
- **Fix approach:** Check column existence before ALTER, or adopt Drizzle Kit migrations with proper up/down scripts.

### `createVersion()` bypasses Drizzle ORM with raw SQL

- **Issue:** `createVersion()` in `packages/core/src/pipeline/job-service.ts:176-227` accesses the raw SQLite client via `getSqlite(db)` and executes manual `SELECT MAX(number)` + `INSERT INTO versions` queries instead of using Drizzle's typed query builder. This was done for atomic transaction support.
- **Files:** `packages/core/src/pipeline/job-service.ts:176-227`
- **Impact:** Loses type safety. The raw result is cast with `as unknown as Version` and doesn't go through Drizzle's schema validation. The function signature returns a Promise but the implementation is synchronous.
- **Fix approach:** Use Drizzle's `db.transaction()` with the typed query builder, or create a typed wrapper for the atomic version number increment.

### Overly large frontend components

- **Issue:** `SetupColumn.tsx` (757 lines) and `ArrangementEditor.tsx` (620 lines) are very large functional components containing multiple sub-component render functions defined inline. This makes them hard to test and maintain.
- **Files:** `apps/web/src/components/compose/SetupColumn.tsx:1-757`, `apps/web/src/components/compose/ArrangementEditor.tsx:1-620`
- **Impact:** Impossible to unit test the sub-components individually. The render tree is deeply nested with inline JSX, making it hard to follow. State logic is mixed with presentation.
- **Fix approach:** Extract inline render functions to separate component files. Move business logic to pure functions outside components. Add tests for the extracted components.

### `.catch(() => {})` silent error swallowing

- **Issue:** At least 12 locations use `.catch(() => {})` to silently swallow promise rejections with no logging. This hides API errors, SSE connection failures, and other issues.
- **Files:** `apps/web/src/components/compose/ComposeShell.tsx:123-127,149-152,235-237`, `apps/web/src/api.ts:131,149,244`, `apps/web/src/components/compose/SetupColumn.tsx:123-125,130-135`, `packages/core/src/pipeline/events.ts:99-103`
- **Impact:** Debugging production issues becomes guesswork when errors are silently suppressed. API failures, network timeouts, and data corruption issues are invisible.
- **Fix approach:** Add at minimum a `console.warn()` or structured logging to every `.catch()`. In the pipeline, propagate errors to the job's error field.

### Session context recreates provider value on every render

- **Issue:** `SessionProvider` in `apps/web/src/lib/session.tsx:147-153` creates a new `value` object (via spread) on every render, causing all consumers to re-render regardless of whether their relevant state changed.
- **Files:** `apps/web/src/lib/session.tsx:147-153`
- **Impact:** Unnecessary re-renders across the entire component tree. Every `setSession()` call triggers re-renders in components that only read unrelated state fields.
- **Fix approach:** Split the session into focused contexts (e.g., `SessionActionsContext`, `SessionStateContext`) or use a library like `use-context-selector` for granular subscriptions.

### `track-forge.config.js` is eval'd, not imported

- **Issue:** The config loading in `packages/core/src/config.ts:73-87` strips the `export default` keyword and evaluates the file body as a function body. This means the config file is not subject to module resolution, cannot use `import` statements, and bypasses Node.js module caching.
- **Files:** `packages/core/src/config.ts:73-87`
- **Impact:** Config files that use ES `import` will fail. The eval pattern breaks stack traces and debuggers. The config is re-parsed on every `loadConfig()` call since there's no module cache.
- **Fix approach:** Use `import()` (dynamic import) with top-level await at startup, or migrate to a JSON or YAML config file format.

### Genre-specific arrangement sections hardcoded in frontend

- **Issue:** Default sections for each genre (edm, hiphop, ambient) are hardcoded in `apps/web/src/components/compose/arrangement.ts:94-297`. When a new genre module is added, the frontend must be updated.
- **Files:** `apps/web/src/components/compose/arrangement.ts:94-297`
- **Impact:** Adding a genre requires coordinated backend and frontend changes. The `defaultSections()` function has a hardcoded fallback to EDM for unknown genres.
- **Fix approach:** Serve default section templates from the genre YAML config via the API, rather than hardcoding them on the client.

---

## Known Bugs

### Key select stores abbreviated scale names

- **Symptoms:** The tempo/key selector in `SetupColumn.tsx` uses `KEY_OPTIONS` like `"C maj"` and `"C min"`. The onChange handler splits on space (line 602: `val.split(" ")`) and maps `"maj"` -> `"major"`, `"min"` -> `"minor"`. Genre Zod schemas use `z.enum(["major", "minor"])`. If the mapping logic were changed or split failed, `safeParse` would silently reject the job inputs.
- **Files:** `apps/web/src/components/compose/SetupColumn.tsx:597-612`, genre module schemas
- **Trigger:** Changing the key selector to a value with an unexpected format (e.g., if an option lacked the space separator).
- **Workaround:** Currently works because the parsing logic explicitly handles `"maj"` and `"min"` mapping. Fragile to refactors.

### Pipeline error handling uses in-memory state that can diverge from DB

- **Symptoms:** The `runPipeline()` in `packages/core/src/pipeline/orchestrator.ts` maintains pipeline state in memory (`PipelineState`) and saves to DB after each stage. If the process crashes between `savePipelineState()` and `advanceStage()`, the DB `currentStage` won't match the saved `stageData`. On restart, stuck `in_progress` jobs are marked failed.
- **Files:** `packages/core/src/pipeline/orchestrator.ts:381-402`, `packages/core/src/pipeline/job-service.ts:244-257`
- **Trigger:** Server crash during stage transition.
- **Workaround:** Startup sweep marks stuck jobs as failed (`apps/server/src/index.ts:59-71`), but the `stageData` may contain data for a stage that was never completed, losing progress.

### Session defaults race condition on first load

- **Symptoms:** The `SetupColumn.tsx:139-160` seed effect runs when `presets.length > 0 && descDefaults !== null && s.tags.length === 0`. If the API calls for presets and descriptor defaults resolve at different times, the effect may fire before both are ready, or may fire multiple times. The `seededRef` prevents double-fire but doesn't handle the case where API calls fail silently.
- **Files:** `apps/web/src/components/compose/SetupColumn.tsx:139-160`, `apps/web/src/components/compose/SetupColumn.tsx:127-136`
- **Trigger:** Network latency causes presets and descriptor defaults to resolve out of order.
- **Workaround:** `fetchPresets()` and `fetchDescriptorDefaults()` are fired in the same effect, but their `.catch(() => {})` handlers swallow failures, leaving the session unseeded.

---

## Security Considerations

### No authentication or authorization

- **Risk:** The API has zero auth. Anyone who can reach the server can create jobs, delete data, trigger Suno generation (which costs money), and read all stored data.
- **Files:** `apps/server/src/routes/*.ts` (all routes)
- **Current mitigation:** None. The `AGENTS.md` mentions Fastify dev server on `:3000`.
- **Recommendations:** Add at minimum a simple API token or session-based auth. For production, implement OAuth2 or a dedicated auth provider. Mark the Suno callback endpoint (`/api/suno/callback`) as public-only.

### Config file execution is a code injection vector

- **Risk:** The `new Function(stripped)` pattern in `packages/core/src/config.ts:79` executes arbitrary JavaScript from the config file. If a CI/CD pipeline or shared dev environment has a compromised `track-forge.config.js`, code execution is immediate.
- **Files:** `packages/core/src/config.ts:73-87`
- **Current mitigation:** The config file is gitignored and expected to be a local-only file.
- **Recommendations:** Switch to a JSON or YAML config format parsed by Zod, eliminating the code execution surface entirely.

### No rate limiting or request size limits

- **Risk:** API endpoints accept arbitrary payload sizes and have no rate limiting. The LLM endpoint (`/api/lyrics/generate`, `/api/jobs/:id/start`) could be abused to exhaust the LLM API budget. The import endpoint (`POST /api/projects/import`) could cause high memory usage.
- **Files:** `apps/server/src/routes/jobs.ts`, `apps/server/src/routes/import-export.ts`, `apps/server/src/routes/lyrics.ts`
- **Current mitigation:** None beyond Fastify's defaults.
- **Recommendations:** Add Fastify rate limiting plugin, set payload size limits, and cap concurrent pipeline executions.

### API key is logged in plain text

- **Risk:** The LLM client logger in `packages/core/src/llm/client.ts:49-57` logs all request parameters including config, and the response logging includes content. While the API key itself is not logged directly, the `fetch()` call URL and headers could be logged by the HTTP layer.
- **Files:** `packages/core/src/llm/client.ts:49-57,102-110`
- **Current mitigation:** None.
- **Recommendations:** Ensure config logging redacts the `apiKey` field. Use a pino redaction path like `"req.headers.authorization"`.

### Static file path traversal is manually handled

- **Risk:** The static file serving in `apps/server/src/index.ts:109-133` has a manual path traversal check (`filePath.startsWith(prefix)`). Any bugs in path normalization (symlinks, Unicode normalization, etc.) could allow serving files outside the static directory.
- **Files:** `apps/server/src/index.ts:109-133`
- **Current mitigation:** The check uses `resolve()` followed by `startsWith()` with the OS path separator.
- **Recommendations:** Use Fastify's `@fastify/static` plugin instead of manual file serving.

---

## Performance Bottlenecks

### Suno polling blocks with sequential exponential backoff

- **Issue:** `SunoClient.waitForCompletion()` in `packages/core/src/suno/client.ts:148-170` polls synchronously (sequential async, not concurrent) with exponential backoff from 5s to 20s. A single Suno generation can block for up to 5 minutes per task.
- **Files:** `packages/core/src/suno/client.ts:148-170`
- **Cause:** The polling loop is tightly coupled to the client — it cannot handle multiple concurrent generations.
- **Improvement path:** Move to a callback/webhook-only model (already partially supported via `callBackUrl`). For polling, use a background worker that can check many tasks concurrently.

### Pipeline stages are strictly sequential

- **Issue:** The 3 pipeline stages (compilation → lyrics_writing → versioning) run sequentially with no parallelism. Compilation is fully deterministic (synchronous) and could be merged with versioning or run alongside lyrics writing.
- **Files:** `packages/core/src/pipeline/orchestrator.ts:360-403`
- **Cause:** The state-machine design keeps state in memory and serializes to DB between stages.
- **Improvement path:** Overlap compilation with lyrics writing (compilation is deterministic and needs no LLM). Run the post-processing (versioning) asynchronously after the LLM call completes.

### Genre YAML re-parsing on hot reload (mtime check overhead)

- **Issue:** `genre-config.ts` has an mtime-based cache (`loadYaml()` line 77-100) that checks filesystem stat on every request. While this is fine for development, in production every API call that reads genre config triggers a `statSync()` call.
- **Files:** `packages/core/src/pipeline/job-service.ts`, `packages/core/src/pipeline/suno-context.ts`
- **Cause:** The cache only avoids re-reading if mtime hasn't changed, but still calls `statSync()` every time.
- **Improvement path:** Cache genre configs in memory indefinitely in production (no hot-reload needed), or use a file watcher-based invalidation.

### LLM responses are not cached

- **Issue:** Every pipeline run that generates lyrics calls the LLM API, even for identical inputs. There is no caching layer for LLM responses, which costs money and time per call.
- **Files:** `packages/core/src/pipeline/orchestrator.ts:212-216`
- **Cause:** No caching infrastructure.
- **Improvement path:** Key LLM responses by a hash of the prompt + model + temperature. Cache in SQLite with TTL. This would dramatically speed up repeated lyric generations for similar arrangements.

### Session state causes full re-renders

- **Issue:** Every call to `setSession()` in `apps/web/src/lib/session.tsx:118-121` triggers re-renders in every consumer of `useSession()`, even if the changed field is irrelevant to that consumer.
- **Files:** `apps/web/src/lib/session.tsx:118-121`, `apps/web/src/components/compose/*.tsx`
- **Cause:** Single monolithic context with 30+ state fields. The spread-based update creates a new object reference every time.
- **Improvement path:** Split the session context into multiple smaller contexts (UI state, session metadata, arrangement state) or use a selector-based pattern.

---

## Fragile Areas

### `createVersion()` uses raw SQLite access that bypasses Drizzle

- **Files:** `packages/core/src/pipeline/job-service.ts:176-227`
- **Why fragile:** Accesses the underlying `better-sqlite3` instance through a type-unsafe cast (`(db as any).$client`). The raw SQL queries are string-based and not type-checked. The function runs synchronous SQL inside an async function (works because `better-sqlite3` is sync). If the internal property name `$client` changes in Drizzle, this silently breaks.
- **Test coverage:** Covered by `packages/core/__tests__/job-service.test.ts` and `packages/core/__tests__/pipeline.test.ts`.
- **Safe modification:** Keep the raw SQL but add a typed wrapper. Add a Drizzle-level test that verifies `$client` property access still works.

### LLM JSON response parsing with fallback to raw text

- **Files:** `packages/core/src/pipeline/orchestrator.ts:219-240`
- **Why fragile:** The `handleLyricsWriting()` function attempts `JSON.parse()` on the LLM response. If parsing fails, it falls back to splitting the entire response by newlines as raw lyrics text. This means a malformed LLM response can produce garbled lyrics with no warning. The fallback doesn't match section names, so section metadata is lost.
- **Test coverage:** The pipeline test uses a mock LLM that always returns valid JSON, so the fallback path is untested.
- **Safe modification:** Add a `try/catch` around parsing with a validation pass (check for expected properties), log warnings on fallback, and structure the prompt to include JSON schema examples.

### In-memory SSE subscriptions not persisted

- **Files:** `packages/core/src/pipeline/events.ts:25-44`
- **Why fragile:** Event subscriptions are stored in an in-memory `Map<string, Set<EventCallback>>`. If the server restarts or the process is recycled, all SSE connections are lost. The event history is persisted in `job_events` table, but the live subscription layer has no reconnection replay.
- **Test coverage:** `packages/core/__tests__/events.test.ts` (79 lines) covers basic publish/subscribe but not reconnection or replay.
- **Safe modification:** On SSE connect, replay events from `afterSequence` parameter. The frontend already supports `afterSequence` via `getJobEvents()`.

### Genre config loading failure is fatal

- **Files:** `packages/core/src/pipeline/job-service.ts`
- **Why fragile:** `loadYaml()` in `packages/core/src/pipeline/job-service.ts:90-99` throws if the YAML file can't be loaded. Since genre configs are loaded eagerly at module level via `ALL_GENRE_IDS` and the `MODULES` map, a single broken YAML file breaks the entire server startup. There's no graceful degradation (e.g., "edm works, hiphop broken").
- **Test coverage:** The test mocks replace the file system entirely, so YAML loading errors are not tested.
- **Safe modification:** Lazy-load genre configs with error handling per-genre, so one broken YAML doesn't block all genres.

### `dispatchPipeline()` runs fire-and-forget without backpressure

- **Files:** `apps/server/src/routes/jobs.ts:45-57`
- **Why fragile:** Pipeline execution is fire-and-forget — `dispatchPipeline()` calls `runPipeline().catch(log.error)` but doesn't track running pipelines. There's no limit on concurrent pipeline executions. Starting 100 jobs simultaneously launches 100 LLM calls and Suno submissions.
- **Test coverage:** Not covered by existing tests.
- **Safe modification:** Add a concurrency limiter (e.g., queue with max 2 concurrent pipelines) to prevent resource exhaustion.

### Test mocks use excessive `as any` casts

- **Files:** All test files, especially `packages/core/__tests__/pipeline.test.ts` (12+ `as any` casts)
- **Why fragile:** Mocks pass `mockLlm() as any`, `mockSuno() as any`, and `{} as any` for config. If `PipelineDeps` or `Config` interfaces change, these tests will still compile and fail at runtime with confusing errors. The tests are not type-checked against the actual interfaces.
- **Test coverage:** The tests exist but may be brittle due to casting.
- **Safe modification:** Create typed mock factories that produce objects matching the interfaces exactly, instead of casting partial mocks.

---

## Scaling Limits

### SQLite concurrency

- **Current capacity:** SQLite with WAL mode + 5s busy timeout. Supports concurrent reads but serializes writes.
- **Limit:** With multiple concurrent pipeline executions (each doing multiple writes), write contention increases. The `busy_timeout = 5000` means writes will retry for up to 5s before failing.
- **Scaling path:** For moderate scale, the current setup is sufficient. For heavy load, migrate to PostgreSQL (Drizzle ORM supports it with minimal changes). The existing `Db` type abstraction makes this feasible.

### Single-process server

- **Current capacity:** Single Node.js process. The Fastify server handles all routes, pipeline execution, and Suno polling in one thread.
- **Limit:** LLM API calls and Suno long-polling block the event loop (though async I/O helps). With high concurrency, event loop lag becomes noticeable.
- **Scaling path:** Extract pipeline execution into a separate worker process or queue-based system. Use `piscina` or dedicated job workers.

### In-memory subscription map

- **Current capacity:** The `subscriptions` Map in `events.ts` stores all SSE callbacks in memory. No limit on number of concurrent SSE connections.
- **Limit:** Each SSE connection holds a reference to the callback closure. With hundreds of concurrent SSE connections, memory grows linearly. No cleanup for stale connections beyond the SSE `close` event.
- **Scaling path:** Use Redis pub/sub for cross-process event distribution, or add connection limits and heartbeats.

---

## Dependencies at Risk

### `better-sqlite3`

- **Risk:** Native addon — requires `node-gyp` compilation on install (mitigated by `allowScripts` in npmrc). Major version bump could break the Drizzle integration.
- **Impact:** DB access breaks entirely.
- **Migration plan:** Drizzle ORM supports multiple SQLite drivers (`better-sqlite3`, `libsql`, `bun:sqlite`). Switching requires minimal code changes if the `getSqlite()` bypass is removed.

### `pino` logger

- **Risk:** No immediate concern, but the current usage creates a new child logger per pipeline execution, which can leak memory in long-running servers if child loggers accumulate.
- **Impact:** Logger performance degrades over time.
- **Migration plan:** Use a single logger instance and pass context via log metadata instead of child loggers.

### Fastify v5

- **Risk:** Fastify's plugin system changes in major versions. The current code doesn't use a plugin architecture (routes are registered via `register*Routes()` functions, not Fastify plugins).
- **Impact:** Upgrading Fastify requires rewriting route registration.
- **Migration plan:** Refactor to use Fastify plugins (`server.register(routePlugin)`) for modularity and easier upgrades.

---

## Missing Critical Features

### No database migrations system

- **Problem:** Schema changes are applied via silent `ALTER TABLE` attempts in `createDb()`. There is no migration history, rollback capability, or staging/production migration workflow.
- **Blocks:** Safe schema evolution across environments. Adding a new table or column requires updating the raw SQL in `createDb()` and the Drizzle schema, with no way to verify staging matches production.

### No authentication or user isolation

- **Problem:** Multiple users share the same database with no user isolation. All jobs, versions, and projects are visible to anyone who can reach the API.
- **Blocks:** Multi-tenant deployment, production release, and any scenario where the app is accessible beyond localhost.

### No request validation error details exposed selectively

- **Problem:** Zod validation errors from `safeParse()` are returned directly to the client (e.g., `apps/server/src/routes/jobs.ts:78`). While helpful for development, this exposes internal schema details in production.
- **Blocks:** Production hardening. Error messages should be sanitized for external-facing deployments.

---

## Test Coverage Gaps

### Untested primary application shell

- **What's not tested:** `ComposeShell.tsx` (281 lines) — the main app shell that orchestrates the forge flow, SSE handling, autosave, and pipeline lifecycle. This is the most critical UI component.
- **Files:** `apps/web/src/components/compose/ComposeShell.tsx`
- **Risk:** Any change to the forge flow or SSE handling can silently break the entire user workflow.
- **Priority:** High

### Untested large UI components

- **What's not tested:** `SetupColumn.tsx` (757 lines), `ArrangementEditor.tsx` (620 lines), `LyricsBlock.tsx` (280 lines), `RendersPanel.tsx` (201 lines), `LibraryPanel.tsx` (299 lines), `BundleCanvas.tsx`
- **Files:** `apps/web/src/components/compose/*.tsx`
- **Risk:** UI regression bugs are invisible until manual testing.
- **Priority:** High

### Untested session context

- **What's not tested:** `SessionProvider` and `useSession()` in `apps/web/src/lib/session.tsx`
- **Files:** `apps/web/src/lib/session.tsx`
- **Risk:** Session state bugs affect every component. State corruption or stale closures are hard to debug without tests.
- **Priority:** High

### Untested pure functions

- **What's not tested:** `compileStylePrompt()` in `packages/core/src/pipeline/style-compiler.ts` (169 lines) is a pure deterministic function ideal for unit testing, but has zero dedicated tests. It is only tested implicitly through the pipeline E2E test.
- **Files:** `packages/core/src/pipeline/style-compiler.ts`
- **Risk:** Style compilation rules can change without any test feedback.
- **Priority:** Medium

### Untested routes

- **What's not tested:** Suno callback handler (`suno.ts`), events SSE endpoint (`events.ts`), preview-style endpoint (`preview-style.ts`), lyrics generation endpoint (`lyrics.ts`).
- **Files:** `apps/server/src/routes/suno.ts`, `apps/server/src/routes/events.ts`, `apps/server/src/routes/preview-style.ts`, `apps/server/src/routes/lyrics.ts`
- **Risk:** Route handler crashes only surface during manual API testing.
- **Priority:** Medium

### Untested genre modules

- **What's not tested:** The three genre modules (`genre-edm`, `genre-hiphop`, `genre-ambient`) have no tests at all.
- **Files:** `packages/genre-edm/src/`, `packages/genre-hiphop/src/`, `packages/genre-ambient/src/`
- **Risk:** Schema changes that break genre-specific validation go undetected.
- **Priority:** Medium

### Missing frontend integration tests

- **What's not tested:** The web app has a single 8-line smoke test (`1 + 1 = 2`). No component rendering, API interaction, or user flow tests.
- **Files:** `apps/web/__tests__/smoke.test.ts`
- **Risk:** The entire frontend is a black box for automated testing.
- **Priority:** High

### No E2E tests

- **What's not tested:** No end-to-end tests that verify the full flow (frontend → API → pipeline → Suno mock → DB).
- **Files:** N/A
- **Risk:** Integration issues between frontend and backend are only caught manually.
- **Priority:** Medium

---

*Concerns audit: 2026-07-19*
