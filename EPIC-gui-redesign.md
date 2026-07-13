# Epic: GUI Redesign + New Feature Suite

**Source:** `TrackForge.dc.html` + `support.js` mockup
**Current stack:** Preact SPA (apps/web) + Fastify API (apps/server) + Core pipeline (packages/core)
**Target:** Full replacement of 3-page UI with 4-view dark shell, plus backend supporting new interactive features

---

## Issue 1: UI Foundation — Shell, Routing & Theme

Replace the current Preact SPA shell with the new 4-view layout. The current app has 3 pages (JobList, CreateJob, JobDetail) with a custom hash router. The new shell centers on a persistent nav rail + transport bar + viewport.

### 1.1 Replace routing system
- **Current:** 3 routes (/ /create /job/:id) via custom hash router in `apps/web/src/lib/router.tsx`
- **New:** 4 views (library, create, forge, studio) with a nav rail to switch between them
- **Changes:**
  - Rewrite `lib/router.tsx` or build a lightweight view dispatcher
  - Views become sibling branches: library, create, forge, studio
  - Studio view needs a job/version param (e.g. `/studio/:jobId` or `/studio/:versionId`)
  - Support deep-linking to specific views
- **Files:** `apps/web/src/lib/router.tsx`, `apps/web/src/app.tsx`

### 1.2 Implement nav rail + transport topbar
- **Nav rail (76px, left):** Track Forge logo, LIB/NEW/RUN/MIX buttons with icons, status dot at bottom
- **Transport topbar (60px):** View code badge, editable project name, genre/preset/bpm·key breadcrumb, level meters (7 animated bars), status text, clock, primary action button
- **CSS variables:** Full dark theme (`#08090B` bg, `#101216` panel, `#3DDC84` accent, amber/cyan/violet/red semantic colors)
- **Animation keyframes:** pulse, blink, float, spark, scan, ring, rise
- **Files:** New `apps/web/src/components/NavRail.tsx`, `apps/web/src/components/TransportTopbar.tsx`, `apps/web/src/components/AppShell.tsx`, `apps/web/src/app.tsx`, `apps/web/src/style.css`

### 1.3 Replace design system CSS
- **Current:** 1004 lines, indigo+green theme (bg `#0F0F23`, accent `#22C55E`)
- **New:** Dark theme (`#08090B` bg, `#3DDC84` accent), Archivo + JetBrains Mono fonts, Phosphor icons
- **Remove old:** Strip current `style.css`, replace with new CSS custom properties and component styles
- **New styles per mockup:** Panel cards, sticky style console, assembly line, library card grid, audio take rows
- **Files:** `apps/web/src/style.css` (full rewrite)

---

## Issue 2: Create View — Genre/Preset & Arrangement Builder

The Create view replaces the current `CreateJob.tsx` generic form with an interactive session composer split into two columns: session setup (left) and style console (right — see Issue 3).

### 2.1 Genre + Preset selection panel
- **Section "01 · Foundation":** Genre grid (EDM, Hip-Hop, Pop, Ambient, DnB with colored icons), preset pills (named per genre), tempo slider (60-180 BPM), key dropdown (C maj → B min, 24 options)
- **Data source:** Pull genres/presets from genre modules (existing `GET /api/genres`) plus the extended DATA structure in the mockup
- **Interaction:** Selecting genre applies first preset; selecting preset fills arrangement + tags + BPM/key defaults
- **Files:** New `apps/web/src/pages/CreateView.tsx`, `apps/web/src/components/GenreSelector.tsx`, `apps/web/src/components/PresetSelector.tsx`, `apps/web/src/components/TempoKeySelector.tsx`

### 2.2 Arrangement builder (visual timeline)
- **Section "02 · Arrangement":** Horizontal bar visualization of song sections
- **Features:**
  - Each section is a colored bar proportional to its bar count
  - Drag to reorder (HTML5 drag and drop)
  - Drag right edge to resize (pointer events, 4-bar snap)
  - Click to select → show editor panel below
- **Selected-section editor:** Show/hide on selection; -bars/+buttons, move left/right arrows, duplicate, remove (red X)
- **Section palette:** Genre-specific section types (Intro/Build/Drop/Break/Outro for EDM, Verse/Hook/Bridge for Hip-Hop, etc.) with + button to append
- **Estimates:** Total bars display, estimated duration based on BPM
- **Backend impact:** Arrangement becomes editable user input — currently hardcoded in genre module `compileBlueprint()`. Need to accept user arrangement override.
- **Files:** New `apps/web/src/components/ArrangementTimeline.tsx`, `apps/web/src/components/SectionEditor.tsx`, `apps/web/src/components/SectionPalette.tsx`

### 2.3 Reference + Lyrics mode panel
- **Section "03 · Reference material":** Textarea for reference lyrics/vibe
- **Lyrics mode buttons:** Full Lyrics, Hook Only, Instrumental (3-way toggle)
- **Existing:** `reference` field already exists on jobs/drafts. `lyricsMode` exists in EDM schema but not as universal first-class field.
- **Files:** `apps/web/src/components/ReferencePanel.tsx` (new)

### 2.4 Create view sidebar wiring
- **"Forge Track" primary button** → triggers job creation + pipeline start
- **Auto-save inputs** to draft (existing pattern, wire to new data model)
- **Files:** `apps/web/src/pages/CreateView.tsx`

---

## Issue 3: Style Console System (NEW — Core Feature)

The Style Console is the biggest new feature. It replaces the current "LLM writes entire style prompt" approach with a tag-based curation system: users select/modify/weight/mute style descriptors organized by category, and see the compiled prompt assembled live.

### 3.1 Tag data model (frontend)
- Tag: `{ label: string, category: "genre"|"mood"|"inst"|"prod", weight: 1|2|3, muted: boolean }`
- Category lane: each category has a color (genre=green, mood=cyan, inst=amber, prod=violet)
- State container for tags, selected tag, adding category
- **Files:** Shared types in `packages/contracts/src/style-console.ts` (new)

### 3.2 Fingerprint spectrum visualization
- **Top of style console:** Horizontal colored bars proportional to each category's total weight
- "SIGNATURE" and "{N} INFLUENCE UNITS" labels
- Pure CSS rendering from computed widths
- **Files:** `apps/web/src/components/FingerprintSpectrum.tsx`

### 3.3 Category lane component
- Each lane: colored dot + category name + count + add button
- Tag chips inside lane: colored by category, weight shown as 1-3 vertical bars
- Click chip to select → shows channel strip below
- Selected chip gets border highlight + subtle glow
- Muted tags show with strikethrough + dimmed color
- **Files:** `apps/web/src/components/StyleLane.tsx`, `apps/web/src/components/TagChip.tsx`

### 3.4 Add-tag panel (per category)
- "＋" button opens inline panel per lane
- Suggestions: up to 6 pre-filtered descriptors (excludes already added)
- Custom descriptor input with Enter to add
- Add/Done buttons
- Empty lane shows "— empty —" placeholder
- **Files:** `apps/web/src/components/AddTagPanel.tsx`

### 3.5 Selected tag channel strip
- Appears below lanes when a tag is selected
- Inline rename input
- Weight buttons: Subtle (1), Balanced (2), Dominant (3) — selected one highlighted
- Mute/Unmute toggle
- Remove button (red)
- **Files:** `apps/web/src/components/TagChannelStrip.tsx`

### 3.6 Compiled style prompt (live preview)
- "Compiled style prompt · live" header with green dot
- Text display showing: `{ordered active tag labels}, {BPM} BPM, {key}, high fidelity, professional mix`
- Updates in real-time as tags/weights/mutes change
- Character count in header
- **Files:** `apps/web/src/components/CompiledPrompt.tsx`

### 3.7 Style prompt backend — hybrid LLM+curation pipeline
- **Current:** LLM writes full style prompt in `style_writing` stage
- **New:**
  - LLM suggests tag candidates per category (new prompt fragment)
  - User curates (selects/weights/mutes) in the style console
  - On "Forge Track" click, user's curated tags become `styleTags` input
  - Pipeline `compilation` stage uses tags for style construction instead of (or blended with) LLM output
  - `compileBlueprint()` receives `styleTags` as additional input parameter
- **Changes:**
  - Add `styleTags` to job input schema (`packages/contracts`)
  - Add style-tag suggestion endpoint: `POST /api/jobs/style-tag-suggestions` (LLM generates suggestions from genre+reference)
  - Modify `handleCompilation` to consult curated tags when building final prompt
  - Genre module `form` descriptor array needs tag-category definitions
- **Files:** `apps/server/src/routes/jobs.ts`, `packages/core/src/pipeline/orchestrator.ts`, `packages/core/src/pipeline/prompt-assembler.ts`, `packages/genre-core/src/index.ts`, `packages/genre-edm/src/*`, `packages/genre-hiphop/src/*`

---

## Issue 4: Pipeline Forge View — Real-time Visualization

The Forge view replaces the generic "Start" button + SSE updates in the current `JobDetail.tsx` sidebar with an immersive assembly-line visualization.

### 4.1 Assembly line component
- 8 stations displayed horizontally: Reference, Planning, Style, Compile, Review, Revision, Verify, Version
- Each station: number badge, colored dot (green=done, amber=active, dim=pending), label, description line
- Background rail (gray track) + progress rail (green gradient, width = completed fraction)
- Traveling billet (golden glowing dot) animates along the rail to current station
- **Files:** `apps/web/src/components/AssemblyLine.tsx`

### 4.2 Live terminal log
- "forge.log · live" header with macOS-style traffic lights
- Scrolling log entries: timestamp + colored tag (REF/PLAN/STYLE/CMPL/RVEW/REVS/VRFY/VERS) + message
- Blinking cursor at end
- Auto-scroll to bottom on new entries
- **Data source:** SSE `progress` events from `GET /api/jobs/:id/events`
- **Files:** `apps/web/src/components/ForgeTerminal.tsx`

### 4.3 Run monitor panel
- Key-value list: Stage (current), Model (kimi-k2.5), Elapsed, Est. cost
- Cancel run button (red outline) / Open bundle button (green) / Start forge button
- Button state depends on running/complete/idle
- **Files:** `apps/web/src/components/RunMonitor.tsx`

### 4.4 Pipeline progress state
- Progress percentage (steps/16 * 100)
- Done count (X/8 stages)
- Elapsed timer
- Stage index tracking for animation
- **Files:** `apps/web/src/pages/ForgeView.tsx`

### 4.5 Rich SSE events for forge view
- **Current:** SSE events carry `{ stage, status }` only
- **New:** Events need richer payload: `{ stage, step, message, tag, elapsedMs, estimatedCost }` for terminal display
- Enhance `publish()` in core to include structured log messages
- Add `logMessages` to `PipelineEvent` type
- **Files:** `packages/core/src/pipeline/orchestrator.ts`, `packages/core/src/db/schema.ts`, `apps/server/src/routes/events.ts`

---

## Issue 5: Library View — Rich Bundle Collection

The Library view replaces `JobList.tsx` with a richer, card-based interface.

### 5.1 Library search + filter bar
- Search input (filter by name, debounced)
- Genre filter chips: All, EDM, Hip-Hop (dynamic from genre modules)
- Stats: "{N} bundles · {M} takes"
- **Files:** `apps/web/src/components/LibraryFilterBar.tsx`

### 5.2 Bundle card grid
- 3-column responsive grid
- Each card: genre badge + status badge (final/draft/forging), mini waveform (30 bars computed from seed), name, meta (preset · BPM), footer (takes count, BPM, favorite star)
- Dashed "New session" card at end
- Click card → navigate to Studio view for that bundle
- Status colors: final=green, forging=amber, draft=dim
- **Files:** `apps/web/src/components/BundleCard.tsx`, `apps/web/src/pages/LibraryView.tsx`

### 5.3 Library data endpoint enhancement
- **Current:** `GET /api/jobs` returns flat job rows
- **New endpoint or extension:** Return richer card data: `{ id, name, genreId, presetId, bpm, key, status, takesCount, isFavorite, waveformData, updatedAt }`
- Add `takesCount` computed from generations count
- Add `isFavorite` to job table or new favorites table
- Add waveform data (can be computed server-side from seed or stored)
- **Files:** `apps/server/src/routes/jobs.ts`

---

## Issue 6: Studio View — Bundle Detail with Takes

The Studio view replaces `JobDetail.tsx` with the new side-by-side artifact layout + audio takes list.

### 6.1 Bundle header
- "Bundle · v{N}" label + project name (editable inline)
- Stats pill: "1 style · 1 lyric · {N} takes"
- Version number from versions table
- **Files:** `apps/web/src/pages/StudioView.tsx`

### 6.2 Style prompt artifact display
- Read-only display of final style text
- Char count
- Tags rendered below as colored pills (category-colored)
- Matches the output from pipeline `versioning` stage
- **Files:** `apps/web/src/components/StyleArtifact.tsx`

### 6.3 Lyric sheet artifact display
- Read-only display with syllable counts per line
- Section headers (tagged, e.g. [Intro], [Verse 1], [Drop])
- Total syllable count in header
- Sections parsed from lyrics document in version artifacts
- **Files:** `apps/web/src/components/LyricSheet.tsx`

### 6.4 Audio takes list
- **Takes = multiple audio generations from the same version's compiled artifacts**
- Each take row: play/pause button (circle, green when playing, shape changes), title + meta, waveform visualization (46 bars), duration, A/B compare toggle, favorite star
- Playhead animation (moving line across waveform)
- Favored take highlighted with green border/shadow
- "Render new take" button → triggers new Suno generation from same version
- **Data source:** `GET /api/suno/jobs/:jobId/generations`
- **Files:** `apps/web/src/components/TakesList.tsx`, `apps/web/src/components/TakeRow.tsx`, `apps/web/src/components/Waveform.tsx`

### 6.5 Take generation — backend
- **Current:** Generation is linked 1:1 to version (one version = one generation flow)
- **New:** Multiple takes per version. "Render new take" = regenerates Suno audio from same artifacts
- New endpoint: `POST /api/versions/:id/takes` — triggers new Suno generation using existing version artifacts
- `GET /api/versions/:id/takes` — list takes for a version
- `PATCH /api/takes/:id/favorite` — toggle favorite
- Extend generation pipeline to support per-version multiple generations
- **Files:** `apps/server/src/routes/versions.ts` (extend), `packages/core/src/suno/*`

### 6.6 Artifact editing (linking back to style console)
- Click on style text → could open inline editor or navigate back to Create view with pre-filled data
- Currently `ArtifactEditor` exists in `JobDetail.tsx` for inline text edits
- New: "Edit in Forge" button that replays from `style_writing` stage with user edits
- **Files:** `apps/web/src/components/ArtifactEditor.tsx` (refactor)

---

## Issue 7: Data Model & Schema Changes

### 7.1 Add `styleTags` to job inputs
- New field on job `inputs` JSON: `{ styleTags: [{ label, category, weight, muted }] }`
- Add schema validation in genre modules
- **Files:** `packages/contracts/src/index.ts`, `packages/core/src/db/schema.ts` (add `styleTags` to job schema types)

### 7.2 Add `arrangement` as editable user input
- **Current:** Arrangement is set by genre module `compileBlueprint()`
- **New:** User can override arrangement via the builder. Stored as part of job inputs.
- Genre module `compileBlueprint()` should accept arrangement override
- **Files:** `packages/genre-core/src/index.ts` (arrangement field), `packages/genre-edm/src/schema.ts`, `packages/genre-hiphop/src/renderers.ts`

### 7.3 Add `isFavorite` to jobs table
- New column: `jobs.is_favorite` (boolean, default false)
- API: `PATCH /api/jobs/:id/favorite` — toggle
- **Files:** `packages/core/src/db/schema.ts`, `apps/server/src/routes/jobs.ts`

### 7.4 Add `takesCount` as computed or cached field
- Either computed from join on generations, or stored on job row
- Can use aggregation at query time for now
- **Files:** `apps/server/src/routes/jobs.ts` (query extension)

### 7.5 Extend `GenerationRecord` for takes
- Add `version_id` linking takes to specific version
- Add `is_favorite` column
- Add `seed` for deterministic re-rendering
- **Files:** `packages/core/src/db/schema.ts`

### 7.6 Add project-level sessions
- **Current:** Jobs exist under projects, but Create view starts without project context
- **New:** Create view may spawn from library (project context) or standalone (auto-creates project)
- Session data (genre, preset, tags, arrangement, reference) stored as `project_drafts` or new `session` concept
- **Files:** `apps/server/src/routes/projects.ts`, `packages/core/src/db/schema.ts`

### 7.7 Add lyrics mode as universal first-class field
- **Current:** Only EDM has `lyricsMode` in its schema
- **New:** All genres support full/hook/instrumental
- Add `lyricsMode` to job inputs schema universally
- Genre modules handle it in compileBlueprint/renderers
- **Files:** `packages/contracts/src/index.ts`, `packages/genre-core/src/index.ts`, `packages/genre-edm/src/schema.ts`, `packages/genre-hiphop/src/renderers.ts`

---

## Issue 8: Backend API Extensions

### 8.1 Style tag suggestions endpoint
- `POST /api/jobs/style-tag-suggestions`
- Body: `{ genreId, presetId, reference?, bpm?, key? }`
- Response: `{ suggestions: { category, tags: string[] }[] }`
- Backed by an LLM call with lightweight prompt
- Returns up to 6 suggestions per category (genre, mood, inst, prod)
- **Files:** `apps/server/src/routes/jobs.ts`, `packages/core/src/llm/*`

### 8.2 Enhanced job list for library
- `GET /api/jobs` extended with: `search`, `genreFilter`, `includesFavorite`, `enriched: true` (returns card data)
- Response includes computed fields: `takesCount`, `waveformData` (server-generated or null)
- **Files:** `apps/server/src/routes/jobs.ts`

### 8.3 Takes endpoints
- `POST /api/versions/:id/takes` — generate new take from version artifacts
- `GET /api/versions/:id/takes` — list takes
- `PATCH /api/takes/:id/favorite` — toggle favorite
- `PATCH /api/takes/:id/ab` — set as A/B comparison take
- **Files:** `apps/server/src/routes/versions.ts` (new route file or extend), `apps/server/src/routes/suno.ts`

### 8.4 Enhanced SSE events
- Structured log message per stage in event data
- Richer event types: `forge-log`, `forge-progress`, `forge-complete`
- Include `{ message, tag, elapsedMs, estimatedCost }` per event
- **Files:** `apps/server/src/routes/events.ts`, `packages/core/src/pipeline/orchestrator.ts`

---

## Issue 9: Genre Module Updates

### 9.1 Style tag suggestion prompts
- Each genre module gets a new `promptFragments` entry: `"style_tag_suggestions"`
- Prompt asks LLM to suggest tags for each category given genre/preset/reference
- **Files:** `packages/genre-edm/src/prompts.ts`, `packages/genre-hiphop/src/prompts.ts`

### 9.2 Accept user arrangement override
- `compileBlueprint()` gets optional `arrangementOverride?: { name, bars }[]` parameter
- If provided, uses user arrangement instead of generated default
- **Files:** `packages/genre-core/src/index.ts`, `packages/genre-edm/src/schema.ts`, `packages/genre-hiphop/src/renderers.ts`

### 9.3 Support lyricsMode universally
- Genre module `inputSchema` includes `lyricsMode` with enum values
- `compileBlueprint()` passes lyricsMode through to renderers
- Renderers handle all three modes consistently
- **Files:** All genre modules

### 9.4 Add genre module tag category definitions
- Each genre module exports tag category definitions for the style console
- `tagCategories: [{ id, name, color, suggestions[] }]`
- Suggestion lists are genre-aware (EDM suggests Supersaw Lead, 808 not relevant etc.)
- **Files:** `packages/genre-core/src/index.ts`, all genre modules

### 9.5 Genre DATA catalog matching mockup
- The mockup has extended genre catalog: Pop, Ambient, DnB as new genres
- Need to add these as new genre modules (or at minimum their data) if they should appear in the UI
- At minimum: genre definitions + presets + basic tags + structures
- **Files:** New `packages/genre-pop/src/*`, `packages/genre-ambient/src/*`, `packages/genre-dnb/src/*`

---

## Issue 10: Component Refactoring & Code Cleanup

### 10.1 Refactor JobDetail.tsx (965 lines → extracted components)
- **Current:** Monolithic 965-line file with 6 embedded private components
- **New:** Extract into separate component files matching new Studio view architecture
- Remove obsolete components: ReviewPanel (replaced by style console), ArtifactEditor (replaced by tag channel strip), GenerationPanel (replaced by TakesList), VersionTreeView, VersionDiff
- **Files:** `apps/web/src/pages/JobDetail.tsx` (delete or gut), replace with `apps/web/src/pages/StudioView.tsx`

### 10.2 Remove or gut CreateJob.tsx
- **Current:** 223-line form component
- **New:** Replaced by CreateView with genre selector + arrangement builder + style console
- **Files:** `apps/web/src/pages/CreateJob.tsx` (delete or gut)

### 10.3 Remove or gut JobList.tsx
- **Current:** 173-line library list
- **New:** Replaced by LibraryView with card grid
- **Files:** `apps/web/src/pages/JobList.tsx` (delete or gut)

### 10.4 Remove DynamicForm.tsx
- **Current:** Generic form renderer for genre module fields
- **New:** Replaced by genre selector + style console (tags replace generic form fields)
- **Files:** `apps/web/src/components/DynamicForm.tsx` (delete)

### 10.5 Clean up AutoSaveIndicator.tsx
- **Current:** Simple save status badge
- **New:** May still be useful for Create view auto-save
- **Files:** `apps/web/src/components/AutoSaveIndicator.tsx` (keep or simplify)

---

## Implementation Order

**Phase 1 — Shell & Core Data Model (Issues 1, 7)**
1. `1.1` Replace routing → 4-view dispatcher
2. `1.2` Nav rail + transport topbar components
3. `1.3` New design system CSS (full replacement)
4. `7.1` Add `styleTags` to job inputs schema
5. `7.2` Add arrangement override support to genre modules
6. `7.7` Make lyricsMode universal
7. `7.3` Add `isFavorite` to jobs

**Phase 2 — Create View (Issues 2, 3)**
8. `2.1` Genre + preset selection panel
9. `2.2` Arrangement builder (visual timeline)
10. `2.3` Reference + lyrics mode panel
11. `3.1` Style console data model
12. `3.2` Fingerprint spectrum
13. `3.3` Category lanes + tag chips
14. `3.4` Add tag panel
15. `3.5` Tag channel strip
16. `3.6` Compiled prompt preview
17. `8.1` Style tag suggestions API endpoint

**Phase 3 — Forge View (Issue 4)**
18. `4.1` Assembly line component
19. `4.2` Live terminal log
20. `4.3` Run monitor panel
21. `4.5` Rich SSE events for forge visualization

**Phase 4 — Library + Studio (Issues 5, 6)**
22. `5.1` Library filter bar
23. `5.2` Bundle card grid
24. `5.3` Library data endpoint enhancement
25. `6.1-6.3` Studio bundle header + artifacts
26. `6.4` Audio takes list with waveform
27. `8.3` Takes API endpoints

**Phase 5 — Genre Module Expansion (Issue 9)**
28. `9.1` Tag suggestion prompts
29. `9.2` Arrangement override support
30. `9.3` Universal lyricsMode
31. `9.4` Tag category definitions per genre
32. `9.5` Pop, Ambient, DnB genre modules (basic)

**Phase 6 — Cleanup (Issue 10)**
33. Delete/replace obsolete components
34. Final integration testing
35. Remove `DynamicForm.*` and legacy pages
