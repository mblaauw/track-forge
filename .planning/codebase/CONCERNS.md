# Codebase Concerns

**Analysis Date:** 2026-07-15

## Tech Debt

### Widespread `as any` Type Erasure

**Issue:** Over 100 uses of `as any` (or `as unknown as`) across the codebase, erasing TypeScript's type safety on critical paths.

**Files:**
- `packages/core/src/pipeline/orchestrator.ts` — pervasive `(module as any).songStructure` (lines 159, 259, 319, 496), `(err as any).cause` (line 806), `job.id as any` (lines 638, 669, 742)
- `packages/core/src/pipeline/critic-runner.ts` — `f.patchType as any` (line 124)
- `packages/core/src/pipeline/job-service.ts` — `status: "cancelled" as any` (line 174), `rows[0] as unknown as Version` (line 217)
- `packages/core/src/db/index.ts` — `(db as any).$client` (line 12)
- `apps/server/src/routes/jobs.ts` — `update as any` (line 194), `id as any` (lines 361, 389, 420), `tx as any` (lines 419-420)
- `apps/server/src/routes/import-export.ts` — `as any` on every object in import/export (lines 50, 56, 87, 90, 94, 248)
- `apps/server/src/lib/modules.ts` — `as unknown as GenreModule` on every genre module import (lines 14-18)
- `apps/web/src/api.ts` — `import.meta as unknown as Record<string, unknown>` (lines 3-10)
- `apps/web/src/pages/CreateSession.tsx` — `as unknown as GenreModule` on all genre modules (lines 12-18)
- `packages/core/src/pipeline/orchestrator.ts` — `as any` on `parseBlueprint` results throughout

**Impact:** A runtime type error that would be caught by the type system at compile time will instead surface as a cryptic runtime crash. Defeats the purpose of using TypeScript.

**Fix approach:** Define proper interfaces for song structure, blueprint arrangement, pipeline state serialization, and genre module shapes. Replace `as any` with proper type assertions or Zod parse gates.

---

### Config File Uses `new Function()` (eval)

**Issue:** `readConfigFileSync` in `config.ts` strips `export default` and runs the config file through `new Function()`, effectively using eval.

**File:** `packages/core/src/config.ts` lines 73-85

```typescript
function readConfigFileSync(path: string): Record<string, unknown> {
  const code = readFileSync(path, "utf-8");
  const stripped = code
    .replace(/^export\s+default\s+/, "return ")
    .replace(/;\s*$/, "");
  const fn = new Function(stripped);
  const result = fn();
  ...
}
```

**Impact:** The config file runs without module isolation, in the global scope. Any malicious code in the config file executes with full Node.js privileges. Dynamic import (`import()`) would be a safer approach, but the current design requires synchronous loading at startup. The regex-based stripping is also fragile — it will fail on config files with trailing comments, multi-line exports, or non-standard formatting.

**Fix approach:** Use a dynamic `import()` with top-level await in an async startup path, or use a JSON config file format instead of JS.

---

### DB Migrations via Silent `try/catch` + `ALTER TABLE`

**Issue:** Schema evolution is handled by running `ALTER TABLE` statements wrapped in bare `try/catch` blocks. Failed migrations are silently ignored.

**File:** `packages/core/src/db/index.ts` lines 83-107

```typescript
try {
  sqlite.exec(`ALTER TABLE versions ADD COLUMN stage TEXT`);
} catch {}
```

**Impact:** If a migration fails for a reason other than "column already exists" (e.g., constraint violation, disk full, incompatible type), the failure is invisible. The application continues running with a partial or missing schema. There is no migration version tracking, so reapplying the same migration on a fresh DB is nondeterministic.

**Fix approach:** Implement a proper migration table with version tracking. Use conditional column existence checks instead of bare try/catch.

---

### `_refCache` Module-Level Singleton

**Issue:** The reference cache is a module-level singleton in `orchestrator.ts`, living for the lifetime of the Node.js process.

**File:** `packages/core/src/pipeline/orchestrator.ts` line 51

```typescript
const _refCache = new ReferenceCache();
```

**Impact:** In development with hot-reload (e.g., `tsx --watch`), the singleton persists across module reloads, causing stale cache state. In multi-server deployments, each process has its own independent cache, meaning no cross-process deduplication.

**Fix approach:** Make the cache injectable via `PipelineDeps` (already partially supported via `state.refCache`) and manage its lifecycle at the application level.

---

### In-Memory Maps That Can Leak

**Issue:** Three module-level Maps store state that can grow unboundedly or hold stale references.

**Files:**
- `packages/core/src/pipeline/job-abort-controller.ts` — `controllers = new Map<string, AbortController>()` (line 1)
- `packages/core/src/pipeline/events.ts` — `subscriptions = new Map<string, Set<EventCallback>>()` (line 25)
- `packages/core/src/pipeline/events.ts` — `seqCounter` module-level counter (line 30)

**Impact:** 
- `controllers` map: if `cleanupJob()` is never called (e.g., the process crashes mid-pipeline), the entry remains. For long-running servers processing many jobs, this grows indefinitely.
- `subscriptions` map: If an SSE client disconnects without calling `unsubscribe()`, the callback ref remains. The callback holds a closure over the client's response context, preventing GC.
- `seqCounter`: In single-process mode (no DB), this counter is shared across all jobs, meaning sequences are not scoped per job.

**Fix approach:** Add a TTL-based cleanup sweep for stale controllers. Ensure SSE disconnect handlers always unsubscribe. Scope sequence by jobId even in no-DB mode.

---

### Genre Module Type Mismatch Hard-Cast

**Issue:** Every genre module import requires `as unknown as GenreModule` to compile, indicating the actual module types don't match the expected interface.

**Files:**
- `apps/server/src/lib/modules.ts` lines 14-18
- `apps/web/src/pages/CreateSession.tsx` lines 12-18

**Impact:** The `augment()` function in `modules.ts` (line 9-11) spreads `mod` and adds `songStructure`, but the underlying genre modules may be missing other required members silently. Any mismatch between the actual module shape and `GenreModule` will surface at runtime rather than compile time.

**Fix approach:** Fix the genre module implementations to satisfy `GenreModule` correctly, or relax the type in `@track-forge/genre-core` to match what modules actually export.

---

## Known Bugs

### Job Cancel Race Condition

**Symptoms:** When cancelling a job, `abortJob(id)` fires the in-memory abort signal (line 415 of `jobs.ts`) *before* the DB transaction that persists the cancellation (lines 418-421). This means the pipeline's abort handler (which checks `deps.signal?.aborted` at line 702 of `orchestrator.ts`) may attempt to publish a cancellation event to the DB *before* the cancellation transaction completes, or race with it.

**Files:**
- `apps/server/src/routes/jobs.ts` lines 414-421
- `packages/core/src/pipeline/orchestrator.ts` lines 702-715

**Trigger:**
1. Client calls `POST /api/jobs/:id/cancel`
2. `abortJob(id)` fires immediately, setting the abort signal
3. The pipeline's `catch` block (line 795-824) or abort check (line 702) starts executing
4. Meanwhile, the DB transaction at lines 418-421 may not have committed yet
5. The pipeline's error publish at line 815-820 may write to DB while/after the transaction is ongoing

**Workaround:** In practice, the pipeline's DB writes are typically quick, and the race window is small. However, concurrent cancellation attempts could produce duplicate events or inconsistent job state.

---

### SSE Subscription Not Cleaned Up on Network Drop

**Symptoms:** EventSource callbacks remain in the module-level `subscriptions` Map even after a client's network connection drops. The callback references the `EventCallback` function which holds closures over the SSE response, preventing garbage collection.

**Files:**
- `packages/core/src/pipeline/events.ts` lines 33-44
- `apps/web/src/api.ts` lines 401-422

**Trigger:** Client opens `/api/jobs/:id/events` SSE, then closes the tab or loses network. The `return () => es.close()` (api.ts line 422) is never called because the tab navigation or network drop prevents the React cleanup from running.

---

### Studio `session` Effect Has Stale Closure Risk

**Symptoms:** The `useEffect` on line 238 of `Studio.tsx` depends on `[job?.status, jobName, actualId]` but reads `job.inputs` and other `job` properties inside the effect body. If the `job` object reference changes but `status` remains the same (e.g., `compiledJson` field updated), the effect won't re-run and the session context will have stale data.

**File:** `apps/web/src/pages/Studio.tsx` lines 238-257

**Trigger:** A background update to the `job` object (e.g., from a polling callback) that changes `job.inputs` but not `job.status` will not trigger re-evaluation of the session effect.

---

### Router `extractParams` Returns Empty Object

**Symptoms:** The `Router` component calls `extractParams(path)` on every render (line 37 of `router.tsx`) and passes the result to the context. But `extractParams` always returns `{}` (lines 46-48). While the `Route` component uses its own `match()` function which correctly extracts params, any code consuming `RouterContext.params` directly will get empty params.

**File:** `apps/web/src/lib/router.tsx` lines 46-48

**Impact:** Currently this is latent — no component accesses `params` from the Router context directly (they use `Route`'s `params` prop). But any new component that uses `useRouter().params` will silently get empty values.

---

### `compiledJson` on Job Row Is Stale

**Symptoms:** The `compiledJson` column on the `jobs` table is only updated at certain points (after compilation, after revision). The `stageData` column holds the authoritative per-stage state, but several code paths read from `compiledJson` directly.

**File:** `packages/core/src/pipeline/orchestrator.ts` lines 371-376, 644-666

**Impact:** Reading `job.compiledJson` directly (as done in some API routes and the review endpoint) returns potentially stale data if the pipeline has progressed past compilation without flushing compiledJson to the job row.

**Known workaround:** The AGENTS.md docs explicitly note this: "`compiledJson` on job row is stale — always read from `stageData` JSON column for latest compiled output."

---

## Security Considerations

### Suno Callback Webhook — No Authentication

**Risk:** `POST /api/suno/callback` accepts any HTTP request with no authentication token, secret, or signature verification (line 30-60 of `suno.ts`). An attacker who discovers this endpoint can submit fake callback data, injecting arbitrary audio URLs, titles, and metadata into any generation record.

**File:** `apps/server/src/routes/suno.ts` lines 30-60

**Current mitigation:** The attacker must guess a valid `generationId` (UUID), and the fake data only affects the `generations` table — it does not directly expose other data.

**Recommendations:** 
1. Accept a shared secret as a query parameter or header (`X-Suno-Signature`)
2. Validate the callback origin via IP allowlist (Suno's documented callback IPs)
3. At minimum, log and alert on callbacks with unknown `generationId` values

---

### Config File `new Function()` Execution

**Risk:** As described in Tech Debt, the config file loader uses `new Function()` to evaluate user-supplied JS code, bypassing module isolation.

**File:** `packages/core/src/config.ts` lines 73-85

**Recommendation:** Switch to JSON config or use dynamic `import()` that respects module sandboxing. Document that track-forge.config.js has arbitrary code execution capabilities.

---

### Static File Path Traversal Check

**Risk:** The static file serving code resolves paths and checks that the result starts with `staticPath`, but uses `resolve(staticPath, "." + url)` which normalizes the path. While the check works for simple cases, symlinks or case-insensitive filesystems may allow bypasses.

**File:** `apps/server/src/index.ts` lines 82-105

**Current mitigation:** The check is present and works for straightforward path traversal attempts (`../../../etc/passwd`).

**Recommendation:** Use Fastify's `@fastify/static` plugin instead of custom static file serving.

---

## Performance Bottlenecks

### Sequential DB Deletes in Job Cascade

**Problem:** The job delete cascade performs individual `DELETE` queries per version ID and generation ID in a loop, then deletes each related table sequentially.

**File:** `apps/server/src/routes/jobs.ts` lines 219-259

```typescript
if (genIds.length > 0) {
  for (const gid of genIds) {  // Sequential deletes for each gen
    await db.delete(schema.sunoTracks).where(eq(schema.sunoTracks.generationId, gid));
  }
}
```

**Improvement path:** Use `IN` clauses (`WHERE generation_id IN (...genIds)`) for bulk deletes, or configure CASCADE deletes at the SQLite level.

---

### JSON.parse in Every Review Loop

**Problem:** `handleReview` in `orchestrator.ts` parses `compiledJson` (line 332), `job.inputs` (line 343), and potentially other JSON fields on every invocation, even on retry/restart when the data hasn't changed.

**File:** `packages/core/src/pipeline/orchestrator.ts` lines 331-347

**Improvement path:** Cache parsed JSON in the pipeline state object to avoid redundant parsing when fields haven't changed between stages.

---

## Fragile Areas

### Pipeline Orchestrator — 910 Lines of Critical Logic

**Files:** `packages/core/src/pipeline/orchestrator.ts` (910 lines)

**Why fragile:** This file contains all 8 pipeline stage handlers, the main execution loop, error handling, state persistence, stage transition logic, and pause-after-revision behavior — all in one file. The pervasive `as any` casts (especially around `module.songStructure` which appears in 5 separate places) mean any change to the `GenreModule` interface requires updating 5+ scattered locations in this file. The catch block (lines 795-824) handles three error types (timeout, cancel, generic) with duplicate cleanup paths.

**Safe modification:** Add unit tests for each stage handler in isolation before refactoring. Extract stage handlers into separate files. Replace `as any` on module access with a proper accessor.

**Test coverage:** `packages/core/__tests__/pipeline.test.ts` covers the main pipeline flow but does not test individual error scenarios (timeout, cancel during specific stages, stage data persistence round-trips, pause-after-revision with various finding configurations).

---

### Genre Module Type Erosion Across 5 Packages

**Files:**
- `packages/genre-core/src/index.ts` — defines `GenreModule` interface
- `packages/genre-edm/src/index.ts` — EDM implementation
- `packages/genre-hiphop/src/index.ts` — Hip-hop implementation  
- `packages/genre-pop/src/index.ts` — Pop implementation
- `packages/genre-ambient/src/index.ts` — Ambient implementation
- `packages/genre-dnb/src/index.ts` — DNB implementation

**Why fragile:** Every genre module is imported with `as unknown as GenreModule` in both the server and web app, meaning the interface contract is not enforced. Any missing method or mismatched return type will surface as a runtime error. Adding a new required member to `GenreModule` requires manual verification across all 5 genre packages since the compiler won't catch the mismatch.

**Test coverage:** Only `packages/genre-edm` has validator tests. The other 4 genre modules have zero test coverage.

---

### DB Schema and Table Creation — 202 Lines

**File:** `packages/core/src/db/index.ts` (202 lines)

**Why fragile:** The `createDb()` function mixes raw `sqlite.exec()` with Drizzle ORM, defines tables inline (in SQL strings) while also defining them in `schema.ts` (Drizzle), and handles migrations via silent try/catch. There are two sources of truth for the schema. Adding a column requires updating both `schema.ts` and the raw SQL in `createDb()`.

---

### SSE Event System — In-Memory + DB Dual Delivery

**Files:**
- `packages/core/src/pipeline/events.ts` (141 lines)

**Why fragile:** The event system has two delivery paths (in-memory callbacks + DB persistence) with two sequence-generation strategies (DB MAX(sequence) vs module-level counter). The in-memory `subscriptions` Map and the DB persistence are not synchronized — a subscriber might receive an event before it's persisted to DB, or (in rare race conditions) receive duplicates if the persistence retries.

---

### Lyrics Parsing — Three Separate Implementations

**Files:**
- `packages/core/src/lyrics/canonical.ts` — canonical schema + serialization
- `packages/core/src/pipeline/orchestrator.ts` lines 888-910 — `tryParseLyricsResult`
- `apps/web/src/pages/Studio.tsx` lines 41-77 — `parseLyricsValue`

**Why fragile:** Three different code paths parse lyrics JSON with slightly different logic. The orchestrator's `tryParseLyricsResult` returns `{ document: parsed as any }` at line 899, completely erasing type safety. Studio's `parseLyricsValue` has its own parsing logic that handles two JSON shapes plus plain text. Adding a new field to the lyrics schema requires updating all three parsers.

---

## Scaling Limits

### SQLite Write Contention

**Current capacity:** Single SQLite with WAL mode and busy_timeout=5000ms.

**Limit:** Writes from the pipeline (events, stage data, version creation) and writes from API routes (create/update/cancel) contend on the same database. Under concurrent job execution, write contention will surface as `SQLITE_BUSY` errors.

**Scaling path:** The lock service and pipeline already use transactions where possible. For multi-process scaling, migrate to PostgreSQL (Drizzle ORM abstracts the dialect). For single-process, the current approach is adequate up to ~5-10 concurrent jobs.

---

## Dependencies at Risk

### `better-sqlite3` — Native Module

**Risk:** `better-sqlite3` is a native Node.js addon that requires compilation. The `allowScripts` setting in `package.json` (line 22) permits the install scripts. This can cause CI/CD failures if the build environment doesn't have the required toolchain (python3, make, C++ compiler).

**File:** `packages/core/package.json` (via allowScripts in root `package.json`)

**Impact:** `npm ci` fails on systems without build tools. Platform-specific binaries must be compiled for each target.

---

## Missing Critical Features

### No Dark Mode Support

**Problem:** The CSS (`apps/web/src/style.css`) defines a single color scheme in `:root` with light-only colors (e.g., `--bg: #FFF1E5`, `--panel: #FFFFFF`). There is no `@media (prefers-color-scheme: dark)` block, no data-attribute toggle, no CSS custom property override for dark mode.

**Blocks:** Users who prefer dark mode have no option to switch. This is increasingly expected for creative/music production tools.

---

### No API Authentication

**Problem:** All API endpoints are unauthenticated. Any process that can reach the server's port can create, read, modify, or delete jobs, versions, and generations.

**Impact:** Currently acceptable for local-dev use case, but the server warns about `0.0.0.0` binding (line 51 of `server/src/index.ts`). If deployed to a network, all data is accessible to any client.

---

### No Input Validation on PATCH Endpoints

**Problem:** `/api/jobs/:id/inputs` accepts arbitrary JSON and stores it as-is. There is no schema validation on the inputs PATCH endpoint, unlike the creation endpoint which validates against `mod.inputSchema`.

**File:** `apps/server/src/routes/jobs.ts` lines 172-204

**Impact:** Invalid input data can be written to the database via the PATCH endpoint, which will cause failures downstream when the pipeline attempts to parse or compile them.

---

## Test Coverage Gaps

**Untested area:** All 4 web views (Library, Create, Forge, Studio pages)
- **Files:** `apps/web/src/pages/*.tsx`
- **Risk:** UI logic regressions (especially the complex component orchestration in Forge.tsx and CreateSession.tsx) would go undetected
- **Coverage:** Only `smoke.test.ts` exists for the web app
- **Priority:** Medium

**Untested area:** Genre modules (hiphop, pop, ambient, dnb)
- **Files:** `packages/genre-*` (except genre-edm which has validator tests)
- **Risk:** Blueprint compilation, renderer output, and prompt fragment assembly for these genres are untested
- **Priority:** High

**Untested area:** Suno client submit/wait loop
- **Files:** `packages/core/src/suno/client.ts`
- **Risk:** The polling loop, status mapping, and error handling have unit tests for the client, but no integration tests against a real or mock Suno API
- **Risk detail:** The `waitForCompletion` exponential backoff logic (lines 148-170) is not directly tested
- **Priority:** Medium

**Untested area:** File import/export
- **Files:** `apps/server/src/routes/import-export.ts`
- **Risk:** The JSON export/import format compatibility is only covered by one test; edge cases (missing versions, deleted jobs, malformed files) are not tested
- **Priority:** Medium

---

*Concerns audit: 2026-07-15*
