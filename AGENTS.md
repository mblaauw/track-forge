# Track Forge

TypeScript npm-workspace application: Fastify server, Preact/Vite web client, SQLite (Drizzle ORM) persistence, data-driven genre configuration (YAML), OpenAI-compatible LLM integration, Suno generation through a server-side adapter.

## Source of truth

| Concern                | Location                                                                                        |
| ---------------------- | ----------------------------------------------------------------------------------------------- |
| Pipeline stages        | `packages/core/src/pipeline/orchestrator.ts` — `compilation → lyrics_writing → versioning`      |
| Genre vocabulary       | `config/genres/<id>.yaml` (presets, descriptors, structure, palette)                            |
| Shared API types       | `packages/contracts/src/index.ts`                                                               |
| DB schema              | `packages/core/src/db/schema.ts`                                                                |
| Web session state      | `apps/web/src/lib/session.tsx` — `SessionProvider` + `useSession()`                             |
| Suno provider contract | `packages/core/src/suno/client.ts` — `submit()`, `getGenerationStatus()`, `waitForCompletion()` |
| Fake test providers    | `packages/test-support/src/providers/` — fake LLM, fake Suno, scenarios                         |
| Build verification     | `npm run build && npm test && npx prettier --check . && npx tsc --noEmit`                       |

## Quick start

```
npm ci
npm run build
npm test
npm run -w apps/server dev    # Fastify on :3000
npm run -w apps/web dev       # Vite on :5173, proxies /api → :3000
npm run clean
```

## Stable invariants

- Only `compilation → lyrics_writing → versioning` pipeline may be extended. No resurrection of critic/revision/retry/replay.
- Genre content belongs in YAML unless it is schema or runtime behavior (`GenreModule.inputSchema`/`defaults`).
- The browser never receives provider credentials.
- No live provider (LLM, Suno) calls in tests. Use fake providers from `packages/test-support/src/providers/`.
- UI state transitions depending on server events require browser tests, not only component unit tests.
- Every external-provider change needs a fixture and contract test.
- UI changes require browser verification via Playwright (`e2e/`).
- Database-destructive actions require explicit approval.

## Active-code warning (during cleanup)

Do not infer runtime behavior merely because a file exists. Confirm reachability from active server (`apps/server/src/index.ts`), web (`apps/web/src/main.tsx`), CLI (`apps/server/src/cli.ts`), or pipeline (`packages/core/src/pipeline/orchestrator.ts`) entrypoints. Run `npm run build && npm test && npx tsc --noEmit` before claiming completion.

## Commands

```
/verify       — clean → build → test → prettier → tsc --noEmit → validate-genres
/smoke-forge  — full Forge → Take → Render E2E with fake providers
```

## Code discovery

Use CodeGraph (`codegraph_explore`) for cross-file behavior, call relationships, reachability, and impact analysis. Use normal search (`rg`, `fd`) for exact symbols, strings, filenames, and local edits. Verify CodeGraph freshness before relying on absence or dead-code conclusions.
