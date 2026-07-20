# /smoke-forge

Run a deterministic smoke test of the full Forge → Take → Render flow.

## Setup

1. Ensure `@playwright/test` is installed and chromium is available:

   ```
   npx playwright install chromium
   ```

2. Ensure `data/` directory exists:
   ```
   mkdir -p data
   ```

## Controlled environment

The smoke test starts:

- Temporary SQLite database (separate from default `data/track-forge.db`)
- Fake LLM provider (canned lyric responses)
- Fake Suno provider (deterministic submit/status transitions)
- Fastify server on a random port
- Vite dev server or built frontend

## What it verifies

1. **EDM strict instrumental Forge** — no LLM call, version created, take auto-triggered
2. **Hip-Hop vocal Forge** — LLM lyrics writing, version persists, take submitted
3. **Ambient vocal Forge** — genre-specific defaults, version appears
4. **Version appears** in the versions list after forge completes
5. **Take is automatically created** after versioning stage
6. **Render completes** — status transitions from pending → complete
7. **Audio result** appears in the UI
8. **Library reload** retains the session

## Usage

```bash
npm run build  # first build all packages
npx playwright test e2e/forge-edm-instrumental.spec.ts
npx playwright test e2e/forge-hiphop-vocal.spec.ts
npx playwright test e2e/forge-ambient.spec.ts
```

Or run all smoke tests:

```bash
npx playwright test e2e/
```

## After

- Check all steps passed
- If a step failed, inspect the Playwright trace:
  ```
  npx playwright show-report
  ```
- Do not claim success if any verification step failed
