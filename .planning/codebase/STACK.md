# Technology Stack

**Analysis Date:** 2026-07-15

## Languages

**Primary:**
- TypeScript 5.7+ (strict mode, ES2022 target) — all source code across all workspaces
- JavaScript (.js config files) — `track-forge.config.js` build config only

**Secondary:**
- YAML — genre preset definitions in `config/genres/*.yaml`

## Runtime

**Environment:**
- Node.js >=22 (engine requirement in root `package.json`)
- Full ESM throughout (`"type": "module"` in every `package.json`)
- No Docker containerization detected

**Package Manager:**
- npm workspaces (monorepo with `apps/*` + `packages/*`)
- Lockfile: `package-lock.json` present
- No pnpm, yarn, or turbo detected

**Dev Server:**
- `tsx` (esbuild-powered TypeScript runner) — `apps/server/src/index.ts` via `npm run -w apps/server dev`
- `vite` dev server — `apps/web` via `npm run -w apps/web dev`, proxies `/api` → `http://localhost:3000`

## Frameworks

**Core Backend:**
- **Fastify ^5.2.0** — HTTP server framework (`apps/server`)
- **Pino ^9.6.0** — Structured JSON logging (used in both server and core)

**Core Frontend:**
- **Preact ^10.25** — Virtual DOM library with `react-jsx` JSX transform (`apps/web`)
- **Vite ^6.0** — Build tool and dev server, with `@preact/preset-vite` plugin
- **Phosphor Icons** (`@phosphor-icons/react` ^2.1.10, `@phosphor-icons/core` ^2.1.1) — Icon library

**Testing:**
- **Vitest ^3.0** — Test runner across all workspaces
- Config: root `vitest.config.ts` with `projects: ["packages/*", "apps/*"]`

**Database:**
- **better-sqlite3 ^12.0.0** — Synchronous SQLite driver (`packages/core`)
- **drizzle-orm ^0.38.0** — Type-safe ORM / query builder (`packages/core`)
- No migrations framework — schema is auto-created via `CREATE TABLE IF NOT EXISTS` + migration `ALTER TABLE` blocks in `packages/core/src/db/index.ts`

**Validation:**
- **Zod ^3.24.0** — Runtime schema validation (`packages/contracts`, used throughout)

## Key Dependencies

**Critical Production Dependencies:**

| Package | Version | Purpose | Used In |
|---------|---------|---------|---------|
| `fastify` | ^5.2.0 | HTTP server | `apps/server` |
| `preact` | ^10.25 | UI framework | `apps/web` |
| `better-sqlite3` | ^12.0.0 | SQLite driver (native addon) | `packages/core` |
| `drizzle-orm` | ^0.38.0 | ORM / query builder | `packages/core` |
| `zod` | ^3.24.0 | Schema validation | All packages |
| `pino` | ^9.6.0 | Structured logging | `apps/server`, `packages/core` |
| `js-yaml` | ^5.2.1 | YAML config parsing | `apps/server` |
| `@phosphor-icons/react` | ^2.1.10 | UI icons | `apps/web` |

**Development Dependencies:**

| Package | Version | Purpose |
|---------|---------|---------|
| `typescript` | ^5.7.0 | TypeScript compiler |
| `vitest` | ^3.0.0 | Test runner |
| `@preact/preset-vite` | ^2.10.0 | Preact JSX for Vite |
| `vite` | ^6.0.0 | Frontend bundler |
| `tsx` | (npx) | TypeScript execution for dev |
| `prettier` | (latest via npx) | Code formatting (no config file — uses defaults) |

## Configuration

**Environment:**
- Custom config loader at `packages/core/src/config.ts` (no `dotenv` used)
- Reads `track-forge.config.js` from CWD (ESM file, gitignored)
- Environment variables with `TRACK_FORGE_*` prefix override file config
- Config validated through Zod `ConfigSchema` from `@track-forge/contracts`

**Build:**
- TypeScript project references for incremental builds (`tsc --build` with `composite: true`)
- Root `tsconfig.json` references 8 workspace tsconfigs
- Base config: `tsconfig.base.json` with `target: ES2022`, `module: ESNext`, `moduleResolution: bundler`
- Build artifacts (`.js`/`.d.ts`/`.js.map`/`.d.ts.map`) emitted beside source (gitignored)

**CI** (`.github/workflows/ci.yml`):
- Node 22, Ubuntu latest, npm cache
- Two jobs: `check` (tsc --build + vitest + prettier --check) and `lint` (tsc --noEmit)

## Workspace Dependency Graph

```
@track-forge/contracts   (Zod schemas, branded IDs, types)
       ↑
@track-forge/genre-core  (GenreModule interface)
       ↑
@track-forge/genre-edm   │  @track-forge/genre-hiphop  │  @track-forge/genre-pop
@track-forge/genre-ambient  │  @track-forge/genre-dnb
       ↑
@track-forge/core        (Pipeline engine, DB, LLM/Suno clients)
       ↑
@track-forge/server      (Fastify routes, config, static serving)
@track-forge/web         (Preact SPA, genre UI modules)
@track-forge/test-support (Shared test helpers)
```

## Platform Requirements

**Development:**
- Node.js >=22
- npm (bundled with Node)
- better-sqlite3 requires native compilation (allowed via `allowScripts` in root `package.json`)
- Genre config files in `config/genres/*.yaml` (version-controlled)

**Production:**
- Node.js >=22 runtime
- `data/` directory must exist for SQLite database (default: `./data/track-forge.db`)
- Optional: `track-forge.config.js` for custom config
- No Docker image provided
- Static GUI files built by `@track-forge/web` served by the server when `staticDir` is configured

---

*Stack analysis: 2026-07-15*
