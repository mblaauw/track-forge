# track-forge-suno

Suno generation provider integration. The application adapter in `packages/core/src/suno/client.ts` is the single integration point.

## Use for

- provider payloads (submit shape, fields: `customMode`, `instrumental`, `model`, `title`, `style`, `prompt`, `negativeTags`, `callBackUrl`, `vocalGender`, etc.)
- callbacks (webhook at `POST /api/suno/callback`)
- polling (`getGenerationStatus()` via `/api/v1/generate/record-info`)
- render status transitions (queued → processing → completed/error)
- audio metadata (title, audioUrl, imageUrl, videoUrl, duration, tags)
- model capabilities (model name, style persona, etc.)
- style and lyrics limits
- provider errors (status codes, error messages, sensitive word errors)

## Mandatory rules

1. **Verify unstable API details against official provider documentation.** Do not infer the current contract from model memory.
2. **Never call live Suno during normal development or testing.** Consumes credits, creates unwanted artifacts, and confuses provider outages with application bugs.
3. **Require `TRACK_FORGE_LIVE_SUNO=1` plus explicit user confirmation** for live smoke tests.
4. **Redact credentials and callback secrets** in trace output and documentation.
5. **Update exact HTTP fixtures when the contract changes.** Fixtures live at `packages/test-support/src/providers/fake-suno-server.ts`.
6. **Test strict instrumental and lyrical generation separately.**
7. **Test provider errors and incomplete responses** (timeout, malformed, rejected).
8. **Treat `apps/server/LLM_SUNO_IN.md` as operational evidence, not eternal architecture.**

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

These live in a display-only label map (`STAGE_LABELS` in `arrangement.ts`), NOT in `STAGE_ORDER`/`GenerationStage`.
