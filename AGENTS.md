# Track Forge

TypeScript npm-workspace application: Fastify server, Preact/Vite web client, SQLite (Drizzle ORM) persistence, data-driven genre configuration (YAML), OpenAI-compatible LLM integration, Suno generation through a server-side adapter.

## Source of truth

| Concern                | Location                                                                                        |
| ---------------------- | ----------------------------------------------------------------------------------------------- |
| Pipeline stages        | `packages/core/src/pipeline/orchestrator.ts` — `compilation → lyrics_writing → versioning`      |
| Genre vocabulary       | `config/genres/<id>.yaml` (presets, descriptors, structure, palette)                            |
| Shared API types       | `packages/contracts/src/index.ts`                                                               |
| Genre module types     | `packages/genre-core/src/index.ts` — `SectionFunction`, `Vocal`, `DescriptorCategory`, etc.     |
| DB schema              | `packages/core/src/db/schema.ts`                                                                |
| Web session state      | `apps/web/src/lib/session.tsx` — `SessionProvider` + `useSession()` (no `onForge` in state)     |
| Suno provider contract | `packages/core/src/suno/client.ts` — `submit()`, `getGenerationStatus()`, `waitForCompletion()` |
| Fake test providers    | `packages/test-support/src/providers/` — fake LLM, fake Suno, 10 scenarios                      |
| Pipeline deps          | `packages/core/src/pipeline/types.ts` — `PipelineDeps` (no `suno` field)                        |
| E2E tests              | `e2e/` — Playwright, including idempotency tests in `e2e/idempotency.spec.ts`                   |
| Playwright config      | `playwright.config.ts` — base URL `http://localhost:5173`                                       |
| Build verification     | `npm run build && npm test && npx prettier --check . && npx tsc --noEmit && npx playwright test` |

## Quick start

```
npm ci
npm run build
npm test
SUNO_DRY_RUN=true npm run -w apps/server dev    # Fastify on :3000 (Suno skip)
npm run -w apps/web dev                          # Vite on :5173, proxies /api → :3000
npm run clean
npx playwright test                              # E2E tests (requires back + front running)
```

## Configuration

Server config lives in `track-forge.config.js` (project root) with env-var overrides
(`TRACK_FORGE_DB_PATH`, `TRACK_FORGE_LLM_API_KEY`, etc.). The default DB path
is `./data/track-forge.db` (relative to CWD). Set `SUNO_DRY_RUN=true` to skip
actual Suno API calls during development.

## Stable invariants

- Only `compilation → lyrics_writing → versioning` pipeline may be extended. No resurrection of critic/revision/retry/replay.
- `PipelineDeps` does **not** include `suno` — the pipeline never calls Suno directly.
- `completeJob()` sets `currentStage: "completed"` (not `"versioning"`), so `job.currentStage !== "completed"` means the pipeline is still running.
- Stage errors use `failStage()` which retries up to 3 times before failing the job.
- Genre content belongs in YAML unless it is schema or runtime behavior (`GenreModule.inputSchema`/`defaults`).
- The browser never receives provider credentials.
- No live provider (LLM, Suno) calls in tests. Use fake providers from `packages/test-support/src/providers/`.
- Fake providers return `{ taskId: string }` from `submit()` — matching the real `SunoClient` contract.
- UI state transitions depending on server events require browser tests, not only component unit tests.
- Every external-provider change needs a fixture and contract test.
- UI changes require browser verification via Playwright (`e2e/`).
- The web imports `SectionFunction`, `Vocal`, `DescriptorCategory`, `DescriptorWeight`, `LyricsMode` from `@track-forge/contracts` and `@track-forge/genre-core` — do not duplicate these types.
- Database-destructive actions require explicit approval.

## Idempotency

Pipeline stages are persisted to DB at each step via `stageData` in the `jobs` table.
If the browser closes mid-forge, the session can be recovered on reload from the library:

- `POST /api/jobs/:id/start` triggers `runPipeline()` which writes stage data after each stage.
- `GET /api/jobs/:id/events/history` returns persisted events with sequence numbers for ordered replay.
- Versions with artifacts (title, style, lyrics) survive server restarts.
- The cancel endpoint (`POST /api/jobs/:id/cancel`) works on pending and in-progress jobs.

See `e2e/idempotency.spec.ts` for the full test suite.

## Commands

```
/verify       — clean → build → test → prettier → tsc --noEmit → validate-genres
/smoke-forge  — full Forge → Take → Render E2E with fake providers
```

## Code discovery

Use CodeGraph (`codegraph_explore`) for cross-file behavior, call relationships, reachability, and impact analysis. Use normal search (`rg`, `fd`) for exact symbols, strings, filenames, and local edits. Verify CodeGraph freshness before relying on absence or dead-code conclusions.
