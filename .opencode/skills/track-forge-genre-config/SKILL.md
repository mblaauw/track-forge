# track-forge-genre-config

Genre configuration as YAML data. This is the most important skill for ongoing feature development.

## Use for

- adding or changing genres
- adding presets (EDM, Hip-Hop, Ambient, or new genres)
- vocabulary changes (tag categories, descriptors, delta palette, section palette)
- descriptor defaults and weights
- arrangement defaults (when moved to YAML per issue #75)
- vocal-section behavior (vocal presets, lyrics mode defaults)
- genre UI fields (name, color, subgenre count)

## The rule

**Genre content is data first.** Do not introduce a TypeScript catalogue, renderer, critic, or duplicate frontend default when YAML can express it. The TypeScript genre modules are reduced to `createGenreModule({ id, name, inputSchema, defaults })`.

YAML files live in `config/genres/<id>.yaml`. Served via:

- `GET /api/genres` — list
- `GET /api/genres/:id/descriptor-defaults` — categories, defaults, lyric themes, functions, palette, vocal presets
- `GET /api/genres/:id/presets`
- `GET /api/genres/:id/tag-categories`

## YAML authoring checklist

For every change:

1. Validate YAML syntax: `node scripts/validate-genres.mjs`
2. Validate against the genre-config schema (see `apps/server/src/lib/genre-config.ts`)
3. Check all preset IDs are unique within the file
4. Check referenced descriptor category IDs exist (`sound`/`rhythm`/`atmosphere`/`production`/`energy`)
5. Check BPM ranges are within 40–220
6. Check default values are valid options (scale, lyricsMode)
7. Check arrangement section functions are recognized (`establish`/`introduce`/`escalate`/`contrast`/`remove`/`peak`/`resolve`)
8. Check vocal flags and lyrics mode are coherent (no "strict_instrumental" with vocal sections)
9. Check frontend API response: `GET /api/genres/:id/descriptor-defaults`
10. Run `npm run build && npm test`
11. Run relevant API tests (server `__tests__/jobs.test.ts`)

## Validating genres

```
node scripts/validate-genres.mjs
```

This detects:

- duplicate preset or descriptor IDs
- dangling references
- invalid BPM ranges
- unknown tag categories
- invalid descriptor weights (must be 1–3)
- empty labels
- duplicate vocabulary
- incompatible vocal/arrangement defaults

## Edit workflow

Use the `/edit-genre` command for a structured workflow.
