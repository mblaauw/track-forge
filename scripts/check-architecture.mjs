#!/usr/bin/env node

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// ── Forbidden symbols (imports, exports, type references) ──────────────

const FORBIDDEN_PATTERNS = [
  // Removed pipeline stages
  "critic-runner",
  "reference-interpreter",
  "prompt-assembler",
  "lyrics-patcher",
  // Dead genre machinery
  "compileBlueprint",
  "renderers",
  "critics",
  "validators",
  "promptFragments",
  // Old pipeline stage names
  "ref_interpretation",
  "planning",
  "style_writing",
  "review",
  "revision",
  "verification",
  // Dead routes (not SSE history replay — that is still active)
  "retry",
  "replay.route",
  "ReplayRoute",
  "/replay",
  "nl-adjustments",
  "style-tag-suggestions",
  "payload-preview",
  // Dead service names
  "lock-service",
  "lockService",
  "LockService",
  // Old contracts
  "StyleWriterResult",
  "ControlDescriptor",
  "CriticFinding",
  "InterpretedReference",
  "SurgicalPatch",
  "StageAttempt",
  "BlueprintCompilation",
];

// ── Forbidden file names ───────────────────────────────────────────────

const FORBIDDEN_FILES = [
  /critic-runner\.ts$/,
  /reference-interpreter\.ts$/,
  /prompt-assembler\.ts$/,
  /lyrics-patcher\.ts$/,
  /canonical\.ts$/,
];

// ── Source directories to scan ─────────────────────────────────────────

const ROOT = new URL("..", import.meta.url).pathname;

const SCAN_DIRS = [
  "packages/core/src",
  "packages/contracts/src",
  "packages/genre-core/src",
  "packages/genre-edm/src",
  "packages/genre-hiphop/src",
  "packages/genre-ambient/src",
  "apps/server/src",
  "apps/web/src",
].map((d) => join(ROOT, d));

// ── Exclusions ─────────────────────────────────────────────────────────

const EXCLUDE_PATTERNS = [
  /node_modules/,
  /\.git/,
  /dist\//,
  /\.test\.ts$/,
  /\.spec\.ts$/,
  /__tests__/,
  /\.d\.ts$/,
];

function shouldExclude(filePath) {
  return EXCLUDE_PATTERNS.some((p) => p.test(filePath));
}

// ── Scan ───────────────────────────────────────────────────────────────

const errors = [];

function collectFiles(dir) {
  const results = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...collectFiles(fullPath));
      } else if (entry.isFile() && entry.name.endsWith(".ts")) {
        results.push(fullPath);
      }
    }
  } catch {
    // directory doesn't exist yet — skip
  }
  return results;
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Check forbidden file names
for (const dir of SCAN_DIRS) {
  const files = collectFiles(dir);
  for (const file of files) {
    const relativePath = file.replace(ROOT, "");
    if (shouldExclude(file)) continue;
    for (const pattern of FORBIDDEN_FILES) {
      if (pattern.test(file)) {
        errors.push(`Forbidden file: ${relativePath} matches ${pattern}`);
      }
    }
  }
}

// Check forbidden patterns in source code
for (const dir of SCAN_DIRS) {
  const files = collectFiles(dir);
  for (const file of files) {
    if (shouldExclude(file)) continue;
    const relativePath = file.replace(ROOT, "");
    try {
      const content = readFileSync(file, "utf-8");
      for (const pattern of FORBIDDEN_PATTERNS) {
        const re = new RegExp(`\\b${escapeRegex(pattern)}\\b`);
        if (re.test(content)) {
          const lines = content.split("\n");
          const lineNumbers = lines
            .map((line, i) => (re.test(line) ? i + 1 : -1))
            .filter((n) => n > 0);
          for (const ln of lineNumbers) {
            errors.push(
              `Forbidden reference "${pattern}" in ${relativePath}:${ln}`,
            );
          }
        }
      }
    } catch {
      // skip unreadable files
    }
  }
}

// ── Report ─────────────────────────────────────────────────────────────

if (errors.length > 0) {
  console.log(`Architecture errors (${errors.length}):\n`);
  for (const e of errors) {
    console.log(`  \u2716  ${e}`);
  }
  process.exit(1);
}

console.log("Architecture check passed \u2014 no forbidden references found.");
