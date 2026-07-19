# Coding Conventions

**Analysis Date:** 2026-07-19

## Naming Patterns

**Files:**
- kebab-case: `job-service.ts`, `style-compiler.ts`, `db-utils.ts`, `json-utils.ts`, `job-abort-controller.ts`
- Test files match source with `.test.ts` extension: `pipeline.test.ts`, `events.test.ts`
- React components use PascalCase files: `ComposeShell.tsx`, `BundleCanvas.tsx`, `ArrangementEditor.tsx`, `SetupColumn.tsx`
- Frontend lib utility files use kebab-case: `session.tsx`, `router.tsx`
- Exception: `genre-core` uses `index.ts` and `utils.ts`

**Functions:**
- camelCase throughout: `createJob`, `loadJob`, `advanceStage`, `failStage`, `compileStylePrompt`
- Route registration functions prefixed with `register`: `registerHealthRoutes`, `registerJobRoutes`, `registerVersionRoutes`
- Pipeline stage handlers follow pattern `handle<PascalCaseStage>`: `handleCompilation`, `handleLyricsWriting`, `handleVersioning`
- Helper/utility functions in kebab-case files: `compileCore`, `compileRhythm`, `compileSound` in `style-compiler.ts`
- Async functions do NOT use an `Async` suffix — `async` keyword is sufficient

**Variables:**
- camelCase: `config`, `logger`, `db`, `sunoCfg`, `stuck`, `pipelineDeps`
- Constants in UPPER_SNAKE_CASE: `STAGE_ORDER`, `CONFIG_FILENAME`, `EVENT_TTL_MS`
- Object destructuring at function start: `const { db, config, llm, suno } = deps;`

**Types:**
- PascalCase interfaces: `PipelineDeps`, `PipelineState`, `PipelineResult`, `Job`, `Version`, `SunoArtifact`
- PascalCase type aliases: `JobId`, `VersionId`, `GenreId`, `PresetId`, `SectionFunction`
- Branded string types for IDs: `type JobId = string & { readonly __brand: "JobId" };`
- Enums-as-const-objects pattern with matching type: 
  ```typescript
  export const GenerationStage = { ... } as const;
  export type GenerationStage = (typeof GenerationStage)[keyof typeof GenerationStage];
  ```
- Zod-inferred types: `export type Config = z.infer<typeof ConfigSchema>;`

## Code Style

**Formatting:**
- No Prettier config detected — uses defaults (2-space indent, single quotes, no trailing commas)
- No ESLint config detected — uses `tsc --noEmit` as the sole linter (see `npm run lint` script)
- Strict TypeScript mode (`strict: true`, `noUncheckedIndexedAccess: true`, `skipLibCheck: true`, `forceConsistentCasingInFileNames: true`)
- TypeScript `tsc --build` with project references across all packages

**Semicolons:**
- Semicolons always used at end of statements

**Quotes:**
- Double quotes for imports and strings: `import { describe } from "vitest";`
- Single quotes not used — all double quotes

**Spacing:**
- 2-space indentation throughout
- Single blank line between sections (separated by `// ── ... ──` comment blocks)
- No blank line before closing brace `}`

## Import Organization

**Order:**
1. Third-party packages first (vitest, fastify, node builtins)
2. Internal source imports
3. Workspace package imports (`@track-forge/*`)

**Format:**
```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createDb } from "../src/db/index.js";
import type { Db } from "../src/db/index.js";
```

- Inline `type` imports: `import type { FastifyInstance } from "fastify";` (always `import type` for type-only)
- Always include `.js` extension in local imports (ESM convention)
- Workspace packages imported by `@track-forge/*` name, no `.js` extension: `import { createDb } from "@track-forge/core";`

## Section Comments

A structured visual separator used throughout:

```typescript
// ── Stage order ───────────────────────────────────────────────────────

// ── Stage: Compilation ────────────────────────────────────────────────

// ── Job CRUD ──────────────────────────────────────────────────────────

// ── Helpers ───────────────────────────────────────────────────────────
```

Width is approximately 100 characters from the `──` to the end. Used in:
- `packages/core/src/pipeline/orchestrator.ts`
- `packages/core/src/pipeline/job-service.ts`
- `packages/core/src/pipeline/events.ts`
- `packages/core/src/suno/payload.ts`
- `apps/server/src/index.ts`
- `packages/contracts/src/index.ts`

## Error Handling

**Patterns:**
- Custom `Error` subclasses for domain-specific errors:
  ```typescript
  // apps/server/src/lib/db-utils.ts
  export class ApiError extends Error {
    readonly statusCode: number;
    constructor(statusCode: number, message: string) {
      super(message);
      this.name = "ApiError";
      this.statusCode = statusCode;
    }
  }
  
  // packages/core/src/llm/client.ts
  export class LlmError extends Error {
    status: number;
    body: string;
  }
  ```

- Global Fastify error handler using `instanceof` checks:
  ```typescript
  server.setErrorHandler((error: unknown, _request, reply) => {
    if (error instanceof ApiError) {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    // ...
  });
  ```

- `try/catch` blocks in pipeline stages catch and convert to structured results:
  ```typescript
  } catch (err) {
    const msg = (err as Error).message ?? String(err);
    await publish(deps.db, state.job.id, { stage: currentStage, status: "error", error: msg });
    await failJob(deps.db, state.job.id as JobId, msg);
    cleanupJob(state.job.id);
    return { success: false, jobId: state.job.id, versionId: null, error: msg };
  }
  ```

- Zod validation via `safeParse` (not `parse`), throwing `ApiError`:
  ```typescript
  const result = schema.safeParse(req.body);
  if (!result.success) {
    throw new ApiError(400, `Invalid request body: ${result.error.message}`);
  }
  return result.data;
  ```

- JSON parse with safe fallback pattern (used extensively):
  ```typescript
  // packages/core/src/json-utils.ts
  export function safeJsonParse<T>(input: string | null | undefined, fallback: T): T {
    if (input == null) return fallback;
    try { return JSON.parse(input) as T; }
    catch { return fallback; }
  }
  ```

- Route handlers use `try/catch` or `reject` on `findRowOr404` throwing `ApiError(404)`

- Pipeline errors: each stage is wrapped; failures publish an error event and `failJob` persists the error

## Logging

**Framework:** `pino` (Fastify's default logger)

**Patterns:**
- Logger created at top level: `const logger = pino({ level: config.logLevel });`
- Child loggers for modules: `logger.child({ module: "suno" })`, `logger.child({ module: "llm" })`
- Structured logging with object-first pattern: `logger.warn({ count: stuck.cnt }, "Reset stuck in_progress jobs after restart");`
- Log levels: `fatal`, `error`, `warn`, `info`, `debug`, `trace` (from `ConfigSchema.logLevel`)
- Unhandled rejection/exception handling at app entry:
  ```typescript
  process.on("unhandledRejection", (reason) => { logger.error({ err: reason }, "Unhandled promise rejection"); });
  process.on("uncaughtException", (err) => { logger.fatal({ err }, "Uncaught exception"); });
  ```

- LLM client logs request/response at debug level with truncated content (first 500 chars)

## Comments

**When to Comment:**
- Section separators with dashed lines for logical grouping
- Inline comments for non-obvious logic: `// Security: ensure resolved path stays within staticDir`
- Top-of-file doc comments for important shared modules (see `style-compiler.ts`):
  ```typescript
  /**
   * Pure-function style compiler — single source of truth for the Suno style prompt.
   *
   * Used by:
   *  - POST /api/preview-style (unsaved sessions)
   *  - POST /api/jobs/:id/preview-style (saved sessions)
   *  - style_writing pipeline stage (via renderers.style)
   */
  ```

- `/** JSDoc */` on public API functions (`loadConfig`, `compileStylePrompt`, `generateSunoPayload`, `publish`, `subscribe`)
- Short inline comments prefixed with `// ──` for section headers
- `// @ts-expect-error` used minimally, only where type narrowing is impractical

**JSDoc/TSDoc:**
- Used primarily on exported public API functions and types
- Not used on internal/private functions (consistent throughout)
- Not used on test files

## Function Design

**Size:**
- Functions vary from 1-liner (`registerHealthRoutes`) to ~80 lines (`request` method in LLM client)
- Pipeline stage handlers are 40-80 lines
- Route handlers are concise (5-20 lines each), delegates to helpers

**Parameters:**
- Single config/state object pattern for complex parameters:
  ```typescript
  export function compileStylePrompt(input: CompileStyleInput): CompileStyleResult
  export async function runPipeline(jobId: string, deps: PipelineDeps, module: GenreModule): Promise<PipelineResult>
  ```
- Max 3 positional parameters per function

**Return Values:**
- Explicit return types on all exported functions and interfaces
- Union types for pipeline results: `{ success: boolean; jobId: string; versionId: VersionId | null; error: string | null }`
- `void` return for side-effect-only functions
- `Promise<T>` for async, `T` for sync

## Module Design

**Exports:**
- Named exports exclusively — **no default exports found anywhere**
- Barrel exports from `index.ts` files in each package:
  ```typescript
  // packages/core/src/index.ts
  export { createDb, schema, getSqlite } from "./db/index.js";
  export type { Db } from "./db/index.js";
  export { loadConfig } from "./config.js";
  // ...
  ```
- `export type` separated from value exports

**Barrel Files:**
- Present in every package: `packages/core/src/index.ts`, `packages/contracts/src/index.ts`, `packages/genre-core/src/index.ts`
- Core's `src/pipeline/index.ts`, `src/suno/index.ts`, `src/llm/index.ts` all re-export

## TypeScript Patterns

**Branded Types:**
```typescript
export type JobId = string & { readonly __brand: "JobId" };
```

**Const-object enum pattern (never `enum` keyword):**
```typescript
export const JobStatus = {
  Pending: "pending",
  InProgress: "in_progress",
  Completed: "completed",
  Failed: "failed",
  Cancelled: "cancelled",
} as const;
export type JobStatus = (typeof JobStatus)[keyof typeof JobStatus];
```

- **No `enum` keyword used anywhere** — always the const-object pattern
- Drizzle ORM schema uses `sqliteTable` with snake_case DB column names, camelCase JS properties:
  ```typescript
  const jobs = sqliteTable("jobs", {
    id: text("id").primaryKey(),
    createdAt: text("created_at").notNull(),
  });
  ```

**Type assertions:**
- `as any` used in test mocks
- `as` type assertions for branded types: `id as JobId`
- `as unknown as T` for DB row transforms
- `as const` for literal arrays passed to `z.enum()`

## Async Patterns

- `async/await` throughout — no `.then()` chains except one `.then((vs) => vs.map(parseVersion))` in `apps/web/src/api.ts`
- Pipeline orchestrated via `for...of` loop over `STAGE_ORDER`
- No `Promise.all()` or `Promise.allSettled()` detected (sequential pipeline)
- Signal-based cancellation using `AbortController`/`AbortSignal` pattern

## Database Patterns

- Drizzle ORM with SQLite (`better-sqlite3`)
- Raw SQL via `getSqlite()` for transactions and atomic operations (`events.ts`, `job-service.ts`)
- Timestamps as ISO strings (`new Date().toISOString()`)
- JSON stored as text columns, serialized/deserialized at the application layer
- Cascade delete handled in application code, not DB constraints

---

*Convention analysis: 2026-07-19*
