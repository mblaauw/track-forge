#!/usr/bin/env node
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as yaml from "js-yaml";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_DIR = join(__dirname, "..", "config");
const GENRE_DIR = join(CONFIG_DIR, "genres");
const LYRIC_PROMPTS_DIR = join(CONFIG_DIR, "lyrics-prompts");
const SHARED_PATH = join(CONFIG_DIR, "shared.yaml");

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

function validateBaseYaml(file, id, cfg, validVocalTypeIds) {
  if (!cfg.name) error(file, "missing required field: name");
  if (!cfg.color) error(file, "missing required field: color");

  // ── song_structure ──────────────────────────────────────────────
  const effectiveFns = cfg.section_functions ?? VALID_SECTION_FUNCTIONS;
  const effectiveDeltas = new Set(cfg.delta_palette ?? []);
  for (const s of cfg.song_structure ?? []) {
    if (!s.section) error(file, "song_structure entry missing section");
    if (s.fn && !effectiveFns.includes(s.fn)) {
      error(file, `song_structure "${s.section}" invalid fn: "${s.fn}"`);
    }
    if (effectiveDeltas.size > 0) {
      for (const t of s.tags ?? []) {
        if (!effectiveDeltas.has(t)) {
          error(
            file,
            `song_structure "${s.section}" tag "${t}" not in delta_palette`,
          );
        }
      }
    }
  }

  // ── Descriptor categories ──────────────────────────────────────
  const catIds = new Set();
  for (const dc of cfg.descriptor_categories ?? []) {
    if (!dc.cat) {
      error(file, "descriptor_category missing cat");
      continue;
    }
    if (catIds.has(dc.cat))
      error(file, `duplicate descriptor_category: ${dc.cat}`);
    catIds.add(dc.cat);
    if (!VALID_CATEGORIES.includes(dc.cat))
      error(file, `descriptor_category invalid cat: ${dc.cat}`);
    if (!dc.label) error(file, `descriptor_category "${dc.cat}" missing label`);
    if (!dc.chips?.length)
      warn(file, `descriptor_category "${dc.cat}" has empty chips`);
  }

  // ── Descriptor defaults ────────────────────────────────────────
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

  // ── Vocal presets ──────────────────────────────────────────────
  for (const vp of cfg.vocal_presets ?? []) {
    if (!vp.type) error(file, "vocal_preset missing type");
    if (validVocalTypeIds && vp.type && !validVocalTypeIds.has(vp.type)) {
      error(
        file,
        `vocal_preset type "${vp.type}" not in shared.yaml vocal_preset_types`,
      );
    }
    if (!vp.delivery_style)
      error(file, `vocal_preset "${vp.type}" missing delivery_style`);
    if (vp.default_energy < 1 || vp.default_energy > 10) {
      error(
        file,
        `vocal_preset "${vp.type}" default_energy out of range (1-10)`,
      );
    }
  }

  // ── Lyric themes ───────────────────────────────────────────────
  if (cfg.lyric_themes && cfg.lyric_themes.length === 0)
    warn(file, "lyric_themes is empty");
  if (cfg.lyric_themes) {
    const seen = new Set();
    for (const t of cfg.lyric_themes) {
      if (seen.has(t)) error(file, `duplicate lyric_theme: "${t}"`);
      seen.add(t);
    }
  }

  // ── Section functions ──────────────────────────────────────────
  if (cfg.section_functions) {
    for (const fn of cfg.section_functions) {
      if (!VALID_SECTION_FUNCTIONS.includes(fn)) {
        warn(file, `unknown section_function: "${fn}"`);
      }
    }
  }
}

function validatePresetYaml(file, id, cfg) {
  if (!cfg.id) {
    error(file, "preset missing id");
    return;
  }
  if (cfg.id !== id)
    error(file, `preset id mismatch: file="${id}", yaml="${cfg.id}"`);
  if (!cfg.name) error(file, `preset "${cfg.id}" missing name`);
  if (!cfg.description) warn(file, `preset "${cfg.id}" missing description`);

  const vals = cfg.values ?? {};
  const lm = vals.lyricsMode;
  if (lm && !VALID_LYRICS_MODES.includes(lm)) {
    error(file, `preset "${cfg.id}" invalid lyricsMode: ${lm}`);
  }
  const scale = vals.scale;
  if (scale && !VALID_SCALES.includes(scale)) {
    error(file, `preset "${cfg.id}" invalid scale: ${scale}`);
  }
  if (vals.key !== undefined) {
    warn(file, `preset "${cfg.id}" has deprecated 'key' in values — omit it`);
  }
  if (vals.scale !== undefined) {
    warn(file, `preset "${cfg.id}" has deprecated 'scale' in values — omit it`);
  }
}

// ── Main ────────────────────────────────────────────────────────────────

let shared = {};
let validVocalTypeIds = null;
try {
  shared = yaml.load(readFileSync(SHARED_PATH, "utf-8")) ?? {};
  if (shared.section_functions) {
    for (const fn of shared.section_functions) {
      if (!VALID_SECTION_FUNCTIONS.includes(fn))
        warn("shared.yaml", `unknown section_function: "${fn}"`);
    }
  }
  if (shared.vocal_preset_types) {
    validVocalTypeIds = new Set(shared.vocal_preset_types.map((vt) => vt.id));
    for (const vt of shared.vocal_preset_types) {
      if (!vt.id) error("shared.yaml", "vocal_preset_type missing id");
      if (!vt.label)
        error("shared.yaml", `vocal_preset_type "${vt.id}" missing label`);
    }
  }
} catch (err) {
  error("shared.yaml", `YAML parse error: ${err.message}`);
}

const genreDirs = readdirSync(GENRE_DIR)
  .filter((entry) => {
    try {
      return statSync(join(GENRE_DIR, entry)).isDirectory();
    } catch {
      return false;
    }
  })
  .sort();

if (genreDirs.length === 0) {
  console.error("No genre directories found in config/genres/");
  process.exit(1);
}

let totalPresets = 0;

for (const id of genreDirs) {
  const dir = join(GENRE_DIR, id);

  // Validate base.yaml
  const baseFile = join(dir, "base.yaml");
  if (!existsSync(baseFile)) {
    error(`${id}/base.yaml`, "missing base.yaml");
    continue;
  }
  try {
    const raw = readFileSync(baseFile, "utf-8");
    const cfg = yaml.load(raw);
    if (!cfg || typeof cfg !== "object") {
      error(`${id}/base.yaml`, "not a valid YAML object");
      continue;
    }
    cfg.section_functions ??= shared.section_functions;
    cfg.delta_palette ??= shared.delta_palette;
    validateBaseYaml(`${id}/base.yaml`, id, cfg, validVocalTypeIds);
  } catch (err) {
    error(`${id}/base.yaml`, `YAML parse error: ${err.message}`);
  }

  // Validate preset files
  const presetFiles = readdirSync(dir)
    .filter((f) => f.endsWith(".yaml") && f !== "base.yaml")
    .sort();

  const seenIds = new Set();
  for (const f of presetFiles) {
    totalPresets++;
    const presetId = f.replace(/\.yaml$/, "");
    const filePath = join(dir, f);
    try {
      const raw = readFileSync(filePath, "utf-8");
      const cfg = yaml.load(raw);
      if (!cfg || typeof cfg !== "object") {
        error(`${id}/${f}`, "not a valid YAML object");
        continue;
      }
      if (seenIds.has(cfg.id))
        error(`${id}/${f}`, `duplicate preset id: ${cfg.id}`);
      seenIds.add(cfg.id);
      validatePresetYaml(`${id}/${f}`, presetId, cfg);
    } catch (err) {
      error(`${id}/${f}`, `YAML parse error: ${err.message}`);
    }
  }

  // Check lyrics prompt file
  const promptPath = join(LYRIC_PROMPTS_DIR, `${id}.md`);
  if (!existsSync(promptPath)) {
    error(
      `lyrics-prompts/${id}.md`,
      `missing lyrics prompt file for genre "${id}"`,
    );
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
  `Validated ${genreDirs.length} genre(s), ${totalPresets} preset(s) — zero errors, ${warnings.length} warnings.`,
);
