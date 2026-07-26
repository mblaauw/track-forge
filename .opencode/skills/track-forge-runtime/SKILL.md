# track-forge-runtime

Pipeline engine, jobs, versions, takes, SSE events, cancellation, import/export.

## Use for

- pipeline changes (orchestrator, stage handlers, stage data)
- jobs (creation, loading, status transitions, cancellation)
- versions (creation, numbering, artifacts)
- takes (auto-creation after versioning, Suno submission)
- render status (SSE events, callback handling)
- import/export CLI and HTTP routes
- cancellation and cleanup

## Pipeline flow

```
User inputs → resolveSongIntent() (derivation rules, enrich)
  → freezeIntentRevision() (immutable snapshot → intent_revisions table)
  → compilation (deterministic, no LLM)
  → optional lyrics_writing (only LLM call, skipped if strict_instrumental)
  → versioning (persists artifacts, createCompilation() links to revision, completes job)
  → ComposeShell triggers take (POST /api/versions/:id/takes)
  → Suno submit
  → render events (SSE → Renders panel)
```

All stages receive `ResolvedSongIntent` from the intent resolver. The intent revision is frozen before the pipeline starts, ensuring reproducibility.

## Stage contracts

| Stage          | Input                                                    | Output                                                                                          | LLM call?                         |
| -------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | --------------------------------- |
| compilation    | `ResolvedSongIntent` (genre, preset, descriptors, vocal) | `compiledJson` (title, style, excludedStyles)                                                   | No                                |
| lyrics_writing | `ResolvedSongIntent` + compiled style + lyric brief      | `lyricsWriterResult` (document with sections/lines)                                             | Yes, unless `strict_instrumental` |
| versioning     | `ResolvedSongIntent` + compiledJson + lyricsWriterResult | DB version row (MAX+1 numbering), `createCompilation()` links to revision, job set to completed | No                                |

## Invariants

- No resurrection of deleted stages (`critic-runner`, `reference-interpreter`, `prompt-assembler`, `lyrics-patcher`).
- No duplicate version-number implementation (single `createVersion` with `MAX+1` in `job-service.ts`).
- No routes calling provider clients directly when a service exists.
- No UI-generated synthetic success state.
- Terminal job state (`completed`/`failed`/`cancelled`) exactly once.
- No take creation before version commit.
- SSE events reflect persisted state (`publish()` in `events.ts`).
- Cancellation uses `AbortController` via `job-abort-controller.ts` with `combineSignals()` cleanup.
- **Reproducibility:** `freezeIntentRevision()` is called before the pipeline starts; `createCompilation()` runs during versioning. Both are required.
- **ResolvedSongIntent** flows through all three pipeline stages — compilation enriches it, lyrics_writing reads from it, versioning persists it.
- `SongIntentV1` (`packages/song-intent`) is the canonical typed intent contract with `.strict()` schema. `migrateLegacyJob()` bridges existing `jobs.inputs` JSON.

## Required tests

- instrumental forge (no LLM call, version created, job completed)
- vocal forge (LLM lyrics writing, version persists)
- failed LLM call (timeout → job failed)
- cancelled job (abort mid-stream → cancelled state)
- take submission after versioning
- take submission failure
- successful render event (SSE completion)
- import/export round trip (CLI + HTTP)
