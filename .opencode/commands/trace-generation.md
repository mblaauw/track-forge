# /trace-generation

Display the full generation trace for a job or session ID.

## Usage

```
/trace-generation <jobId>
```

Or with a session ID (look up the corresponding job first).

## What it shows

Given a job ID, display in order:

1. **Normalized input** — genre, preset, BPM, key, scale, lyrics mode
2. **Compilation result** — title, style prompt, excluded styles, active descriptor count
3. **LLM request** — prompt sent (if lyrics_writing ran)
4. **LLM response** — raw output, parsed structure, usage tokens
5. **Version artifact** — version number, title, style, lyrics, excluded styles
6. **Take payload** — submit arguments to Suno
7. **Provider task ID** — Suno task identifier
8. **Render events** — SSE event sequence (started → completed/error)
9. **Final track metadata** — audio URL, duration, image, tags

## Data sources

- `api.LLM_TRACE.md` — pipeline trace file written by `orchestrator.ts` (append-mode)
- `packages/core/src/pipeline/orchestrator.ts` — `trace()` function writes pipeline stages
- Server DB — `jobs`, `versions`, `generations` tables
- `apps/server/LLM_SUNO_IN.md` — operational notes

## Redaction

Redact before display:

- API keys and bearer tokens
- Callback URLs and callback secrets
- Personal configuration values
- Live provider credentials

## Commands

```bash
# Show pipeline trace for a job
rg "jobId: ${JOB_ID}" LLM_TRACE.md

# Query job from DB
sqlite3 data/track-forge.db "SELECT id, genre_id, status, inputs, stage_data, error FROM jobs WHERE id = '${JOB_ID}'"

# List versions
sqlite3 data/track-forge.db "SELECT id, number, status, artifacts FROM versions WHERE job_id = '${JOB_ID}'"

# List generations (takes)
sqlite3 data/track-forge.db "SELECT id, task_id, status, audio_url, error FROM generations WHERE job_id = '${JOB_ID}'"
```
