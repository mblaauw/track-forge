# Technology Stack

**Analysis Date:** 2026-07-19

## Languages

**Primary:**
- TypeScript 5.7+ — entire codebase (server, frontend, contracts, genre modules, tests)
- Config: `tsconfig.base.json` targets ES2022, module ESNext, moduleResolution bundler

**Secondary:**
- YAML — genre configuration data in `config/genres/*.yaml` (EDM, hip-hop, ambient)
- CSS — frontend styles in `apps/web/src/style.css`
- HTML — SPA shell at `apps/web/index.html`

## Runtime

**Environment:**
- Node.js >=22 (enforced via `package.json` engines field)

**Package Manager:**
- npm workspaces (strict `allowScripts` for `better-sqlite3` and `esbuild`)
- Lockfile: `package-lock.json` (3981 lines)
- 8 workspaces under `apps/*` and `packages/*`

## Frameworks

**Core:**
- Fastify ^5.2.0 — HTTP server framework (`apps/server/src/index.ts`)
- Preact ^10.25.0 — UI library for the SPA (`apps/web/src/main.tsx`)

**Validation:**
- Zod ^3.24.0 — shared schemas in `packages/contracts`, all genre module input schemas

**Database ORM:**
- Drizzle ORM ^0.38.0 — SQLite query builder with typed schema (`packages/core/src/db/`)

**Testing:**
- Vitest ^3.0.0 — test runner across all workspaces (`vitest.config.ts`)
  - Run: `npm test` (all) or `npm run -w <workspace> test` (single)
  - Config: project-based discovery via `vitest.config.ts`
  - Supports `npx vitest run --project '@track-forge/core'` for single-package runs

**Build/Dev:**
- TypeScript ^5.7.0 — `tsc --build` for incremental project references (`tsconfig.json`)
- Vite ^6.0.0 — frontend bundler with HMR (`apps/web/vite.config.ts`)
- `@preact/preset-vite` ^2.10.0 — Preact JSX transform for Vite
- tsx — TypeScript execution for dev server (`npx tsx watch src/index.ts`) and CLI (`npx tsx src/cli.ts`)
- esbuild ^0.25.12 — transitive build dependency (allowed script)

## Key Dependencies

**Critical:**
- `better-sqlite3` ^12.0.0 — synchronous SQLite3 driver (`packages/core/src/db/index.ts`)
- `drizzle-orm` ^0.38.0 — typed ORM over better-sqlite3 (`packages/core/src/db/`)
- `zod` ^3.24.0 — runtime validation for config, contracts, and genre inputs (all packages)
- `pino` ^9.6.0 — structured logging (server + core)

**Server-specific:**
- `fastify` ^5.2.0 — HTTP server and router (`apps/server/src/index.ts`)
- `js-yaml` ^5.2.1 — YAML parsing for genre configs (`apps/server/src/lib/genre-config.ts`)

**Frontend-specific:**
- `preact` ^10.25.0 — DOM rendering (`apps/web/src/main.tsx`)
- `@phosphor-icons/react` ^2.1.10 — icon set (`apps/web/src/components/compose/`)

## Configuration

**Environment (all TRACK_FORGE_* env vars override the config file):**
- `TRACK_FORGE_SUNO_BASE_URL` — Suno API base URL
- `TRACK_FORGE_SUNO_AUTH_TOKEN` — Suno API auth token
- `TRACK_FORGE_PUBLIC_BASE_URL` — public URL for callback webhooks
- `TRACK_FORGE_DB_PATH` — SQLite database path (default: `./data/track-forge.db`)
- `TRACK_FORGE_LOG_LEVEL` — pino log level (default: info)
- `TRACK_FORGE_PORT` — server port (default: 3000)
- `TRACK_FORGE_HOST` — server host (default: 127.0.0.1)
- `TRACK_FORGE_STATIC_DIR` — production static file directory
- `TRACK_FORGE_LLM_PROVIDER` — LLM provider (openai/anthropic/ollama/openai-compatible)
- `TRACK_FORGE_LLM_API_KEY` — LLM API key
- `TRACK_FORGE_LLM_BASE_URL` — custom LLM base URL
- `TRACK_FORGE_LLM_MODEL` — model name (default: gpt-4o)

**Config file:**
- `track-forge.config.js` (gitignored, ESM module exporting default object)
- Parsed via `new Function()` workaround in `packages/core/src/config.ts`

**Frontend env:**
- `VITE_API_BASE` — optional API base override on `apps/web/src/api.ts`

**Build:**
- Root `tsconfig.json` with project references to all 8 workspaces
- Base config: `tsconfig.base.json` (ES2022, ESNext, bundler resolution, composite)
- Per-workspace `tsconfig.json` extends the base

## Platform Requirements

**Development:**
- Node.js >=22
- npm (for `allowScripts` support with native modules)
- `data/` directory must exist at DB path (default: `./data/`)

**Production:**
- Node.js >=22
- SQLite3 support (via better-sqlite3 native addon)
- Accessible Suno API endpoint and LLM API endpoint
- `data/` directory writable at configured DB path

---

*Stack analysis: 2026-07-19*
