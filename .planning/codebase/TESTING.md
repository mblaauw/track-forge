# Testing Patterns

**Analysis Date:** 2026-07-15

## Test Framework

**Runner:**
- Vitest v3 (workspace root config at `vitest.config.ts`)
- Config: `vitest.config.ts` with workspace mode scanning `packages/*` and `apps/*`

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    projects: ["packages/*", "apps/*"],
  },
});
```

**Assertion Library:**
- Vitest built-in `expect`

**Run Commands:**
```bash
npm test                    # vitest run (all workspaces — 249+ tests, ~2s)
npm run test:watch          # vitest (interactive watch mode)
npm run -w <workspace> test # vitest run in single workspace
npx vitest run --project '@track-forge/core' # single package via vitest project name
npx vitest run --reporter=verbose             # verbose output
```

## Test File Organization

**Location:**
- `__tests__/` directory at the package root level (not co-located with source)
- Every workspace has exactly one `__tests__/` directory

**Naming:**
- `<module>.test.ts` pattern (e.g., `pipeline.test.ts`, `job-service.test.ts`, `suno-client.test.ts`)
- No `.spec.ts` or `.test.tsx` files used
- Frontend: `apps/web/__tests__/smoke.test.ts` (only one test file for web)

**Structure:**
```
packages/core/__tests__/
├── canonical.test.ts
├── config.test.ts
├── critic-runner.test.ts
├── db.test.ts
├── events.test.ts
├── generative-invariants.test.ts
├── job-abort-controller.test.ts
├── job-service.test.ts
├── lyrics-patcher.test.ts
├── pipeline.test.ts
├── prompt-assembler.test.ts
├── reference-cache.test.ts
├── reference-interpreter.test.ts
├── suno-client.test.ts
└── suno-payload.test.ts

packages/contracts/__tests__/
└── config-schema.test.ts

packages/genre-edm/__tests__/
├── presets.test.ts
├── renderers.test.ts
├── taxonomy.test.ts
└── validators.test.ts

packages/genre-hiphop/__tests__/
├── presets.test.ts
├── renderers.test.ts
├── taxonomy.test.ts
└── validators.test.ts

apps/server/__tests__/
├── health.test.ts
├── jobs.test.ts
└── import-export.test.ts

apps/web/__tests__/
└── smoke.test.ts
```

**Missing test files:** `packages/genre-pop`, `packages/genre-ambient`, and `packages/genre-dnb` have no test files. `packages/test-support` has an empty source file with no tests.

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";

describe("Component name", () => {
  let sharedState: Type;

  beforeEach(() => {
    // Setup — create temp dir, DB, mocks
  });

  afterEach(() => {
    // Teardown — clean temp dir
  });

  it("describes expected behavior", () => {
    // Arrange, Act, Assert
    expect(result).toBe(expected);
  });
});
```

**Patterns:**
- **Setup:** `beforeEach` creates temp directories via `mkdtempSync` + `join(tmpdir(), "tf-<test>-")` and creates DB via `createDb()`. Mocks are constructed fresh in each test or via helper factories.
- **Teardown:** `afterEach` runs `rmSync(tmpDir, { recursive: true, force: true })` to clean up. Server tests also call `await server.close()`.
- **Assertion:** `expect(result).toBe(expected)` for primitives, `toEqual()` for objects/arrays, `toContain()` for strings/arrays, `toHaveLength()`, `toBeDefined()`, `toBeNull()`, `toBeGreaterThan()`, toMatchSnapshot().

**Nested `describe` blocks:**
- Used for grouping related tests within a module: `describe("parseFindings", ...)`, `describe("applyLyricsPatch", ...)`, `describe("Versioning invariants", ...)`
- Nested for validator sub-groups: `describe("EDM validators")` → `describe("input validator")`

## Mocking

**Framework:** Vitest's built-in mocking (`vi.fn()`, `vi.stubGlobal()`, `vi.restoreAllMocks()`)

**Patterns:**

**Mock helpers (factory functions):**
```typescript
// Simple mock LLM — returns canned response
function mockLlm(response?: string) {
  const content = response ?? "Mock result.";
  return {
    async complete() {
      return { content, model: "mock", usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 } };
    },
  };
}

// Minimal mock Suno client
function mockSuno() {
  return {
    async submit() { return { ids: ["mock-id"], callbackConfigured: false }; },
    async getGenerationStatus() { return { id: "mock-id", status: "completed", audioUrl: "..." }; },
    async waitForCompletion() { return { id: "mock-id", status: "completed", audioUrl: "..." }; },
  };
}

// Mock genre module (with required fields only)
const mockModule: GenreModule = {
  id: "test-genre",
  inputSchema: null as any,
  renderers: { title: () => "Mock Title", ... },
  critics: { fast: { ... }, full: [] },
  validators: { input: () => [], blueprint: () => [] },
  // ... other required fields
};
```

**HTTP mocking:**
```typescript
// Mock fetch for Suno API calls
const mockFetch = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ code: 200, msg: "success", data: { taskId: "task-001" } }),
});
vi.stubGlobal("fetch", mockFetch);

// Restore after test
beforeEach(() => { vi.restoreAllMocks(); });
```

**What to Mock:**
- External APIs (LLM, Suno) — always mocked with minimal response stubs
- Database — real SQLite via `createDb(:memory:)` or temp file (not mocked)
- `fetch` — mocked via `vi.stubGlobal()` for HTTP client tests
- No test doubles for Zod schemas, pure functions, or renderers

**What NOT to Mock:**
- Drizzle ORM queries — tests use a real SQLite database
- Pure functions (renderers, parsers, formatters) — tested with real implementation
- Zod schemas — tested with `safeParse()` directly
- `crypto.randomUUID()` — not mocked, generates real UUIDs

**Type casting in tests:**
- `as any` used extensively in mock objects to satisfy TypeScript without implementing full interfaces
- `as const` for literal types: `"completed" as const`
- Branded type casting: `"test-genre" as GenreId`, `"test-preset" as PresetId`, `"hash" as SourceHash`

## Fixtures and Factories

**Inline fixtures** (defined at top of test file):
```typescript
const sampleDoc: LyricsDocument = {
  bpm: 140, key: "Am", genre: "Hip-Hop",
  sections: [{ type: "verse", lines: ["line 1", "line 2"], bars: 8, tags: [], instrumental: false }],
  metadata: {},
};
const sampleJson = JSON.stringify(sampleDoc);

const MIN_INPUT: SunoPayloadInput = {
  title: "My Track",
  style: "Deep house with warm pads",
  excludedStyles: "slow, ballad",
  lyrics: "[Intro]\n(atmospheric pads)",
};
```

**Factory functions:**
```typescript
// Genre module test helpers
function makeBlueprint(overrides: Record<string, unknown> = {}) {
  const base = { subgenre: "deep_house", bpm: 120, ... };
  return EdmBlueprintSchema.parse({ ...base, ...overrides });
}

function makeClient() {
  return new SunoClient(MIN_CONFIG, MIN_APP_CONFIG, { child: () => ({ info: () => {} }) } as any);
}

// Server test helper
function createTestDeps(db: Db, configOverrides: Partial<Config> = {}): PipelineDeps {
  return { db, llm: mockLlm as any, suno: mockSuno as any, config: { ...defaults, ...configOverrides } };
}
```

**Location:** All fixtures are defined inline in their test file. No shared fixture files exist.

## Coverage

**Requirements:** Not enforced (no `coverage` threshold in vitest config). Coverage can be viewed via:
```bash
npx vitest run --coverage
```
Note: `@vitest/coverage-v8` may need to be installed first.

**Current estimate:** ~249+ tests across all workspaces, running in ~2s. Core package has the majority (~15 test files). Genre packages are partially tested (EDM and Hip-Hop have full coverage; Pop, Ambient, DnB have no tests).

## Test Types

**Unit Tests:**
- Scope: Individual modules, pure functions, CRUD operations
- Approach: Direct function calls with real dependencies (DB) or mocked dependencies (LLM, Suno)
- Focus on: input validation, parsing, rendering, state transitions, CRUD correctness

**Integration Tests:**
- Scope: Pipeline orchestrator runs full 8-stage pipeline end-to-end
- `pipeline.test.ts` — creates a job, runs `runPipeline()`, verifies version created
- `generative-invariants.test.ts` — real genre modules (hiphop, edm) with mock LLM, verifies artifact content
- `apps/server/__tests__/jobs.test.ts` — Fastify server with `server.inject()` simulating HTTP requests
- `apps/server/__tests__/import-export.test.ts` — full export/import cycle via HTTP injection

**E2E Tests:**
- Not used. No Cypress, Playwright, or browser-based tests.

## Common Patterns

**Async Testing:**
```typescript
it("creates a job", async () => {
  const job = await createJob(db, "edm" as GenreId, "test" as PresetId, "{}", null);
  expect(job.status).toBe("pending");
});
```

**Error Testing:**
```typescript
it("throws on non-200 API response", async () => {
  await expect(client.submit({ ... })).rejects.toThrow("Suno API error");
});

it("returns null for missing job", async () => {
  const result = await loadJob(db, "nonexistent-id" as JobId);
  expect(result).toBeNull();
});
```

**Snapshot Testing:**
```typescript
it("sends POST with expected body", async () => {
  const body = JSON.parse(mockFetch.mock.calls[0][1].body);
  expect(body).toMatchSnapshot();
});
```
Used in `suno-client.test.ts` and `suno-payload.test.ts` for API request body validation.

**DB-backed testing pattern (most common in core):**
```typescript
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

  it("creates a job", async () => {
    const job = await createJob(db, ...);
    expect(job.id).toBeDefined();
  });
});
```

**Roundtrip testing:**
```typescript
it("roundtrips guided instrumental", () => {
  const doc = parseLyrics(GUIDED_INSTRUMENTAL);
  const serialized = serializeLyrics(doc);
  const reparsed = parseLyrics(serialized);
  expect(reparsed.bpm).toBe(doc.bpm);
  expect(reparsed.sections).toHaveLength(doc.sections.length);
});
```

**Server route testing pattern:**
```typescript
describe("Jobs routes", () => {
  let server;
  let db;
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = mkdtempSync(join(tmpdir(), "tf-srv-test-"));
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
    const res = await server.inject({ method: "POST", url: "/api/jobs", payload: { ... } });
    expect(res.statusCode).toBe(201);
  });
});
```

---

*Testing analysis: 2026-07-15*
