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
User inputs
  → compilation (deterministic, no LLM)
  → optional lyrics_writing (only LLM call, skipped if strict_instrumental)
  → versioning (persists artifacts, completes job)
  → ComposeShell triggers take (POST /api/versions/:id/takes)
  → Suno submit
  → render events (SSE → Renders panel)
```

## Stage contracts

| Stage          | Input                                                    | Output                                                 | LLM call?                         |
| -------------- | -------------------------------------------------------- | ------------------------------------------------------ | --------------------------------- |
| compilation    | parsed inputs, presets, descriptors, sections            | `compiledJson` (title, style, excludedStyles)          | No                                |
| lyrics_writing | compiled style, arrangement, vocal delivery, lyric brief | `lyricsWriterResult` (document with sections/lines)    | Yes, unless `strict_instrumental` |
| versioning     | compiledJson + lyricsWriterResult                        | DB version row (MAX+1 numbering), job set to completed | No                                |

## Invariants

- No resurrection of deleted stages (`critic-runner`, `reference-interpreter`, `prompt-assembler`, `lyrics-patcher`).
- No duplicate version-number implementation (single `createVersion` with `MAX+1` in `job-service.ts`).
- No routes calling provider clients directly when a service exists.
- No UI-generated synthetic success state.
- Terminal job state (`completed`/`failed`/`cancelled`) exactly once.
- No take creation before version commit.
- SSE events reflect persisted state (`publish()` in `events.ts`).
- Cancellation uses `AbortController` via `job-abort-controller.ts` with `combineSignals()` cleanup.

## Required tests

- instrumental forge (no LLM call, version created, job completed)
- vocal forge (LLM lyrics writing, version persists)
- failed LLM call (timeout → job failed)
- cancelled job (abort mid-stream → cancelled state)
- take submission after versioning
- take submission failure
- successful render event (SSE completion)
- import/export round trip (CLI + HTTP)
