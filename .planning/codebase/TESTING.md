# Testing Patterns

**Analysis Date:** 2026-07-19

## Test Framework

**Runner:**
- Vitest v3 (`^3.0.0` in all package.json files)
- Config: `/Users/mich/dev/track-forge/vitest.config.ts`
- Workspace mode with project auto-discovery:
  ```typescript
  import { defineConfig } from "vitest/config";
  export default defineConfig({
    test: {
      projects: ["packages/*", "apps/*"],
    },
  });
  ```
- Each package/app has its own `test: "vitest run"` script
- Root `test` script: `vitest run` (runs all workspace projects)

**Assertion Library:**
- Built-in Vitest `expect` (no separate assertion library)

**Run Commands:**
```bash
npm test                              # Run all tests (vitest run)
npm run -w packages/core test         # Run single package
npm run -w apps/server test           # Run server tests
npm run -w apps/web test              # Run web tests
npx vitest run --project '@track-forge/core'  # Single package via vitest project name
npm run test:watch                    # Watch mode
```

## Test File Organization

**Location:**
- Co-located per-package in `__tests__/` directories (NOT co-located with source)
- A single `__tests__/` directory at the package/app root:

```
packages/core/__tests__/
├── config.test.ts
├── db.test.ts
├── events.test.ts
├── job-abort-controller.test.ts
├── job-service.test.ts
├── pipeline.test.ts
├── suno-client.test.ts
├── suno-payload.test.ts
└── __snapshots__/
    ├── suno-client.test.ts.snap
    └── suno-payload.test.ts.snap

apps/server/__tests__/
├── db-utils.test.ts
├── health.test.ts
├── import-export.test.ts
└── jobs.test.ts

apps/web/__tests__/
└── smoke.test.ts
```

**Naming:**
- Source file convention: `<name>.ts`
- Test file convention: `<name>.test.ts` (mirrors the logical name, not always the filename)
- Examples: `config.ts` → `config.test.ts`, `events.ts` → `events.test.ts`, `payload.ts` → `suno-payload.test.ts`

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";

describe("JobService", () => {
  let db: Db;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "tf-js-test-"));
    db = createDb(join(tmpDir, "test.db"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("createJob creates a pending job", async () => {
    // ...
  });
});
```

**Patterns:**
- **Setup in `beforeEach`**: Temporary directory creation with `mkdtempSync`, database initialization, server creation, mock registration
- **Teardown in `afterEach`** (or `afterAll`): `rmSync(tmpDir, { recursive: true, force: true })`, `server.close()`, mock cleanup
- **Temporary directory prefix**: consistent `tf-<test-scope>-` naming (`tf-pl-test-`, `tf-js-test-`, `tf-srv-test-`, `tf-dbutils-`, `tf-config-test-`, etc.)
- **Isolated per-describe-block DB**: Inner `describe` blocks create their own `db` and `tmpDir` scoped to `beforeEach`/`afterEach` (see `pipeline.test.ts` "Versioning invariants" nested describe)
- `await server.ready()` called in `beforeEach` after registering routes

**Edge case tests:**
- Testing null/undefined inputs: `safeJsonParse(null, {})`, `safeJsonParse(undefined, "default")`
- Testing boundary values: `bpm: 9999` failing validation, max retry attempts, truncation limits
- Testing negative/edge pagination: `limit: "-5"`, `offset: "-1"`
- Testing nonexistent resources: `"nonexistent-id"`, `"ghost"`, `"nowhere"`
- Testing cancellation/idempotency: `double abort is safe`, `cleanupJob does not throw for unknown`

## Integration-style Tests

**Server route testing via Fastify `inject`:**
```typescript
// apps/server/__tests__/jobs.test.ts
import Fastify from "fastify";
import { registerJobRoutes } from "../src/routes/jobs.js";

describe("Jobs routes", () => {
  let server: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    db = createDb(join(tmpDir, "test.db"));
    server = Fastify();
    registerJobRoutes(server, createTestDeps(db));
    await server.ready();
  });

  afterEach(async () => {
    await server.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("POST /api/jobs creates a job", async () => {
    const res = await server.inject({
      method: "POST",
      url: "/api/jobs",
      payload: { genreId: "edm", presetId: "deep_house_chill", inputs: { ... } },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.id).toBeDefined();
  });
});
```

## Mocking

**Framework:** Vitest built-in (`vi.fn()`, `vi.stubGlobal()`, `vi.restoreAllMocks()`)

**Shared mock factories** (`@track-forge/test-support`):
```typescript
// packages/test-support/src/index.ts

/** Shared mock LLM that returns a canned response */
export function mockLlm(response?: string) {
  const content = response ?? "Mock analysis result for testing.";
  return {
    async complete() {
      return { content, model: "mock", usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 } };
    },
  };
}

/** Shared mock Suno client */
export function mockSuno() {
  return {
    async submit() { return { ids: ["mock-id"], callbackConfigured: false }; },
    async getGenerationStatus() { return { id: "mock-id", status: "completed" as const, audioUrl: "..." }; },
    async waitForCompletion() { return { id: "mock-id", status: "completed" as const, audioUrl: "..." }; },
  };
}

/** Shared minimal mock genre module */
export function mockGenreModule(overrides?: Partial<GenreModule>): GenreModule {
  return {
    id: "test-genre",
    name: "Test Genre",
    inputSchema: null as any,
    defaults: {},
    ...overrides,
  };
}
```

**In-test mocking patterns:**

`vi.fn()` for function mocks:
```typescript
// Inline LLM mock for specific test behavior
let llmCalled = false;
const llm = {
  async complete() {
    llmCalled = true;
    return { content: '{"document":...}', model: "mock", usage: {} };
  },
};
```

`vi.stubGlobal("fetch", mockFetch)` for HTTP mocking:
```typescript
const mockFetch = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ code: 200, msg: "success", data: { taskId: "task-001" } }),
});
vi.stubGlobal("fetch", mockFetch);
```

**Cleaning up mocks:**
- `vi.restoreAllMocks()` in `beforeEach` of suno-client test
- `restoreEnv()` for env variable isolation in `config.test.ts`

**Type casting in mocks:**
- `as any` used extensively for mock objects that don't match exact interfaces:
  ```typescript
  const deps: PipelineDeps = {
    db,
    llm: mockLlm() as any,
    suno: mockSuno() as any,
    config: { ... } as any,
  };
  ```

**What to Mock:**
- External HTTP services (Suno API, LLM API) via `vi.stubGlobal("fetch", ...)`
- Workspace module interfaces (LLM client, Suno client, genre modules) via shared mock factories
- Environment variables explicitly isolated/reset per test

**What NOT to Mock:**
- SQLite database (real temporary file or `:memory:` database created per test)
- Internal pure functions (style compiler, payload generator — tested with real implementations)
- Node.js file system operations (real `mkdtempSync` / `rmSync`)

## Fixtures and Factories

**Test Data:**
```typescript
// Inline fixtures using local variables
const MIN_INPUT: SunoPayloadInput = {
  title: "My Track",
  style: "Deep house with warm pads and groovy bassline",
  excludedStyles: "slow, ballad",
  lyrics: "[Intro]\n(atmospheric pads)\n\n[Drop]\n(groovy beat)",
};

// Helper functions for repeated setup
async function runPipelineAndGetResult() {
  const job = await createJob(db, "test-genre" as GenreId, "test-preset" as PresetId, "{}", null);
  const deps: PipelineDeps = { db, llm: mockLlm() as any, suno: mockSuno() as any, config: { ... } as any };
  const result = await runPipeline(job.id, deps, mockModule);
  return { job, result };
}
```

**Factory functions for server test deps:**
```typescript
function createTestDeps(db: Db, configOverrides: Partial<Config> = {}): PipelineDeps {
  return {
    db,
    llm: mockLlm as any,
    suno: mockSuno as any,
    config: {
      sunoBaseUrl: "https://api.sunomusic.com/v1",
      logLevel: "fatal",
      port: 0,
      llmProvider: "openai",
      llmModel: "gpt-4o",
      ...configOverrides,
    },
  };
}
```

**Location:**
- Shared factories: `packages/test-support/src/index.ts` (published as `@track-forge/test-support`)
- Server test helpers: inlined within each test file
- Pipeline fixtures: inlined within `pipeline.test.ts`

## Coverage

**Requirements:** Not enforced — no coverage thresholds found in config.

**View Coverage:**
```bash
npx vitest run --coverage   # if needed (no config present by default)
```

## Test Types

**Unit Tests:**
- Pure function tests (suno payload generation, style compiler, event bus, abort controller, JSON utils)
- Database CRUD tests (job service, DB creation)
- Config parsing tests
- All found in `packages/core/__tests__/`

**Integration Tests:**
- Fastify route tests using `server.inject()` with real DB
- Pipeline end-to-end tests with mocked LLM/Suno
- Import/export round-trip tests
- All found in `apps/server/__tests__/` and the E2E sections of `packages/core/__tests__/pipeline.test.ts`

**Snapshot Tests:**
- Suno payload snapshots: `packages/core/__tests__/__snapshots__/suno-payload.test.ts.snap`
- Suno client snapshots: `packages/core/__tests__/__snapshots__/suno-client.test.ts.snap`

**Smoke Tests:**
- Basic vitest verification for web workspace: `apps/web/__tests__/smoke.test.ts`

## Common Patterns

**Async Testing:**
```typescript
it("creates a pending job", async () => {
  const job = await createJob(db, "edm" as GenreId, "deep_house_chill" as PresetId, "{}", null);
  expect(job.id).toBeDefined();
  expect(job.status).toBe("pending");
});
```

**Error Testing:**
```typescript
// Expect reject with specific error
await expect(
  findRowOr404(db, schema.projects, eq(schema.projects.id, "nonexistent"), "Project"),
).rejects.toThrow(ApiError);

// Match error properties
await expect(
  findRowOr404(db, schema.projects, eq(schema.projects.id, "nonexistent"), "Project"),
).rejects.toMatchObject({ statusCode: 404, message: "Project not found" });

// Expect sync throw
expect(() => loadConfig(tmpDir)).toThrow();

// Client throwing
await expect(client.submit({ ... })).rejects.toThrow("Suno API error");
```

**Snapshot Testing:**
```typescript
it("minimal input", () => {
  const result = generateSunoPayload(MIN_INPUT);
  expect(result).toMatchSnapshot();
});
```

**Temporary Directory Pattern (used in ~75% of tests):**
```typescript
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

let tmpDir: string;
beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "tf-prefix-"));
});
afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});
```

**Real Database Pattern:**
```typescript
import { createDb } from "../src/db/index.js";
import type { Db } from "../src/db/index.js";

let db: Db;
beforeEach(() => {
  db = createDb(join(tmpDir, "test.db"));  // File-based
  // or
  db = createDb(":memory:");  // In-memory (used only in db.test.ts)
});
```

**Environment Isolation (config tests):**
```typescript
function isolateEnv() {
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
}
function restoreEnv() {
  for (const k of ENV_KEYS) {
    if (saved[k] !== undefined) process.env[k] = saved[k];
    else delete process.env[k];
  }
}
beforeEach(() => isolateEnv());
afterEach(() => restoreEnv());
```

---

*Testing analysis: 2026-07-19*
