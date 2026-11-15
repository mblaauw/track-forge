# track-forge-suno

Suno generation provider integration. The application adapter in `packages/core/src/suno/client.ts` is the single integration point.

## Use for

- provider payloads (submit shape, fields: `customMode`, `instrumental`, `model`, `title`, `style`, `lyrics`, `negativeTags`, `duration`, `variety`, `callBackUrl`, `vocalGender`, `styleWeight`, `weirdnessConstraint`)
- callbacks (webhook at `POST /api/suno/callback`)
- polling (`getGenerationStatus()` via `/api/v1/generate/record-info`)
- render status transitions (queued → processing → completed/error)
- audio metadata (title, audioUrl, imageUrl, videoUrl, duration, tags)
- model capabilities (model name, style persona, etc.)
- style and lyrics limits
- provider errors (status codes, error messages, sensitive word errors)

## Suno v6 contract (the only live model family)

Source: <https://docs.sunoapi.org/suno-api/generate-music> (append `.md` for the OpenAPI spec). Constants live in `packages/contracts/src/index.ts`.

| Item           | v6 value                                                                  |
| -------------- | ------------------------------------------------------------------------- |
| `model`        | `V6` (default), `V6_WILD`, `V6_MINI` — every older id is discontinued     |
| `style`        | max 1000 chars                                                            |
| `lyrics`       | max 5000 chars; replaces `prompt` for lyrics in custom mode               |
| `negativeTags` | max 1000 chars                                                            |
| `title`        | max 80 chars                                                              |
| `duration`     | 10–360 s, provider default 20 — always send it                            |
| `variety`      | integer 0–4, provider default 1; this app defaults to 0 (style untouched) |
| sliders        | `styleWeight`, `weirdnessConstraint`: 0–1, two decimals                   |
| `audioWeight`  | rejected on takes without vocals                                          |
| record-info    | track fields documented in snake_case; client accepts both spellings      |
| error codes    | 413 too long, 429 no credits, 430 rate, 455 maintenance → `SunoApiError`  |

Prompting behaviour (community-sourced unless noted — re-check before relying on it):

- Variety above 0 rewrites the style prompt (Suno FAQ: 0 keeps "full control of your style tags").
- Negatives belong in `negativeTags`; "no drums" in the style can add drums.
- Section tags in lyrics are hints; a voice described in the style prompt is followed more reliably.

## Mandatory rules

1. **Verify unstable API details against official provider documentation.** Do not infer the current contract from model memory.
2. **Never call live Suno during normal development or testing.** Consumes credits, creates unwanted artifacts, and confuses provider outages with application bugs.
3. **Require `TRACK_FORGE_LIVE_SUNO=1` plus explicit user confirmation** for live smoke tests.
4. **Redact credentials and callback secrets** in trace output and documentation.
5. **Update exact HTTP fixtures when the contract changes.** Fixtures live at `packages/test-support/src/providers/fake-suno-server.ts`.
6. **Test strict instrumental and lyrical generation separately.**
7. **Test provider errors and incomplete responses** (timeout, malformed, rejected).

## Provider fixture structure

Scenarios in `packages/test-support/src/providers/scenarios.ts`:

| Scenario                     | Behavior                                       |
| ---------------------------- | ---------------------------------------------- |
| `instrumental-success`       | No LLM call, Suno submits and completes        |
| `vocal-success`              | LLM returns lyrics, Suno submits and completes |
| `ambient-success`            | Ambient genre with LLM, Suno completes         |
| `llm-timeout`                | LLM throws, pipeline fails                     |
| `llm-malformed`              | LLM returns unparseable content                |
| `suno-submit-fails`          | Suno submit throws, take fails                 |
| `suno-pending-then-complete` | Polls show pending then complete               |
| `suno-pending-then-failed`   | Polls show pending then failed                 |
| `suno-callback-before-poll`  | Callback arrives before first poll             |
| `job-cancelled`              | Job cancelled mid-stream                       |

## Suno callback SSE events

When `POST /api/versions/:id/takes` is called, the server emits synthetic SSE events:

- `progress { stage: "suno_render", status: "started" }`
- `progress { stage: "suno_render_complete", status: "completed" }` — on success
- `progress { stage: "suno_render_error", status: "error" }` — on failure

These map onto the display-only `FORGE_STEPS` list in `apps/web/src/lib/forge.ts`, NOT `STAGE_ORDER`/`GenerationStage`.
