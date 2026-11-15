# track-forge-ui-session

Preact session state, the three-zone studio layout, the SSE-driven forge flow, and autosave.

## Use for

- Preact state (`SessionProvider`, `useSession()`)
- the forge flow (`useForge()` in `apps/web/src/lib/forge.ts`: save, start, SSE subscription, take creation)
- the Sound / Song / Output zones and the sessions menu
- genre data loading (`useGenreData()` → seeding a blank session)
- the live prompt preview (`usePromptPreview()`)
- audio controls (play, favourite takes)
- responsive layout
- the design system in `apps/web/src/style.css` and the primitives in `components/studio/ui.tsx`

## Layout

One screen, three zones that follow the work. All components live in `apps/web/src/components/studio/`.

| Zone   | File                                   | Owns                                                                         |
| ------ | -------------------------------------- | ---------------------------------------------------------------------------- |
| Sound  | `SoundZone.tsx`                        | Genre, preset picker, character traits, avoid list, notes                    |
| Song   | `ArrangementPanel.tsx`, `Lyrics.tsx`   | Timeline, section inspector, tempo; vocals switch, lyric brief, lyric lines  |
| Output | `OutputDeck.tsx`, `RenderSettings.tsx` | Forge control and progress, what Suno receives, takes, take settings, player |
| Shell  | `Studio.tsx`, `SessionsMenu.tsx`       | Top bar, session title, sessions menu, zone tabs, blank-session seeding      |

Breakpoints: three columns from 1240px; below that the Song stays and Sound/Output share a side column (tabs in the top bar); below 800px one zone at a time with a Forge dock at the bottom. `session.zone` holds which zone is in front.

## Design system

Tokens are CSS custom properties at the top of `style.css`. Rules that are easy to break:

- Two materials: a light side (ash ground, white sheet) for composing, a dark deck for output. Do not put dark panels on the light side or the reverse.
- Ember (`--ember`) is reserved for the Forge action, running/current states, and the `peak` section family. Do not use it for decoration.
- Section colour comes from `sectionFamily(name)` (`fam-edge|body|turn|lift|peak`), cold to hot. Section height on the timeline comes from the role's `energy` in `SECTION_FUNCTIONS`; width is the section's share of the bars.
- Labels are sentence case at 12px or larger. The mono face is only for prompt and lyric text.
- Input edges use `--control` (3:1 against the page). Text colours are checked for 4.5:1; re-check when changing a token.
- Build controls from `ui.tsx` (`Segmented`, `Switch`, `Popover`, `Field`, `Budget`, toasts) rather than new one-off markup.
- Destructive or sweeping edits offer an undo toast (`useToast`); deleting a session asks inline because it cannot be undone.

## Authoritative session state

`SessionProvider` in `apps/web/src/lib/session.tsx` owns all UI state. Views read via `useSession()` and write via `setSession(patch)`.

| Field                                                | Source                          | Notes                                                    |
| ---------------------------------------------------- | ------------------------------- | -------------------------------------------------------- |
| `genreId`                                            | defaults to `"edm"`             | Changed in the Sound zone                                |
| `presetId` / `presetIds`                             | genre config                    | Empty means a blank session; `Studio.tsx` then seeds it  |
| `tags`                                               | YAML descriptor defaults        | A trait is identified by lane (`cat`) and label together |
| `sections`                                           | preset / genre `song_structure` | Built by `buildSections()` in `arrangement.ts`           |
| `lyricsMode`                                         | preset                          | Vocals switch in the Lyrics panel                        |
| `forgeRunning` / `forgeStageIdx` / `forgeStageLabel` | SSE-driven                      | Set by `useForge()`                                      |
| `status` / `forgeError`                              | SSE-driven                      | `"failed"` shows the reason in the deck                  |
| `takes`                                              | fetched after a forge           | Takes of the newest version only                         |
| `render`                                             | user                            | Per-take Suno settings; sent with `POST /takes`          |
| `jobId`                                              | set after `createJob`           | Cleared on new session                                   |

## SSE event → state transitions (`lib/forge.ts`)

| SSE event              | State change                                                        |
| ---------------------- | ------------------------------------------------------------------- |
| `<stage> started`      | `forgeRunning: true`, `forgeStageIdx` 0–3, label from `FORGE_STEPS` |
| `versioning completed` | step 3, then `POST /takes` for the newest version                   |
| `suno_render_complete` | `forgeRunning: false`, `status: "completed"`, takes refreshed       |
| `suno_render_error`    | `status: "failed"`, `forgeError` set, stream closed                 |
| `<stage> error`        | `status: "failed"`; stream stays open because stages are retried    |

The client starts the job first and subscribes second, passing the `eventCursor` from `POST /start` as `?after=`, so it never replays an earlier run.

## Autosave

`useForge()` calls `updateJobInputs()` with an 800ms debounce on session changes, only when `jobId` is set and no forge is running. A forge always sends the current inputs itself before starting.

## Rule

**A UI state transition that depends on a server event requires a browser test, not only a component unit test.** The forge flow (SSE → state → deck updates) must be verified via Playwright.

## Test selectors

Page objects live in `e2e/pages/`. Prefer:

- `page.getByRole(...)` with the accessible name for buttons, radios and switches
- `data-testid` where a role/name cannot single out the element (`forge-btn`, `forge-status`, `forge-strip`, `forge-error`, `region-<index>`, `bpm-input`, `preset-picker`, `preset-<id>`, `genre-chip-<id>`, `vocals-switch`, `readout-tab-<part>`, `readout-text`, `take-card-<id>`, `sessions-button`, `library-row-<jobId>`)
