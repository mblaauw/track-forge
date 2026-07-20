#!/usr/bin/env node

import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as yaml from "js-yaml";

const __dirname = dirname(fileURLToPath(import.meta.url));
const GENRE_DIR = join(__dirname, "..", "config", "genres");

// ── Known valid values ────────────────────────────────────────────────

const VALID_CATEGORIES = [
  "sound",
  "rhythm",
  "atmosphere",
  "production",
  "energy",
];
const VALID_WEIGHTS = [1, 2, 3];
const VALID_LYRICS_MODES = ["strict_instrumental", "full_lyrics"];
const VALID_SCALES = ["major", "minor"];
const VALID_SECTION_FUNCTIONS = [
  "establish",
  "introduce",
  "escalate",
  "contrast",
  "remove",
  "peak",
  "resolve",
];

// ── Validation ─────────────────────────────────────────────────────────

const errors = [];
const warnings = [];

function error(file, msg) {
  errors.push(`${file}: ${msg}`);
}

function warn(file, msg) {
  warnings.push(`${file}: ${msg}`);
}

function validateGenre(file, id, cfg) {
  // ── Required fields ──────────────────────────────────────────────
  if (!cfg.name) error(file, "missing required field: name");
  if (!cfg.color) error(file, "missing required field: color");

  // ── Presets ──────────────────────────────────────────────────────
  const presetIds = new Set();
  for (const p of cfg.presets ?? []) {
    if (!p.id) {
      error(file, "preset missing id");
      continue;
    }
    if (presetIds.has(p.id)) error(file, `duplicate preset id: ${p.id}`);
    presetIds.add(p.id);
    if (!p.name) error(file, `preset "${p.id}" missing name`);
    const lm = p.values?.lyricsMode;
    if (lm && !VALID_LYRICS_MODES.includes(lm)) {
      error(file, `preset "${p.id}" invalid lyricsMode: ${lm}`);
    }
    const scale = p.values?.scale;
    if (scale && !VALID_SCALES.includes(scale)) {
      error(file, `preset "${p.id}" invalid scale: ${scale}`);
    }
  }

  // ── Tag categories ───────────────────────────────────────────────
  const tagIds = new Set();
  for (const tc of cfg.tag_categories ?? []) {
    if (!tc.id) {
      error(file, "tag_category missing id");
      continue;
    }
    if (tagIds.has(tc.id)) error(file, `duplicate tag_category id: ${tc.id}`);
    tagIds.add(tc.id);
    if (!tc.name) error(file, `tag_category "${tc.id}" missing name`);
    if (!tc.color) error(file, `tag_category "${tc.id}" missing color`);
  }

  // ── Descriptor categories ────────────────────────────────────────
  const catIds = new Set();
  for (const dc of cfg.descriptor_categories ?? []) {
    if (!dc.cat) {
      error(file, "descriptor_category missing cat");
      continue;
    }
    if (catIds.has(dc.cat))
      error(file, `duplicate descriptor_category: ${dc.cat}`);
    catIds.add(dc.cat);
    if (!VALID_CATEGORIES.includes(dc.cat)) {
      error(file, `descriptor_category invalid cat value: ${dc.cat}`);
    }
    if (!dc.label) error(file, `descriptor_category "${dc.cat}" missing label`);
    if (!dc.chips?.length)
      warn(file, `descriptor_category "${dc.cat}" has empty chips`);
  }

  // ── Descriptor defaults ──────────────────────────────────────────
  const descLabels = new Set();
  for (const dd of cfg.descriptor_defaults ?? []) {
    if (!dd.label) {
      error(file, "descriptor_default missing label");
      continue;
    }
    if (descLabels.has(dd.label))
      error(file, `duplicate descriptor_default: ${dd.label}`);
    descLabels.add(dd.label);
    if (!dd.cat) error(file, `descriptor_default "${dd.label}" missing cat`);
    if (dd.cat && !VALID_CATEGORIES.includes(dd.cat)) {
      error(file, `descriptor_default "${dd.label}" invalid cat: ${dd.cat}`);
    }
    if (!VALID_WEIGHTS.includes(dd.weight)) {
      error(
        file,
        `descriptor_default "${dd.label}" invalid weight: ${dd.weight}`,
      );
    }
  }

  // ── Preset descriptor seeds ──────────────────────────────────────
  if (cfg.preset_descriptor_seeds) {
    for (const [presetId, seeds] of Object.entries(
      cfg.preset_descriptor_seeds,
    )) {
      if (!presetIds.has(presetId)) {
        error(
          file,
          `preset_descriptor_seeds references unknown preset: ${presetId}`,
        );
      }
      for (const s of seeds) {
        if (s.cat && !VALID_CATEGORIES.includes(s.cat)) {
          error(
            file,
            `preset_descriptor_seeds.${presetId} invalid cat: ${s.cat}`,
          );
        }
        if (s.weight && !VALID_WEIGHTS.includes(s.weight)) {
          error(
            file,
            `preset_descriptor_seeds.${presetId} invalid weight: ${s.weight}`,
          );
        }
      }
    }
  }

  // ── Section functions ────────────────────────────────────────────
  if (cfg.section_functions) {
    for (const fn of cfg.section_functions) {
      if (!VALID_SECTION_FUNCTIONS.includes(fn)) {
        warn(file, `unknown section_function: "${fn}" (not in standard set)`);
      }
    }
  }

  // ── Vocal presets ────────────────────────────────────────────────
  for (const vp of cfg.vocal_presets ?? []) {
    if (!vp.type) error(file, "vocal_preset missing type");
    if (!vp.delivery_style)
      error(file, `vocal_preset "${vp.type}" missing delivery_style`);
    if (vp.default_energy < 1 || vp.default_energy > 10) {
      error(
        file,
        `vocal_preset "${vp.type}" default_energy out of range (1-10)`,
      );
    }
  }

  // ── Lyric themes ─────────────────────────────────────────────────
  if (cfg.lyric_themes && cfg.lyric_themes.length === 0) {
    warn(file, "lyric_themes is empty");
  }
  if (cfg.lyric_themes) {
    const seen = new Set();
    for (const t of cfg.lyric_themes) {
      if (seen.has(t)) error(file, `duplicate lyric_theme: "${t}"`);
      seen.add(t);
    }
  }
}

// ── Main ────────────────────────────────────────────────────────────────

const files = readdirSync(GENRE_DIR).filter((f) => f.endsWith(".yaml"));

if (files.length === 0) {
  console.error("No genre YAML files found in config/genres/");
  process.exit(1);
}

for (const f of files) {
  const filePath = join(GENRE_DIR, f);
  const id = f.replace(/\.yaml$/, "");
  try {
    const raw = readFileSync(filePath, "utf-8");
    const cfg = yaml.load(raw);
    if (!cfg || typeof cfg !== "object") {
      error(f, "not a valid YAML object");
      continue;
    }
    validateGenre(f, id, cfg);
  } catch (err) {
    error(f, `YAML parse error: ${err.message}`);
  }
}

// ── Report ──────────────────────────────────────────────────────────────

if (warnings.length > 0) {
  console.log("Warnings:");
  for (const w of warnings) console.log(`  \u26a0  ${w}`);
}

if (errors.length > 0) {
  console.log(`\nErrors (${errors.length}):`);
  for (const e of errors) console.log(`  \u2716  ${e}`);
  process.exit(1);
}

console.log(
  `Validated ${files.length} genre file(s) — zero errors, ${warnings.length} warnings.`,
);
