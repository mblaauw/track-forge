# Coding Conventions

**Analysis Date:** 2026-07-15

## Naming Patterns

**Files:**
- `kebab-case.ts` for source files (e.g., `job-service.ts`, `prompt-assembler.ts`, `genre-config.ts`, `critic-runner.ts`)
- `PascalCase.tsx` for Preact components (e.g., `AppShell.tsx`, `NavRail.tsx`, `TransportBar.tsx`, `AutoSaveIndicator.tsx`)
- Test files mirror source: `__tests__/<name>.test.ts` co-located at package `__tests__/` directory

**Functions:**
- `camelCase` for all function names
- Factory functions prefixed with `create`: `createDb()`, `createJob()`, `createLlmClient()`, `createSunoClientConfig()`, `createAbortController()`
- Helper/accessor functions: `loadJob()`, `parseFindings()`, `getJobEvents()`, `serializeLyrics()`, `loadConfig()`
- Stage handler functions named `handle<Stage>`: `handleRefInterpretation()`, `handlePlanning()`, `handleWriting()` (in `packages/core/src/pipeline/orchestrator.ts`)
- React hooks prefixed with `use`: `useRouter()`, `useSession()`, `useAutosave()`
- Event callbacks: `subscribe()`, `publish()`, `unsubscribeAll()` (in `packages/core/src/pipeline/events.ts`)
- Renderers named as: `renderTitle()`, `renderStyle()`, `renderExcludedStyles()`, `renderLyrics()` (in genre packages)
- Test helper functions use short names: `mockLlm()`, `mockSuno()`, `makeBlueprint()`, `makeClient()`

**Variables:**
- `camelCase` for all variable names
- Constants in `UPPER_SNAKE_CASE`: `CONFIG_FILENAME`, `STAGE_ORDER`, `EVENT_TTL_MS`, `JSON_ARRAY_RE`, `MIN_CONFIG`
- Enums/const maps use PascalCase keys with camelCase values: `GenerationStage.RefInterpretation = "ref_interpretation"`
- Module-level singletons prefixed with underscore: `_refCache` (in `packages/core/src/pipeline/orchestrator.ts`)
- Boolean flags: `isFavorite`, `isInstrumental`, `isError`, `hasActiveJob`, `hasMore`

**Types:**
- `PascalCase` for all type/interface names
- Interfaces use plain names without `I` prefix: `Job`, `Config`, `PipelineDeps`, `LlmClient`, `SunoArtifact`
- Type aliases for branded IDs: `JobId`, `VersionId`, `GenreId`, `PresetId`, `SourceHash`
- Union types: `GenerationStage`, `JobStatus`, `LyricsFormat`, `CriticSeverity`, `PatchType`
- Generic type parameters: `TInputs`, `TBlueprintData` (in `GenreModule`)

## Code Style

**Formatting:**
- Prettier with zero config (standard defaults). No `.prettierrc` file exists.
- Run via: `npx prettier --check .`
- Single quotes for strings in `.ts`/`.tsx` files
- Semicolons required
- 2-space indentation
- Trailing commas in multiline objects/arrays

**Linting:**
- No ESLint or Biome configuration found. TypeScript compiler (`tsc --noEmit`) is the only static analysis tool.
- Run via: `npm run lint` which executes `tsc --noEmit`

**TypeScript:**
- `strict: true` in `tsconfig.base.json`
- `noUncheckedIndexedAccess: true` — use optional chaining or non-null assertions (`!`)
- `exactOptionalPropertyTypes: false`
- `isolatedModules: true` — all re-exports must use `export type` for types
- `module: ESNext` with `moduleResolution: bundler`
- All source files use `.js` extensions in relative imports (e.g., `import { createDb } from "../db/index.js"`)
- Barrel exports via `index.ts` files in each subdirectory

**Type vs interface imports:**
- `import type` for type-only imports: `import type { Config } from "@track-forge/contracts";`
- Regular `import` for value imports: `import { createDb } from "../src/db/index.js";`
- Mixed import style: `import type { GenreModule } from "@track-forge/genre-core"; import { computeBars } from "@track-forge/genre-core";` (separate lines)
- Inline `type` keyword for mixed imports when types and values come from same module: `import { schema, type Db } from "../src/db/index.js";` or `import type { PipelineDeps } from "../src/pipeline/types.js"; import { runPipeline } from "../src/pipeline/orchestrator.js";`

## Import Organization

**Order:**
1. Third-party library imports (`vitest`, `fastify`, `drizzle-orm`, `zod`, `preact`)
2. Workspace package imports (`@track-forge/*`)
3. Local relative imports (`../src/db/index.js`, `./types.js`)
4. Node.js built-ins (`node:fs`, `node:path`, `node:os`, `node:crypto`)

**Path Aliases:**
- No TypeScript path aliases used in the project
- Workspace packages referenced by npm package name: `@track-forge/contracts`, `@track-forge/core`
- All local imports use relative paths with `.js` extension
- Between packages, imports use the package name from `package.json`: `"@track-forge/contracts": "*"`

**Barrel Files:**
- Each package has a `src/index.ts` that re-exports public API
- Subdirectories also have `index.ts` barrels (e.g., `src/db/index.ts`, `src/pipeline/index.ts`, `src/suno/index.ts`, `src/llm/index.ts`, `src/lyrics/index.ts`)
- Pattern: `export { ... } from "./db/index.js"; export type { ... } from "./db/index.js";`

## Error Handling

**Patterns:**
- **Try/catch with throw:** Functions throw `Error` instances with descriptive messages. Example: `throw new Error(`Job ${jobId} not found`)` in `packages/core/src/pipeline/job-service.ts`
- **Graceful fallback:** Parse functions wrap `JSON.parse` in try/catch and return defaults on failure. Example: `parseFindings()`, `parseInterpretation()`, `parseControlDescriptors()`
- **Nullable returns:** Functions return `null` for not-found cases: `loadJob()` returns `Job | null`
- **Result objects:** Pipeline orchestrator returns `{ success, job, version, ... }` result objects with success flag
- **Error propagation:** Pipeline errors propagate up through the stage handler chain
- **Env var parsing:** `envInt()` returns `undefined` on parse failure, caller falls back to default
- **Zod validation:** Config schema and input schemas use `safeParse()` for validation, returning details on failure
- **Fastify error replies:** Server routes return structured `{ error, details? }` JSON with appropriate HTTP status codes (400, 404, 500)
- **Type assertions:** `as` casts used sparingly, primarily for branded types (`as JobId`, `as GenreId`) and mock objects (`as any` in tests)

**Patterns to avoid (anti-patterns observed):**
- `as any` casts appear in test code for mock objects — this is accepted for test convenience but should not appear in production code
- `JSON.parse` calls on DB columns are not always wrapped in try/catch — some callers risk runtime parsing errors

## Logging

**Framework:** `pino` (`^9.6.0`)

**Patterns:**
- Structured logging with `{ requestId, ... }` context objects
- `LlmLogger` interface defines `debug`, `info`, `warn`, `error` methods with structured object + string message
- LLM client logs request/response pairs with truncated content (500 chars for response, 2000 for reasoning)
- Server routes use Fastify's built-in request logging
- Genre config loading uses `console.warn` for warnings
- Log levels: `trace`, `debug`, `info`, `warn`, `error`, `fatal`

## Comments

**When to Comment:**
- Section headers use `// ── Section name ─────────────────────` banners (80 chars total, ── padding)
- JSDoc/TSDoc for public API surfaces: functions, interfaces, complex type parameters
- Inline comments for non-obvious logic, especially in parsers and regex patterns

**JSDoc/TSDoc:**
- `/** Description */` on exported functions and interfaces
- `@param` tags for key parameters
- `@returns` tags where return value semantics could be ambiguous

**Section Banner Pattern:**
```typescript
// ── Stage: Ref Interpretation ─────────────────────────
```

## Function Design

**Size:**
- Stage handlers in orchestrator.ts are ~60-120 lines each
- Pure functions (renderers, validators) are typically 10-40 lines
- Test functions are short and focused: single `it()` block per assertion cluster

**Parameters:**
- Named interfaces for complex parameter sets: `PipelineDeps`, `CriticRunOptions`
- Optional parameters with defaults: `options: CriticRunOptions = {}`
- Destructured parameter objects for configuration
- `Pick<Type, Keys>` for minimized parameter interfaces: `Pick<Config, "llmProvider" | "llmApiKey" | ...>`

**Return Values:**
- Async functions return `Promise<T>` with explicit return types
- Pure synchronous functions for renderers, validators, schema operations
- `Result<T>` pattern not used — instead use null returns or throw

## Module Design

**Exports:**
- Named exports for all functions and classes
- No default exports — consistent use of named exports throughout
- Barrel exports consolidate all public API in `src/index.ts`

**Barrel Files:**
- Present in every subdirectory: `src/db/index.ts`, `src/pipeline/index.ts`, `src/suno/index.ts`, etc.
- Pattern: group by category with section comments

## Preact/JSX Conventions

**Component Style:**
- Functional components with typed props interface
- `export function ComponentName({ ...props }: Props)` pattern (no default export)
- Hooks: `useContext`, `useState`, `useEffect`, `useCallback` imported from `preact/hooks`
- `createContext` from `preact` directly
- Context provider pattern with typed context and default values

**CSS:**
- Custom CSS variables with `:root` tokens in `style.css` (~2000 lines)
- Short aliases defined alongside long names: `--acc` (accent green `#3DDC84`), `--tx` (text `#2D2A24`), `--dim`, `--faint`, `--line2`
- Light theme: `--bg: #FFF1E5`, `--panel: #FFFFFF`
- No CSS-in-JS or CSS modules — plain CSS file

## Workspace Package Patterns

**Genre Modules:** Each genre implements `GenreModule<TInputs, TBlueprintData>` interface from `@track-forge/genre-core`:
- `schema.ts` — Zod input/blueprint schemas
- `presets.ts` — Named presets with partial values
- `renderers.ts` — Title, style, excludedStyles, lyrics renderers
- `validators.ts` — Input and blueprint validators
- `critics.ts` — Critic definitions (fast + full panels)
- `tag-categories.ts` — Style Console tag groups with color suggestions
- `index.ts` — Module export

**Server Routes:** Pattern is `register<Name>Routes(server, deps)`:
- `registerJobRoutes()`, `registerHealthRoutes()`, `registerImportExportRoutes()`, `registerVersionRoutes()`, `registerSunoroutes()`, `registerEventRoutes()`
- Each returns void, mutates the Fastify instance
- Dependencies passed as typed interface: `JobRouteDeps`, etc.

**Database:**
- Drizzle ORM with SQLite via `better-sqlite3`
- Schema defined in `packages/core/src/db/schema.ts` using `sqliteTable()`
- All IDs are string type (UUID generated via `crypto.randomUUID()`)
- Timestamps stored as ISO string in text columns
- JSON stored as text and parsed at read time
- Branded types for IDs: `JobId`, `VersionId`, etc.

---

*Convention analysis: 2026-07-15*
