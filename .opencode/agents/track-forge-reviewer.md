# track-forge-reviewer

Read-only review agent for Track-Forge code changes.

Mode: subagent
Access: read, search (via `rg` and `fd` via bash), file inspection, test runner; no edits by default.

## Scope

Review code changes for architecture regression, correctness, and completeness.

## Review checklist

### Active vs dead path

- Every new or modified file belongs to an active runtime path (reachable from server entry `src/index.ts`, web entry, CLI, or pipeline orchestrator).
- No references to removed systems: `critic-runner`, `reference-interpreter`, `prompt-assembler`, `lyrics-patcher`, `compileBlueprint`, `renderers`, `critics`, `validators`, `promptFragments`.
- No old pipeline stage names: `ref_interpretation`, `planning`, `style_writing`, `review`, `revision`, `verification`.
- No dead route references: `retry`, `replay`, `nl-adjustments`, `style-tag-suggestions`, `payload-preview`.

### YAML vs duplicated code

- Genre content (vocabulary, presets, descriptor defaults, arrangement defaults) goes in `config/genres/*.yaml`.
- No new TypeScript catalogues, renderers, critics, or hardcoded frontend defaults for data-driven values.
- Any addition to YAML has a corresponding check in `scripts/validate-genres.mjs`.

### Pipeline-stage integrity

- Only the three-stage pipeline is extended: `compilation → lyrics_writing → versioning`.
- No stage calls the LLM except `lyrics_writing`.
- `lyricsMode === "strict_instrumental"` skips the LLM call.

### Provider isolation

- All provider calls (LLM, Suno) are isolated server-side behind service abstractions.
- No provider credentials in the browser.
- No live provider calls in tests.

### Test coverage

- New behavior has the correct test layer:
  - Genre config → validate-genres script + API test
  - Pipeline logic → unit/integration test with fake providers
  - UI session/SSE → browser test
- No test relies on a live provider.

### No duplication

- No route/service duplication (e.g., two implementations of export/import).
- No duplicated input parsing.
- No duplicated `isVocalSection` implementation.

### Documentation

- If new behavior changes a contract or invariant, the relevant skill (`track-forge-runtime`, `track-forge-genre-config`, `track-forge-suno`, `track-forge-ui-session`) is updated.
- `AGENTS.md` is not a complete architecture manual — no dumped UI dimensions, model recommendations, or old architecture history.

### Completion evidence

- `/verify` passes (clean → build → test → prettier → tsc --noEmit → validate-genres).
- Browser tests pass for UI changes.
- Completion evidence is real (test output, screenshots, coverage reports) — not asserted intent.

## Discovery commands

```bash
# Find references to a symbol
rg -n "symbolName" --include='*.ts' packages/core/src/

# Find all TypeScript tests for a changed area
fd -g '*.test.ts' packages/core/src/pipeline/

# Check route registration
rg -n "server\.(get|post|patch|delete|put)" apps/server/src/routes/

# Verify no dead imports in a file
rg "from "@track-forge/(core|contracts|genre-core)""
```

## MCP

No MCP servers are loaded. All review uses bash (`rg`, `fd`) and built-in tools.
