# Codebase Concerns

**Analysis Date:** 2026-07-15

## Hard Bugs

### BUG-1 (Critical) — Lyrics revision patch stores JSON string instead of serialized text

**Issue:** When `handleRevision` applies a section-level lyrics patch, `applyLyricsPatch()` returns `JSON.stringify(doc)` — a JSON-serialized `LyricsDocument` object. This JSON string is stored directly into `compiled["lyrics"]` instead of being deserialized to text via `serializeLyrics()`.

**Files:**
- `packages/core/src/pipeline/orchestrator.ts:426-428`
- `packages/core/src/pipeline/lyrics-patcher.ts:121`

**Impact:** After a revision patch, the lyrics artifact contains raw JSON (`{"sections":[{"type":"verse","lines":["line1"]}],"metadata":{}}`) instead of serialized text (`[Verse]\nline1`). Downstream consumers (Suno API submission, Studio view, exports) all receive broken data.

**Fix approach:** After applying the patch, deserialize and re-serialize to text:
```typescript
if (patched) {
  try {
    const doc = JSON.parse(patched);
    compiled[key] = serializeLyrics(doc);
  } catch {
    compiled[key] = patched;
  }
}
```

---

### BUG-2 (High) — HipHop `lyricsMode` enum `"instrumental"` never matches `"strict_instrumental"` check

**Issue:** The HipHop input schema (`packages/genre-hiphop/src/schema.ts:71-73`) defines `lyricsMode` as `z.enum(["instrumental", "full_lyrics"])`, but the pipeline orchestrator (`packages/core/src/pipeline/orchestrator.ts:145`) checks `lyricsMode === "strict_instrumental"`. Since `"instrumental" !== "strict_instrumental"`, the check is always `false` for HipHop, causing unnecessary LLM calls for lyrics generation even when the user selected instrumental mode.

**Files:**
- `packages/genre-hiphop/src/schema.ts:71-73` — enum values `["instrumental", "full_lyrics"]`
- `packages/core/src/pipeline/orchestrator.ts:144-145` — check `lyricsMode === "strict_instrumental"`

**Impact:** Wastes LLM credits and time generating lyrics that will be discarded. The HipHop renderer correctly returns empty string for `"instrumental"` but the LLM call already happened.

**Fix approach:** Either change HipHop schema to use `"strict_instrumental"` or expand the orchestrator check to include both values.

---

### BUG-3 (High) — Cancel event signals `status: "completed"` instead of `status: "cancelled"`

**Issue:** The cancel job endpoint publishes an SSE event with `status: "completed"` instead of `status: "cancelled"`, making it impossible for SSE consumers to distinguish a cancellation from a successful completion without special-casing the stage name.

**File:** `apps/server/src/routes/jobs.ts:419`

**Impact:** Frontend SSE handlers see a "completed" event for cancellations. The Forge view may show incorrect status.

**Fix:**
```typescript
await publish(tx as any, id, { stage: "cancelled", status: "cancelled" });
```

---

### BUG-4 (High) — `JSON.parse` without try/catch in SSE event handler on frontend

**Issue:** The SSE `progress` event listener in `connectJobEvents` calls `JSON.parse(e.data)` without try/catch. If the server sends malformed JSON, the handler throws an unhandled `SyntaxError` inside the EventSource listener, causing the browser to tear down the connection.

**File:** `apps/web/src/api.ts:413-416`

**Impact:** Users silently lose live progress updates on the Forge page.

**Fix approach:** Wrap `JSON.parse` in try/catch inside the SSE handler.

---

### BUG-5 (High) — 5× `JSON.parse` on DB columns without error handling in server routes

**Issue:** Multiple server route handlers call `JSON.parse()` on DB-stored JSON strings without try/catch. Corrupted or hand-edited DB data crashes the entire request handler with an unhandled 500 exception.

**Files:**
- `apps/server/src/routes/jobs.ts:318` — `JSON.parse(job.findings)`
- `apps/server/src/routes/jobs.ts:488` — `JSON.parse(latestVersion.artifacts as string)`
- `apps/server/src/routes/jobs.ts:498` — `JSON.parse(job.compiledJson)`
- `apps/server/src/routes/versions.ts:89` — `JSON.parse(version.artifacts)`
- `apps/server/src/routes/suno.ts:122` — `JSON.parse(latestVersion.artifacts as string)`

**Impact:** Any data corruption in DB JSON columns causes an unhandled 500 error. The rest of the codebase consistently wraps `JSON.parse` in try/catch — these locations were missed.

**Fix approach:** Wrap each in try/catch with fallback values (empty array/object).

---

### BUG-6 (Medium) — Pipeline event `message`/`tag`/`elapsedMs` silently dropped on DB persist

**Issue:** The `PipelineEvent` interface defines `message`, `tag`, and `elapsedMs` fields (optional), but the DB insert in `publish()` only stores `stage`, `status`, `data`, `error`, `timestamp`. The `data` column is always set to `null`. On SSE reconnect, replayed events lack these rich description fields.

**Files:**
- `packages/core/src/pipeline/events.ts:65-74` — DB insert drops `message`, `tag`, `elapsedMs`
- `packages/core/src/db/schema.ts:106-117` — `jobEvents` table has no columns for these fields

**Impact:** After SSE reconnection, the Forge view's progress messages and timing info are missing.

**Fix approach:** Store these fields in the `data` JSON column or add dedicated columns.

---

### BUG-7 (Medium) — Version tree recursion has no cycle protection + dead `versionMap`

**Issue:** The `buildTree` function in the versions route recurses through `parentVersionId` without any cycle detection. A database bug or manual edit creating a circular reference causes a stack overflow crash. Additionally, `versionMap` is populated but never read.

**File:** `apps/server/src/routes/versions.ts:232-249`

**Impact:** Stack overflow crash on corrupt version data.

**Fix approach:** Add a depth limit to `buildTree` and remove dead `versionMap` variable.

---

### BUG-8 (Medium) — `countVersions` fetches all rows instead of SQL `COUNT(*)`

**Issue:** `countVersions` selects all version ID column values and counts them in JavaScript instead of using SQL `COUNT(*)`.

**File:** `packages/core/src/pipeline/job-service.ts:81-87`

**Impact:** With many versions per job, transfers all version IDs from DB to JS memory just to count them.

**Fix:**
```typescript
const rows = await db
  .select({ count: sql<number>`COUNT(*)` })
  .from(schema.versions)
  .where(eq(schema.versions.jobId, jobId));
return Number(rows[0]?.count ?? 0);
```

---

### BUG-9 (Low) — Redundant `"cancelled" as any` cast

**Issue:** The `"cancelled" as any` cast on status update is unnecessary since the column type is `text("status")` which already accepts strings.

**File:** `packages/core/src/pipeline/job-service.ts:174`

**Impact:** Masks potential type mismatches that a future schema change would otherwise catch.

**Fix:** Remove the `as any` cast.

---

## Cascading Delete Without Transactions (High Risk)

### Issue: Job and project deletion not wrapped in DB transactions

**Issue:** Both the job delete cascade and project delete cascade execute 8+ sequential `await db.delete()` calls without wrapping them in a database transaction. If any middle step fails, orphaned records remain permanently.

**Files:**
- `apps/server/src/routes/jobs.ts:219-261` — 8 individual deletes (sunoTracks → artifactLocks → generations → versions → jobStageOutputs → jobEvents → criticFindings → adjustments → jobs)
- `apps/server/src/routes/projects.ts:152-223` — 11 individual deletes for project + nested jobs

**Impact:** Permanent data inconsistency on partial failure. For example, if step 5 fails after step 3 deletes generations, the job record still references deleted versions.

**Fix approach:** Wrap each cascade in `await db.transaction(async (tx) => { ... })`.

---

## Fire-and-Forget Promises Without Error Handling (High Risk)

### Issue: `.then()` without `.catch()` on async API calls

**Issue:** Multiple frontend components call `.then()` on async functions without attaching `.catch()`, creating unhandled promise rejections on API failure.

**Files:**
- `apps/web/src/pages/Studio.tsx:107` — `fetchTakes(sorted[0]!.id).then(setGenerations)` on initial load
- `apps/web/src/pages/Studio.tsx:116` — `fetchTakes(v.id).then(setGenerations)` on version switch
- `apps/web/src/pages/Studio.tsx:144` — `fetchTakes(selectedVersion.id).then(setGenerations)` in poll timer
- `apps/web/src/pages/Forge.tsx:151` — `fetchJob(id).then((j) => setJob(j))` on SSE completion
- `apps/web/src/pages/Forge.tsx:184` — `fetchJob(id).then(...)` in poll timer

**Impact:** API failures produce unhandled promise rejections and silent UI failures (stale data, missing generations).

**Fix approach:** Add `.catch()` handling or convert to `async/await` with try/catch.

---

## Silent Error Swallowing (Medium Risk)

### Issue: `.catch(() => {})` completely swallows errors

**Files:**
- `apps/server/src/index.ts:35` — `lockService.cleanExpiredLocks().catch(() => {})` — runs every 30s, DB failures invisible
- `apps/web/src/pages/CreateSession.tsx:118-129` — `fetchGenres()`, `fetchPresets()`, `fetchTagCategories()` all use `.catch(() => {})`

**Impact:** Operators and users have zero visibility into failures. Lock cleanup failures go undetected; genre config endpoint errors show blank UI with no feedback.

**Fix approach:** At minimum log the error. For lock cleanup, use `.catch((err) => console.error("Lock cleanup failed:", err))`.

---

## Race Condition Risk (Medium Risk)

### Issue: SSE + polling dual update mechanism can regress state

**Issue:** The Forge view uses both SSE (`connectJobEvents`) and polling (`setInterval`) to refresh job state. Poll responses arriving after SSE responses write **older** data via `setJob(j)`, which unconditionally overwrites the latest state.

**File:** `apps/web/src/pages/Forge.tsx:122-193`

**Impact:** If SSE indicates "completed" but an in-flight poll was dispatched before completion, the job state regresses.

**Fix approach:** Use a comparison check before `setJob` or disable polling when SSE confirms freshness.

---

## Non-Null Assertions That Crash at Runtime (Medium Risk)

### Issue: `!` assertions on array lookups that may be undefined

**Files:**
- `packages/genre-hiphop/src/taxonomy.ts:89` — `subgenres[0]!` crashes on empty array
- `packages/genre-hiphop/src/renderers.ts:98` — `themes[3]!` crashes if themes have <4 elements
- `packages/genre-hiphop/src/renderers.ts:96,102-108` — Multiple `dict[key]!` lookups

**Impact:** Adding new enum values or data that changes array sizes causes runtime crashes.

**Fix approach:** Replace `!` with optional chaining and fallbacks (e.g., `themes[3] ?? ""`).

---

## Bloat / Large Files (Medium Risk)

### Issue: Multiple files exceed maintainable size

**File: `apps/web/src/pages/CreateSession.tsx` (969 lines)**
- Single `CreateSession` component function is ~877 lines
- 5+ levels of nested JSX with IIFE patterns (lines 481-618, 623-683)
- Duplicated `tagCategories` fallback expression 3 times (lines 432, 481, 627)
- **Recommendation:** Split into FoundationPanel, StyleConsole, ArrangementPanel, ReferencePanel components

**File: `packages/core/src/pipeline/orchestrator.ts` (915 lines)**
- `buildPromptContext(...)` call pattern duplicated 5× with only 2-5 extra fields different each time
- `(module as any).songStructure?.map(...)` duplicated 4×
- `JSON.parse(compiledJson)` + field injection duplicated 2×
- **Recommendation:** Extract `buildReviewContext()` and `getSongStructure()` helpers

**File: `apps/server/src/routes/jobs.ts` (620 lines)**
- "fetch job + 404 check" pattern repeated 12× across handlers
- **Recommendation:** Extract `getJobOr404()` helper to eliminate ~40 duplicated lines

**File: `packages/genre-edm/src/taxonomy.ts` (1170 lines)**
- Only ~20 lines of actual code; 1150 lines is a single `EDM_SUBGENRES` data array of 43 objects
- Project already uses YAML for genre config data elsewhere — this should be migrated

---

## Stale Comments (Low Risk)

### Issue A — Wrong subgenre count in JSDoc

**File:** `packages/genre-edm/src/index.ts:1-6`

JSDoc claims "80+ subgenres" but actual taxonomy contains 43 subgenres. Number is from an earlier, larger taxonomy.

### Issue B — Planned-but-never-built config feature

**File:** `packages/core/src/suno/callbacks.ts:6-8,14-15`

Comments describe a `sunoCallbackUrl` config field that was planned but never implemented. The priority chain mentions step 1 that doesn't exist as a code path.

### Issue C — "Deprecated" label without actual deprecation

**File:** `apps/server/src/routes/import-export.ts:220`

The `POST /api/jobs/export` route is labeled "deprecated" in a comment but has no runtime deprecation mechanism (no warning header, no log, still fully operational).

---

## Dead Code / Stale Exports

### Unused barrel exports from genre packages

Every genre package (`genre-edm`, `genre-hiphop`, `genre-pop`, `genre-ambient`, `genre-dnb`) exports all its internal types, schemas, and constants through its barrel `index.ts`, but **only the `*Module` and `default` export** is consumed externally (by `apps/server/src/lib/modules.ts`).

**Total dead exports: ~63 symbols across 5 genre packages**

Examples:
- `packages/genre-hiphop/src/index.ts` — 19 of 21 exports unused outside package (including `HipHopInputSchema`, `HipHopBlueprintSchema`, all critics, validators, subgenre helpers)
- `packages/genre-edm/src/index.ts` — 14 of 16 exports unused (same pattern)
- All genre packages export `*Schema`, `*Inputs`, `*Blueprint`, `*_DEFAULTS`, `*_CRITICS`, `*_VALIDATORS` that nothing imports

### Unused barrel exports from contracts

**File:** `packages/contracts/src/index.ts` — 17+ types/interfaces/consts never imported externally:
- `SunoArtifactType`, `SunoInstrumentalMode`, `LockType`, `ContentLock`, `ArtifactLock`, `SectionLock`, `TextAnchor`, `Project`, `Draft`, `ProjectId`, `DraftId`, `CriticFindingRecord`, `AdjustmentRecord`, `SunoTrack`, `ControlOperator`, `CompiledStyle`

### Unused barrel exports from core

**File:** `packages/core/src/index.ts` — 34+ exports never imported externally:
- All LLM types (`LlmError`, `LlmMessage`, `LlmRequest`, `LlmResponse`, `LlmProvider`)
- All Suno types (`SunoCapabilities`, `SunoClientConfig`, `SunoGenerateRequest`, etc.)
- Various pipeline internals (`loadJob`, `ReferenceCache`, `interpretReference`, parsers, assembly helpers)

### Unused exports in web app

**File:** `apps/web/src/api.ts` — 12+ API functions never imported by any page:
- `updateJobInputs`, `retryJob`, `promoteVersion`, `rollbackToVersion`, `fetchVersionTree`, `fetchPayloadPreview`, `submitReview`, `setNlAdjustments`, `updateArtifact`, `fetchGenerationStatus`, `retryGeneration`

**File:** `apps/web/src/lib/router.tsx:88` — `<Link>` component exported but never used
**File:** `apps/web/src/lib/useAutosave.ts` — `useAutosave` function exported but unused (only `SaveStatus` type is used)
**File:** `apps/web/src/components/AutoSaveIndicator.tsx` — component exported but never imported

### Unused server lib exports

**Files:**
- `apps/server/src/lib/config.ts:13` — `getConfig()` never called
- `apps/server/src/lib/db.ts:14` — `getDb()` never called (server uses `setupDb()`)
- `apps/server/src/lib/genre-config.ts` — `getGenreConfig()`, `getDefaults()`, `getTagPolicy()`, `getAdjustmentVocabulary()`, `clearCache()` all never imported

### Empty test-support package

**File:** `packages/test-support/src/index.ts` — 0 lines, never imported anywhere

---

## Build Artifacts in Source Tree

### Issue: `.d.ts` files co-located beside `.ts` source files

The `tsc --build` output emits `.js`, `.d.ts`, `.js.map`, and `.d.ts.map` beside the source `.ts` files. This pollutes the source tree with 30+ `.d.ts` files:

```
apps/server/src/cli.d.ts
apps/server/src/index.d.ts
apps/server/src/lib/config.d.ts
apps/server/src/lib/db.d.ts
apps/server/src/lib/modules.d.ts
apps/server/src/routes/events.d.ts
apps/server/src/routes/health.d.ts
apps/server/src/routes/import-export.d.ts
apps/server/src/routes/jobs.d.ts
apps/server/src/routes/projects.d.ts
apps/server/src/routes/suno.d.ts
apps/server/src/routes/versions.d.ts
packages/contracts/src/index.d.ts
packages/core/src/config.d.ts
packages/core/src/db/index.d.ts
packages/core/src/db/schema.d.ts
packages/core/src/index.d.ts
packages/core/src/llm/client.d.ts
packages/core/src/llm/index.d.ts
packages/core/src/llm/types.d.ts
packages/core/src/lyrics/canonical.d.ts
packages/core/src/lyrics/index.d.ts
packages/core/src/pipeline/*.d.ts
packages/core/src/suno/*.d.ts
packages/test-support/src/index.d.ts
```

These are gitignored but still visible on `ls` and in IDE searches. They can cause confusion when stale `.d.ts` files remain after source restructuring.

---

## Configuration & Infrastructure

### `data/` directory must exist manually

The default DB path is `./data/track-forge.db`, but no code auto-creates this directory. `createDb()` throws if the directory doesn't exist.

**File:** `packages/core/src/db/index.ts` (indirect — directory must pre-exist for SQLite)

### No prettier config file

The project uses prettier defaults. No `.prettierrc` exists. This is fine but worth documenting.

---

**Concerns audit: 2026-07-15**
