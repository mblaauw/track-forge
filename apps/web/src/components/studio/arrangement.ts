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

/**
 * Sections are coloured by family, on a cold-to-hot scale: the edges of a
 * song are cool, its peaks are the hottest thing on the timeline.
 */
export type SectionFamily = "edge" | "body" | "turn" | "lift" | "peak";

const FAMILY_BY_NAME: Record<string, SectionFamily> = {
  intro: "edge",
  outro: "edge",
  emerge: "edge",
  fade: "edge",
  "spoken word": "edge",
  verse: "body",
  groove: "body",
  movement: "body",
  solo: "body",
  breakdown: "turn",
  bridge: "turn",
  interlude: "turn",
  transition: "turn",
  build: "lift",
  swell: "lift",
  "pre-chorus": "lift",
  "post-chorus": "lift",
  crescendo: "lift",
  drop: "peak",
  hook: "peak",
  chorus: "peak",
  drift: "peak",
  "final chorus": "peak",
  "final hook": "peak",
};

export function sectionFamily(name: string): SectionFamily {
  const key = name
    .toLowerCase()
    .replace(/\s*\d+$/, "")
    .trim();
  return FAMILY_BY_NAME[key] ?? "edge";
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

/**
 * A section's role in the song's arc. `energy` (0–1) sets how tall the
 * section stands on the timeline, so the arc can be read at a glance.
 */
export const SECTION_FUNCTIONS: {
  id: SectionFunction;
  label: string;
  hint: string;
  energy: number;
}[] = [
  { id: "establish", label: "Establish", hint: "Sets the scene", energy: 0.36 },
  {
    id: "introduce",
    label: "Introduce",
    hint: "Brings in a new idea",
    energy: 0.52,
  },
  { id: "escalate", label: "Escalate", hint: "Builds tension", energy: 0.76 },
  {
    id: "contrast",
    label: "Contrast",
    hint: "Changes direction",
    energy: 0.5,
  },
  {
    id: "remove",
    label: "Strip back",
    hint: "Pulls elements out",
    energy: 0.22,
  },
  { id: "peak", label: "Peak", hint: "The biggest moment", energy: 1 },
  {
    id: "resolve",
    label: "Resolve",
    hint: "Winds the song down",
    energy: 0.3,
  },
];

export function roleOf(fn: SectionFunction) {
  return SECTION_FUNCTIONS.find((f) => f.id === fn) ?? SECTION_FUNCTIONS[0]!;
}

/**
 * Name for a new section of the given type: the bare type if it is the
 * first of its kind, otherwise numbered ("Verse 2", "Verse 3"…).
 */
export function nextSectionName(type: string, existing: Section[]): string {
  const taken = new Set(existing.map((sec) => sec.name.toLowerCase()));
  if (!taken.has(type.toLowerCase())) return type;
  for (let n = 2; n < 100; n++) {
    const candidate = `${type} ${n}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
  return type;
}

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
  "Pre-Chorus",
  "Post-Chorus",
  "Final Chorus",
  "Final Hook",
  "Solo",
  "Crescendo",
  "Transition",
  "Spoken Word",
  "Outro",
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

// Normalizes underscores/repeated whitespace to a single space, then
// capitalizes every word — including both sides of a hyphen, so
// "pre-chorus" becomes "Pre-Chorus" (matching SECTION_PALETTE's own
// spelling) rather than "Pre-chorus".
function titleCase(base: string): string {
  return base.replace(/[_\s]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
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
