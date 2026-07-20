# /verify

Run the full repository verification suite.

## Order

1. `npm run clean`
2. `npm run build`
3. `npm test`
4. `npx prettier --check .`
5. `npx tsc --noEmit`
6. `node scripts/validate-genres.mjs`

## After

- Check each step passed; do not continue if any step failed
- Summarize failures if any
- If web/server/session code changed, run related browser tests:

  ```
  npx playwright test e2e/
  ```

## Rules

- Do not claim completion while any step fails
- Include a changed-file coverage assessment in the summary
