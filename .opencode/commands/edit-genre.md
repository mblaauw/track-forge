# /edit-genre

Edit a genre configuration with validation.

## Usage

```
/edit-genre <genre-id>
```

Example: `/edit-genre edm`

## Workflow

1. Load the `track-forge-genre-config` skill
2. Identify the YAML source file: `config/genres/<id>.yaml`
3. Validate YAML syntax before editing
4. Make the change
5. Run genre validation: `node scripts/validate-genres.mjs`
6. Run relevant API tests: `npm test`
7. Verify the frontend displays changes:
   ```
   npm run -w apps/server dev
   npm run -w apps/web dev
   curl http://localhost:3000/api/genres/<id>/descriptor-defaults
   curl http://localhost:3000/api/genres/<id>/presets
   ```
8. Run one E2E flow:
   ```
   npx playwright test e2e/forge-<genre>-instrumental.spec.ts
   ```

## Validation checklist

- [ ] YAML syntax valid
- [ ] No duplicate preset IDs
- [ ] No duplicate descriptor categories
- [ ] All referenced descriptor categories exist (sound/rhythm/atmosphere/production/energy)
- [ ] BPM ranges within 40–220
- [ ] Descriptor weights are 1–3
- [ ] Default values are valid options
- [ ] Lyrics mode and vocal presets are coherent
- [ ] `node scripts/validate-genres.mjs` passes
- [ ] `npm run build && npm test` passes
