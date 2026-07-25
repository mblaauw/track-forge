> **Deprecated — this file is superseded by [`AGENTS.md`](AGENTS.md).** Claude Code reads `AGENTS.md` as well, so all project guidance, architecture, invariants, and configuration live there now. This file exists only for backward compatibility with older Claude Code sessions that reference it directly.

## Commands

```bash
npm ci
npm run build                                    # tsc -b all packages (force) + web build
npm test                                         # vitest run (all workspaces)
npm run test:watch                               # vitest watch mode
npx vitest run <path/to/file.test.ts>            # single test file
npx vitest run -t "<test name>"                  # single test by name
npm run lint                                     # tsc --noEmit
npm run clean                                    # remove dist/, .tsbuildinfo, generated test artifacts
node scripts/validate-genres.mjs                 # validate config/genres/*.yaml
node scripts/check-architecture.mjs              # fail if removed systems/stage names resurface

SUNO_DRY_RUN=true npm run -w apps/server dev      # Fastify on :3000, skips real Suno calls
npm run -w apps/web dev                           # Vite on :5173, proxies /api → :3000

npx playwright test                               # full E2E suite (needs server+web running)
npx playwright test e2e/forge-edm-instrumental.spec.ts   # single E2E spec
npx playwright show-report                        # inspect a failed Playwright trace
```

Full verification order (mirrors CI, run before declaring anything done):

```bash
npm run clean && npm run build && npm test && npx prettier --check . && npx tsc --noEmit && node scripts/validate-genres.mjs
```

If server/web/session code changed, also run `npx playwright test e2e/`.
