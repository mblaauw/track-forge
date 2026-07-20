# /audit-reachability

Audit code reachability — find dead code, unreachable exports, and stale references.

## Usage

```
/audit-reachability [path]
```

Default: scans all source directories (`packages/*/src`, `apps/*/src`).

## What it checks

- **Call graph** — symbols exported but never imported anywhere
- **Import graph** — imports that don't resolve to active entrypoints
- **Route registration** — ensure all routes in `routes/` are registered in `apps/server/src/index.ts`
- **Exported-but-unreachable symbols** — functions/classes not used outside their declaration file
- **Dead files** — `.ts` files not reachable from any entrypoint (`apps/server/src/index.ts`, `apps/web/src/main.tsx`, `apps/server/src/cli.ts`)
- **Old pipeline types** — references to removed stage names, deleted modules
- **Duplicate service implementations** — e.g., two import/export implementations

## Method

1. Use CodeGraph (`codegraph_explore`) for call paths, blast radius, and import chains
2. Confirm findings with `rg` (ripgrep) before any deletion
3. Cross-reference with route registration in entrypoints
4. Check test files aren't the only consumers

## Commands

```bash
# Find all exported symbols
rg "^export (function|const|type|interface|class)" packages/core/src/ --include='*.ts'

# Check if a symbol is imported elsewhere
rg "from.*\.\.\/path\/to\/symbol" --include='*.ts'

# List all route registrations
rg "server\.(get|post|patch|delete|put)\(" apps/server/src/

# List all entrypoint imports
rg "from|import" apps/server/src/index.ts apps/web/src/main.tsx apps/server/src/cli.ts

# Find files not imported by any entrypoint (by checking their exports)
fd '\.ts$' packages/core/src/ --exclude '*.test.ts' --exclude '*.d.ts'
```

## Important

Do not delete anything based on CodeGraph alone. Always confirm with `rg` search. Some symbols may be consumed indirectly (CSS classes, template strings, client-side JS).
