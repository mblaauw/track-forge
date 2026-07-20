# track-forge-ui-session

Preact session state, panel layout, SSE-driven forge strip, and autosave behavior.

## Use for

- Preact state (`SessionProvider`, `useSession()`)
- `ComposeShell` (orchestrates forge, SSE subscriptions, take auto-creation)
- Setup/Bundle/Renders/Library panels
- descriptor loading (`fetchDescriptorDefaults` → seed tags)
- SSE events → forge strip progression
- automatic take creation after versioning completes
- session restoration (hash router `#/session/:id`)
- audio controls (play/stop/favorite takes)
- mobile/responsive layout

## Authoritative session state

`SessionProvider` in `apps/web/src/lib/session.tsx` owns all UI state. Views read via `useSession()` and write via `setSession(patch)`.

### Key state fields

| Field                                                | Source                              | Notes                                                                              |
| ---------------------------------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------- |
| `genreId`                                            | defaults to `"edm"`                 | Changed via SetupColumn genre card                                                 |
| `presetId` / `presetIds`                             | fetched from API                    | Seed after genre change                                                            |
| `tags`                                               | YAML descriptor defaults            | 5 defaults seeded from API on first load                                           |
| `sections`                                           | YAML arrangement defaults           | Populated by `defaultSections()` in `arrangement.ts` (to be moved to YAML per #75) |
| `lyricsMode`                                         | defaults to `"strict_instrumental"` | Updated when genre/preset changes                                                  |
| `forgeRunning` / `forgeStageIdx` / `forgeStageLabel` | SSE-driven                          | Updated by `connectJobEvents`                                                      |
| `takes`                                              | fetched after versioning            | Auto-refreshed via `fetchTakes`                                                    |
| `jobId`                                              | set after `createJob`               | Cleared on new session                                                             |

## SSE event → state transitions

Map of SSE events to session state changes in `ComposeShell.tsx`:

| SSE event                | State change                                           |
| ------------------------ | ------------------------------------------------------ |
| `compilation started`    | `forgeStageIdx: 0`, label: "Composing arrangement"     |
| `lyrics_writing started` | `forgeStageIdx: 1`, label: "Writing lyrics"            |
| `versioning started`     | `forgeStageIdx: 2`, label: "Finalizing bundle"         |
| `suno_render started`    | `forgeStageIdx: 3`, label: "Rendering with Suno"       |
| `suno_render_complete`   | `forgeRunning: false`, `forgeStageIdx: 4`, fetch takes |
| `suno_render_error`      | `forgeRunning: false`, forge strip clears              |

## Autosave

`ComposeShell` calls `updateJobInputs()` with an 800ms debounce on session state changes. Only fires when `jobId` is set (first forge creates the job row). Manual `PATCH /api/jobs/:id/inputs` is available for direct saves.

## Panel ownership

| Panel   | File               | Owns                                                           |
| ------- | ------------------ | -------------------------------------------------------------- |
| Setup   | `SetupColumn.tsx`  | Genre, preset, lyrics, tempo/key, descriptors, reference cards |
| Bundle  | `BundleCanvas.tsx` | Title, style console, arrangement structure, arrangement       |
| Renders | `RendersPanel.tsx` | Take cards with waveforms                                      |
| Library | `LibraryPanel.tsx` | Session archive, restore, delete                               |

## Rule

**A UI state transition that depends on a server event requires a browser test, not only a component unit test.** The forge flow (SSE → state → panel updates) must be verified via Playwright.

## Test selectors

When writing browser tests, prefer:

- `page.getByRole("button", { name: /pattern/i })` for buttons
- `page.getByText("Exact Label")` for labels
- `page.locator("[data-testid='xxx']")` when semantic selectors are insufficient

Use `data-testid` attributes only when role/text selectors can't distinguish the element.
