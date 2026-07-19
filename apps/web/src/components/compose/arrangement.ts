import type { Section, SectionFunction } from "./types";

export type { Section, SectionFunction };

export function generateId(): string {
  return Math.random().toString(36).slice(2, 9);
}

export const SEC_COLORS: Record<string, string> = {
  intro: "var(--hue-slate)",
  outro: "var(--hue-slate)",
  build: "var(--hue-amber)",
  swell: "var(--hue-amber)",
  "pre-chorus": "var(--hue-amber)",
  drop: "var(--hue-green)",
  hook: "var(--hue-green)",
  chorus: "var(--hue-green)",
  breakdown: "var(--hue-violet)",
  bridge: "var(--hue-violet)",
  verse: "var(--hue-cyan)",
  groove: "var(--hue-cyan)",
  "movement i": "var(--hue-cyan)",
  "movement ii": "var(--hue-green)",
};

export function sectionColor(name: string): string {
  const key = name
    .toLowerCase()
    .replace(/[0-9]$/, "")
    .trim();
  return SEC_COLORS[key] ?? "var(--hue-slate)";
}

export function sectionIsVocal(sec: Section): boolean {
  const lowerDeltas = sec.deltas.map((d) => d.toLowerCase());
  if (lowerDeltas.includes("instrumental")) return false;
  if (lowerDeltas.includes("vocal focus") || lowerDeltas.includes("catchy"))
    return true;
  return /verse|chorus|hook|pre-chorus|refrain|bridge|drop/i.test(sec.name);
}

export const SECTION_FUNCTIONS: { id: SectionFunction; label: string }[] = [
  { id: "establish", label: "Establish" },
  { id: "introduce", label: "Introduce" },
  { id: "escalate", label: "Escalate" },
  { id: "contrast", label: "Contrast" },
  { id: "remove", label: "Remove" },
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
  "Interpreting reference",
  "Planning structure",
  "Writing style",
  "Composing arrangement",
  "Reviewing quality",
  "Polishing details",
  "Verifying bundle",
  "Rendering with Suno",
];

export function defaultSections(genreId: string): Section[] {
  const defaults: Record<string, Section[]> = {
    edm: [
      {
        id: generateId(),
        name: "Intro",
        bars: 8,
        fn: "establish",
        deltas: ["atmospheric", "sparse texture"],
      },
      {
        id: generateId(),
        name: "Build",
        bars: 16,
        fn: "introduce",
        deltas: ["add rhythm", "rising tension"],
      },
      {
        id: generateId(),
        name: "Drop",
        bars: 32,
        fn: "peak",
        deltas: ["full groove", "bass-led", "wide theme"],
        vocal: {
          type: "Female lead",
          delivery: "anthemic",
          energy: 4,
          adlibs: false,
          harmonies: true,
        },
      },
      {
        id: generateId(),
        name: "Breakdown",
        bars: 16,
        fn: "remove",
        deltas: ["strip drums", "expose harmony"],
      },
      {
        id: generateId(),
        name: "Build 2",
        bars: 8,
        fn: "escalate",
        deltas: ["rising tension"],
      },
      {
        id: generateId(),
        name: "Drop 2",
        bars: 32,
        fn: "peak",
        deltas: ["added impact", "add countermelody"],
        vocal: {
          type: "Female lead",
          delivery: "anthemic",
          energy: 5,
          adlibs: true,
          harmonies: true,
        },
      },
      {
        id: generateId(),
        name: "Outro",
        bars: 8,
        fn: "resolve",
        deltas: ["reduce layers"],
      },
    ],
    hiphop: [
      {
        id: generateId(),
        name: "Intro",
        bars: 4,
        fn: "establish",
        deltas: ["atmospheric"],
      },
      {
        id: generateId(),
        name: "Verse 1",
        bars: 16,
        fn: "introduce",
        deltas: ["vocal focus"],
        vocal: {
          type: "Male lead",
          delivery: "laid back",
          energy: 3,
          adlibs: false,
          harmonies: false,
        },
      },
      {
        id: generateId(),
        name: "Hook",
        bars: 8,
        fn: "peak",
        deltas: ["full arrangement", "catchy"],
        vocal: {
          type: "Male lead",
          delivery: "laid back",
          energy: 4,
          adlibs: false,
          harmonies: true,
        },
      },
      {
        id: generateId(),
        name: "Verse 2",
        bars: 16,
        fn: "contrast",
        deltas: ["vocal focus"],
        vocal: {
          type: "Male lead",
          delivery: "laid back",
          energy: 3,
          adlibs: false,
          harmonies: false,
        },
      },
      {
        id: generateId(),
        name: "Hook",
        bars: 8,
        fn: "peak",
        deltas: ["full arrangement"],
        vocal: {
          type: "Male lead",
          delivery: "laid back",
          energy: 4,
          adlibs: false,
          harmonies: true,
        },
      },
      {
        id: generateId(),
        name: "Bridge",
        bars: 8,
        fn: "contrast",
        deltas: ["strip drums", "introspective"],
      },
      {
        id: generateId(),
        name: "Outro",
        bars: 4,
        fn: "resolve",
        deltas: ["reduce layers"],
      },
    ],
    ambient: [
      {
        id: generateId(),
        name: "Intro",
        bars: 16,
        fn: "establish",
        deltas: ["atmospheric", "sparse texture"],
      },
      {
        id: generateId(),
        name: "Movement I",
        bars: 32,
        fn: "introduce",
        deltas: ["expose harmony", "add countermelody"],
        vocal: {
          type: "Wordless·textural",
          delivery: "ethereal",
          energy: 1,
          adlibs: false,
          harmonies: false,
        },
      },
      {
        id: generateId(),
        name: "Swell",
        bars: 16,
        fn: "escalate",
        deltas: ["rising tension"],
      },
      {
        id: generateId(),
        name: "Movement II",
        bars: 32,
        fn: "peak",
        deltas: ["full arrangement", "wide theme"],
        vocal: {
          type: "Wordless·textural",
          delivery: "ethereal",
          energy: 2,
          adlibs: false,
          harmonies: false,
        },
      },
      {
        id: generateId(),
        name: "Outro",
        bars: 16,
        fn: "resolve",
        deltas: ["reduce layers"],
      },
    ],
  };
  if (!defaults[genreId]) {
    console.warn(
      `Unknown genre "${genreId}" in defaultSections — falling back to EDM`,
    );
  }
  return defaults[genreId] ?? defaults.edm!;
}
