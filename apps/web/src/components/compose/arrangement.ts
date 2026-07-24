import { isVocalSection } from "@track-forge/genre-core";
import type {
  Section,
  SectionFunction,
  LyricsMode,
  SongStructureSection,
  SongStructureBarSpec,
} from "./types";

export type { Section, SectionFunction };

export function generateId(): string {
  return Math.random().toString(36).slice(2, 9);
}

const TITLE_A = [
  "Neon",
  "Shadow",
  "Crystal",
  "Velvet",
  "Midnight",
  "Broken",
  "Electric",
  "Silent",
  "Burning",
  "Fading",
  "Golden",
  "Hollow",
  "Iron",
  "Jade",
  "Karma",
  "Lunar",
  "Mystic",
  "Phantom",
  "Rebel",
  "Silver",
  "Cosmic",
  "Distant",
  "Frozen",
  "Wandering",
  "Crimson",
];
const TITLE_B = [
  "Dreams",
  "Fires",
  "Wolves",
  "Kings",
  "Nights",
  "Heart",
  "Light",
  "Storm",
  "Tears",
  "Venom",
  "Wings",
  "Dawn",
  "Echo",
  "Flame",
  "Grace",
  "Haze",
  "Lanes",
  "Myth",
  "Rain",
  "Skies",
  "Embers",
  "Shadows",
  "Horizon",
  "Ruins",
  "Strangers",
];

export function randomTitle(): string {
  const a = TITLE_A[Math.floor(Math.random() * TITLE_A.length)]!;
  const b = TITLE_B[Math.floor(Math.random() * TITLE_B.length)!];
  return `${a} ${b}`;
}

export const SEC_COLORS: Record<string, string> = {
  intro: "var(--hue-slate)",
  outro: "var(--hue-slate)",
  emerge: "var(--hue-slate)",
  fade: "var(--hue-slate)",
  build: "var(--hue-amber)",
  swell: "var(--hue-amber)",
  "pre-chorus": "var(--hue-amber)",
  drop: "var(--hue-green)",
  hook: "var(--hue-green)",
  chorus: "var(--hue-green)",
  drift: "var(--hue-green)",
  breakdown: "var(--hue-violet)",
  bridge: "var(--hue-violet)",
  interlude: "var(--hue-violet)",
  verse: "var(--hue-cyan)",
  groove: "var(--hue-cyan)",
  movement: "var(--hue-cyan)",
};

export function sectionColor(name: string): string {
  const key = name
    .toLowerCase()
    .replace(/[0-9]$/, "")
    .trim();
  return SEC_COLORS[key] ?? "var(--hue-slate)";
}

export function sectionIsVocal(sec: Section): boolean {
  return isVocalSection(sec);
}

// A section's vocal preset/badges should only surface in the UI when lyrics
// are actually being generated — with lyrics off, nothing vocal will render,
// so showing vocal chrome would contradict the instrumental setting.
export function sectionShowsVocal(
  sec: Section,
  lyricsMode: LyricsMode,
): boolean {
  return lyricsMode !== "strict_instrumental" && isVocalSection(sec);
}

export function vocalMeta(vocal?: {
  type?: string;
  delivery?: string;
  energy?: number;
  adlibs?: boolean;
  harmonies?: boolean;
}): string {
  if (!vocal) return "";
  const energyWords = [
    "",
    "intimate",
    "restrained",
    "balanced",
    "powerful",
    "explosive",
  ];
  const parts = [vocal.type, vocal.delivery, energyWords[vocal.energy ?? 0]];
  if (vocal.adlibs) parts.push("ad-libs");
  if (vocal.harmonies) parts.push("harmonies");
  return parts.filter(Boolean).join(", ");
}

export const SECTION_FUNCTIONS: { id: SectionFunction; label: string }[] = [
  { id: "establish", label: "Establish" },
  { id: "introduce", label: "Introduce" },
  { id: "escalate", label: "Escalate" },
  { id: "contrast", label: "Contrast" },
  { id: "remove", label: "Strip back" },
  { id: "peak", label: "Peak" },
  { id: "resolve", label: "Resolve" },
];

export const DELTA_PALETTE = [
  "sparse texture",
  "atmospheric",
  "filtered",
  "add rhythm",
  "rising tension",
  "full groove",
  "bass-led",
  "wide theme",
  "full arrangement",
  "catchy",
  "strip drums",
  "expose harmony",
  "add countermelody",
  "added impact",
  "climactic",
  "introspective",
  "half-time feel",
  "vocal focus",
  "instrumental",
  "reduce layers",
];

export const SECTION_PALETTE = [
  "Intro",
  "Build",
  "Drop",
  "Breakdown",
  "Bridge",
  "Verse",
  "Chorus",
  "Hook",
  "Outro",
];

export const STAGE_LABELS = [
  "Composing arrangement",
  "Writing lyrics",
  "Finalizing bundle",
  "Forging audio with Suno",
];

const VALID_FNS = new Set(SECTION_FUNCTIONS.map((f) => f.id));

function resolveBars(
  bars: SongStructureBarSpec,
  energy: number,
  complexity: number,
): number {
  if (typeof bars === "number") return bars;
  const raw =
    bars.base +
    (bars.per_energy ?? 0) * energy +
    (bars.per_complexity ?? 0) * complexity;
  const rounded = Math.round(raw / 4) * 4;
  return Math.max(4, Math.min(64, rounded));
}

function titleCase(base: string): string {
  return base
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// "build_2" -> explicit "Build 2"; a bare "verse" repeated in the list -> "Verse", "Verse 2", ...
function formatSectionName(raw: string, counts: Map<string, number>): string {
  const m = raw.match(/^(.*)_(\d+)$/);
  const base = m ? m[1]! : raw;
  const title = titleCase(base);
  if (m) return `${title} ${m[2]}`;
  const count = (counts.get(base) ?? 0) + 1;
  counts.set(base, count);
  return count > 1 ? `${title} ${count}` : title;
}

/**
 * Builds an arrangement from the genre's YAML song_structure, sized by the
 * active preset's energy/complexity (bars-as-formula sections scale with
 * them; plain integer bars stay fixed). This is the single source of truth
 * for default arrangements — there is no per-genre hardcoded fallback, so an
 * empty songStructure (data not loaded yet) correctly yields no sections,
 * which the arrangement editor already renders as its "restore default" empty
 * state.
 */
export function buildSections(
  songStructure: SongStructureSection[],
  energy: number,
  complexity: number,
): Section[] {
  const nameCounts = new Map<string, number>();
  return songStructure.map((entry) => ({
    id: generateId(),
    name: formatSectionName(entry.section, nameCounts),
    bars: resolveBars(entry.bars, energy, complexity),
    fn: entry.fn && VALID_FNS.has(entry.fn) ? entry.fn : "establish",
    deltas: [...entry.tags],
  }));
}
