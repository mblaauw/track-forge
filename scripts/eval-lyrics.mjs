#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const FIXTURE_DIR = join(ROOT, "eval", "lyrics", "fixtures");
const OUT_JSON = join(ROOT, "eval", "lyrics", "baseline.json");
const OUT_MD = join(ROOT, "eval", "lyrics", "baseline.md");
const CORE_DIST = join(ROOT, "packages", "core", "dist", "index.js");

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

async function loadCore() {
  try {
    return await import(pathToFileURL(CORE_DIST).href);
  } catch (err) {
    throw new Error(
      `Could not import built core package at ${CORE_DIST}. Run \`npm run build\` before \`node scripts/eval-lyrics.mjs\`. Cause: ${err.message}`,
    );
  }
}

async function loadFixtures() {
  const files = (await readdir(FIXTURE_DIR))
    .filter((f) => f.endsWith(".json"))
    .sort();
  const fixtures = [];
  for (const file of files) {
    const raw = await readFile(join(FIXTURE_DIR, file), "utf-8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed))
      throw new Error(`${file} must contain an array`);
    for (const fixture of parsed) fixtures.push({ ...fixture, file });
  }
  return fixtures;
}

function codeCounts(diagnostics, severity) {
  const counts = {};
  for (const d of diagnostics.filter((x) => x.severity === severity)) {
    counts[d.code] = (counts[d.code] ?? 0) + 1;
  }
  return counts;
}

function uniqueCodes(diagnostics, severity) {
  return [
    ...new Set(
      diagnostics.filter((d) => d.severity === severity).map((d) => d.code),
    ),
  ].sort();
}

function expectedCodeCounts(expected) {
  const counts = {};
  for (const code of expected) counts[code] = (counts[code] ?? 0) + 1;
  return counts;
}

function sameCodeCounts(actualCounts, expected) {
  const expectedCounts = expectedCodeCounts(expected);
  const actualKeys = Object.keys(actualCounts).sort();
  const expectedKeys = Object.keys(expectedCounts).sort();
  return (
    actualKeys.length === expectedKeys.length &&
    actualKeys.every(
      (key, i) =>
        key === expectedKeys[i] && actualCounts[key] === expectedCounts[key],
    )
  );
}

function sectionMetrics(input, expectedLineCountForSection) {
  return input.sections.map((section) => {
    const instrumental =
      !section.vocal ||
      section.deltas.some((d) => d.toLowerCase() === "instrumental");
    return {
      id: section.id,
      name: section.name,
      bars: section.bars,
      instrumental,
      expectedLineCount: instrumental
        ? 0
        : expectedLineCountForSection(section, input),
    };
  });
}

function evaluateFixture(fixture, core) {
  const expectedErrors = fixture.expectations?.errorCodes ?? [];
  const expectedWarnings = fixture.expectations?.warningCodes ?? [];
  const result = {
    id: fixture.id,
    file: fixture.file,
    description: fixture.description ?? "",
    mode: "dry-structural",
    promptVersion: "lyrics-writer-v1",
    genre: fixture.input.genreName,
    presets: fixture.input.presetLabels ?? [],
    status: "pass",
    checks: {},
    metrics: {},
    diagnostics: [],
    prompt: {},
  };

  try {
    const rendered = core.buildLyricsPrompt(fixture.input);
    const diagnostics = core.lintRenderedLyricsRequest(fixture.input, rendered);
    const errorCounts = codeCounts(diagnostics, "error");
    const warningCounts = codeCounts(diagnostics, "warning");
    const sections = sectionMetrics(
      fixture.input,
      core.expectedLineCountForSection,
    );

    result.diagnostics = diagnostics;
    result.prompt = {
      systemPromptHash: sha256(rendered.system),
      userPromptHash: sha256(rendered.user),
      systemLength: rendered.system.length,
      userLength: rendered.user.length,
    };
    result.metrics = {
      sectionCount: sections.length,
      vocalSectionCount: sections.filter((s) => !s.instrumental).length,
      instrumentalSectionCount: sections.filter((s) => s.instrumental).length,
      totalExpectedLyricLines: sections.reduce(
        (sum, s) => sum + s.expectedLineCount,
        0,
      ),
      errorCounts,
      warningCounts,
      sections,
    };
    result.checks = {
      promptBuilds: true,
      errorCodesMatch: sameCodeCounts(errorCounts, expectedErrors),
      warningCodesMatch: sameCodeCounts(warningCounts, expectedWarnings),
      hasResponseContract:
        rendered.system.includes("Return ONLY valid JSON") &&
        rendered.system.includes("specified lyric-line count"),
      hasSectionSpecifications: rendered.user.includes(
        "SECTION SPECIFICATIONS",
      ),
    };
  } catch (err) {
    result.status = "fail";
    result.error = err instanceof Error ? err.message : String(err);
    result.checks = { promptBuilds: false };
    return result;
  }

  if (Object.values(result.checks).some((v) => v !== true)) {
    result.status = "fail";
  }
  return result;
}

function markdownReport(report) {
  const lines = [
    "# Lyrics Eval Baseline",
    "",
    `Generated: ${report.createdAt}`,
    `Mode: ${report.mode}`,
    "",
    "## Summary",
    "",
    `- Fixtures: ${report.summary.total}`,
    `- Passed: ${report.summary.passed}`,
    `- Failed: ${report.summary.failed}`,
    `- Prompt version: ${report.promptVersion}`,
    "",
    "## Fixture Results",
    "",
    "| Fixture | Genre | Status | Errors | Warnings | Sections | Lines |",
    "|---|---:|---:|---|---|---:|---:|",
  ];

  for (const r of report.results) {
    const errors = uniqueCodes(r.diagnostics ?? [], "error").join(", ") || "—";
    const warnings =
      uniqueCodes(r.diagnostics ?? [], "warning").join(", ") || "—";
    lines.push(
      `| ${r.id} | ${r.genre} | ${r.status} | ${errors} | ${warnings} | ${r.metrics.sectionCount ?? "—"} | ${r.metrics.totalExpectedLyricLines ?? "—"} |`,
    );
  }

  return `${lines.join("\n")}\n`;
}

async function main() {
  const core = await loadCore();
  const fixtures = await loadFixtures();
  const results = fixtures.map((fixture) => evaluateFixture(fixture, core));
  const report = {
    createdAt: new Date().toISOString(),
    mode: "dry-structural",
    promptVersion: "lyrics-writer-v1",
    summary: {
      total: results.length,
      passed: results.filter((r) => r.status === "pass").length,
      failed: results.filter((r) => r.status === "fail").length,
    },
    results,
  };

  await mkdir(dirname(OUT_JSON), { recursive: true });
  await writeFile(OUT_JSON, `${JSON.stringify(report, null, 2)}\n`, "utf-8");
  await writeFile(OUT_MD, markdownReport(report), "utf-8");

  console.log(
    `Lyrics eval baseline: ${report.summary.passed}/${report.summary.total} passed`,
  );
  console.log(`Wrote ${OUT_JSON}`);
  console.log(`Wrote ${OUT_MD}`);
  if (report.summary.failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
