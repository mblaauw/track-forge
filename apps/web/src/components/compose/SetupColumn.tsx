import { useState, useEffect, useCallback } from "preact/hooks";
import {
  CaretDown,
  CaretRight,
  CaretLeft,
  MagnifyingGlass,
  CheckCircle,
} from "@phosphor-icons/react";
import { useSession } from "../../lib/session";
import type {
  SetupCardId,
  Descriptor,
  DescriptorCategory,
  DescriptorWeight,
} from "./types";
import {
  fetchGenres,
  fetchPresets,
  fetchDescriptorDefaults,
  type GenreInfo,
  type GenrePreset,
  type GenreDescriptorDefaults,
} from "../../api";

const KEY_OPTIONS = [
  "C maj",
  "Db maj",
  "D maj",
  "Eb maj",
  "E maj",
  "F maj",
  "F# maj",
  "G maj",
  "Ab maj",
  "A maj",
  "Bb maj",
  "B maj",
  "C min",
  "C# min",
  "D min",
  "D# min",
  "E min",
  "F min",
  "F# min",
  "G min",
  "G# min",
  "A min",
  "A# min",
  "B min",
];

const LYRIC_ANGLES: { id: string; label: string }[] = [
  { id: "first_person", label: "First person" },
  { id: "story", label: "Storytelling" },
  { id: "abstract", label: "Abstract" },
  { id: "anthemic", label: "Anthemic" },
];

const LYRIC_THEMES: Record<string, string[]> = {
  edm: [
    "euphoria",
    "nightlife",
    "letting go",
    "transcendence",
    "togetherness",
    "the drop",
  ],
  hiphop: [
    "the come-up",
    "the city",
    "loyalty",
    "late nights",
    "ambition",
    "reflection",
  ],
  ambient: ["stillness", "memory", "nature", "solitude", "dreams", "distance"],
  pop: ["love", "heartbreak", "celebration", "freedom", "nostalgia", "summer"],
  dnb: ["urgency", "resistance", "motion", "release", "cities", "intensity"],
};

// Temporary descriptor seeds — replaced by API in Subissue 3
const DESC_DEFAULTS: Record<
  string,
  { label: string; cat: DescriptorCategory; weight: DescriptorWeight }[]
> = {
  edm: [
    { label: "supersaw", cat: "sound", weight: 2 },
    { label: "four-on-the-floor", cat: "rhythm", weight: 2 },
    { label: "sidechain pump", cat: "production", weight: 2 },
    { label: "euphoric", cat: "atmosphere", weight: 2 },
    { label: "high energy", cat: "energy", weight: 2 },
  ],
  hiphop: [
    { label: "808 bass", cat: "sound", weight: 2 },
    { label: "trap hi-hats", cat: "rhythm", weight: 2 },
    { label: "lofi warmth", cat: "production", weight: 2 },
    { label: "dark", cat: "atmosphere", weight: 2 },
    { label: "smooth", cat: "energy", weight: 2 },
  ],
  ambient: [
    { label: "granular pad", cat: "sound", weight: 2 },
    { label: "slow pulse", cat: "rhythm", weight: 2 },
    { label: "cinematic", cat: "atmosphere", weight: 2 },
    { label: "ethereal", cat: "energy", weight: 2 },
    { label: "wide stereo", cat: "production", weight: 2 },
  ],
  pop: [
    { label: "bright chords", cat: "sound", weight: 2 },
    { label: "driving beat", cat: "rhythm", weight: 2 },
    { label: "pop production", cat: "production", weight: 2 },
    { label: "uplifting", cat: "atmosphere", weight: 2 },
    { label: "catchy", cat: "energy", weight: 2 },
  ],
  dnb: [
    { label: "reese bass", cat: "sound", weight: 2 },
    { label: "breakbeat", cat: "rhythm", weight: 2 },
    { label: "heavy compression", cat: "production", weight: 2 },
    { label: "dark", cat: "atmosphere", weight: 2 },
    { label: "high energy", cat: "energy", weight: 2 },
  ],
};

const CAT_POOLS: Record<
  string,
  { cat: DescriptorCategory; label: string; hue: string; chips: string[] }[]
> = {
  edm: [
    {
      cat: "sound",
      label: "SOUND DESIGN",
      hue: "var(--hue-cyan)",
      chips: [
        "supersaw",
        "reese bass",
        "pluck lead",
        "fm bells",
        "granular pad",
        "detuned saw",
        "sine sub",
        "vocal chops",
        "arp sequence",
        "saw stabs",
      ],
    },
    {
      cat: "rhythm",
      label: "RHYTHM",
      hue: "var(--hue-amber)",
      chips: [
        "four-on-the-floor",
        "syncopated hats",
        "offbeat bass",
        "rolling toms",
        "breakbeat",
        "driving kick",
        "shuffled groove",
      ],
    },
    {
      cat: "atmosphere",
      label: "ATMOSPHERE",
      hue: "var(--hue-violet)",
      chips: [
        "euphoric",
        "dark",
        "dreamy",
        "hypnotic",
        "cinematic",
        "nostalgic",
        "uplifting",
        "tense",
      ],
    },
    {
      cat: "production",
      label: "PRODUCTION",
      hue: "var(--hue-green)",
      chips: [
        "sidechain pump",
        "wide stereo",
        "analog warmth",
        "crisp transients",
        "tape saturation",
        "polished master",
        "heavy compression",
      ],
    },
    {
      cat: "energy",
      label: "ENERGY",
      hue: "var(--hue-red)",
      chips: [
        "high energy",
        "driving",
        "restrained build",
        "explosive drop",
        "relentless",
        "dynamic swells",
      ],
    },
  ],
  hiphop: [
    {
      cat: "sound",
      label: "SOUND",
      hue: "var(--hue-cyan)",
      chips: [
        "808 bass",
        "keys",
        "chopped vocal",
        "brass stab",
        "synth pad",
        "pluck",
        "organ",
      ],
    },
    {
      cat: "rhythm",
      label: "RHYTHM & FLOW",
      hue: "var(--hue-amber)",
      chips: [
        "trap hi-hats",
        "swing groove",
        "slow roll",
        "double-time",
        "snare rolls",
        "finger snaps",
      ],
    },
    {
      cat: "atmosphere",
      label: "MOOD",
      hue: "var(--hue-violet)",
      chips: [
        "dark",
        "soulful",
        "melancholic",
        "hype",
        "laid back",
        "gritty",
        "smooth",
      ],
    },
    {
      cat: "production",
      label: "PRODUCTION",
      hue: "var(--hue-green)",
      chips: [
        "lofi warmth",
        "crisp mix",
        "wide stereo",
        "tape saturation",
        "sidechain",
        "heavy 808s",
      ],
    },
    {
      cat: "energy",
      label: "ENERGY",
      hue: "var(--hue-red)",
      chips: [
        "smooth",
        "bouncy",
        "aggressive",
        "relaxed",
        "build-up",
        "hard hitting",
      ],
    },
  ],
  ambient: [
    {
      cat: "sound",
      label: "TEXTURE",
      hue: "var(--hue-cyan)",
      chips: [
        "granular pad",
        "field recording",
        "glass harmonica",
        "tape loop",
        "drone",
        "glockenspiel",
        "organ",
      ],
    },
    {
      cat: "rhythm",
      label: "PULSE",
      hue: "var(--hue-amber)",
      chips: [
        "slow pulse",
        "no beat",
        "irregular rhythm",
        "gentle swell",
        "lullaby tempo",
      ],
    },
    {
      cat: "atmosphere",
      label: "SPACE",
      hue: "var(--hue-violet)",
      chips: [
        "ethereal",
        "cinematic",
        "intimate",
        "vast",
        "underwater",
        "meditative",
        "open",
      ],
    },
    {
      cat: "production",
      label: "LUSH",
      hue: "var(--hue-green)",
      chips: [
        "wide stereo",
        "analog warmth",
        "reverb wash",
        "tape saturation",
        "soft compression",
      ],
    },
    {
      cat: "energy",
      label: "ENERGY",
      hue: "var(--hue-red)",
      chips: [
        "still",
        "slow build",
        "floating",
        "calm",
        "hypnotic",
        "sparse",
        "dense",
      ],
    },
  ],
  pop: [
    {
      cat: "sound",
      label: "SOUND",
      hue: "var(--hue-cyan)",
      chips: [
        "bright chords",
        "synth pads",
        "bell",
        "guitar",
        "brass",
        "brigh leads",
        "strings",
      ],
    },
    {
      cat: "rhythm",
      label: "RHYTHM",
      hue: "var(--hue-amber)",
      chips: [
        "driving beat",
        "handclaps",
        "shaker",
        "four-on-the-floor",
        "syncopated",
        "groove",
      ],
    },
    {
      cat: "atmosphere",
      label: "VIBE",
      hue: "var(--hue-violet)",
      chips: [
        "uplifting",
        "nostalgic",
        "dreamy",
        "romantic",
        "melancholic",
        "energetic",
        "sweet",
      ],
    },
    {
      cat: "production",
      label: "PRODUCTION",
      hue: "var(--hue-green)",
      chips: [
        "pop polish",
        "radio-ready",
        "wide stereo",
        "crisp mix",
        "bright master",
        "compressed",
      ],
    },
    {
      cat: "energy",
      label: "ENERGY",
      hue: "var(--hue-red)",
      chips: [
        "catchy",
        "bouncy",
        "building",
        "explosive",
        "driving",
        "smooth",
        "powerful",
      ],
    },
  ],
  dnb: [
    {
      cat: "sound",
      label: "SIGNATURE",
      hue: "var(--hue-cyan)",
      chips: [
        "reese bass",
        "neuro bass",
        "liquid pads",
        "chopped vocal",
        "synth hook",
        "sub bass",
        "amen break",
      ],
    },
    {
      cat: "rhythm",
      label: "DRUMS",
      hue: "var(--hue-amber)",
      chips: [
        "breakbeat",
        "half-time",
        "double-time",
        "rolled snares",
        "shuffled",
        "glitchy hats",
      ],
    },
    {
      cat: "atmosphere",
      label: "MOOD",
      hue: "var(--hue-violet)",
      chips: [
        "dark",
        "liquid",
        "energetic",
        "deep",
        "menacing",
        "soulful",
        "tense",
      ],
    },
    {
      cat: "production",
      label: "PRODUCTION",
      hue: "var(--hue-green)",
      chips: [
        "heavy compression",
        "wide stereo",
        "bass processing",
        "crisp highs",
        "clipping master",
      ],
    },
    {
      cat: "energy",
      label: "ENERGY",
      hue: "var(--hue-red)",
      chips: [
        "high energy",
        "relentless",
        "building",
        "explosive",
        "driving",
        "frenetic",
        "intense",
      ],
    },
  ],
};

function cycleTag(
  tags: Descriptor[],
  label: string,
  cat: DescriptorCategory,
): Descriptor[] {
  const idx = tags.findIndex((t) => t.label === label);
  if (idx === -1) {
    return [
      ...tags,
      { id: label, label, cat, weight: 1 as DescriptorWeight, muted: false },
    ];
  }
  const existing = tags[idx]!;
  if (existing.weight >= 3) {
    return tags.filter((t) => t.label !== label);
  }
  const next = [...tags];
  next[idx] = {
    ...existing,
    weight: (existing.weight + 1) as DescriptorWeight,
  };
  return next;
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 9);
}

function defaultSections(genreId: string): import("./types").Section[] {
  const defaults: Record<string, import("./types").Section[]> = {
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
      },
      {
        id: generateId(),
        name: "Hook",
        bars: 8,
        fn: "peak",
        deltas: ["full arrangement", "catchy"],
      },
      {
        id: generateId(),
        name: "Verse 2",
        bars: 16,
        fn: "contrast",
        deltas: ["vocal focus"],
      },
      {
        id: generateId(),
        name: "Hook",
        bars: 8,
        fn: "peak",
        deltas: ["full arrangement"],
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
  return defaults[genreId] ?? defaults.edm!;
}

function defaultDescriptors(
  genreId: string,
  apiDefaults?: { label: string; cat: string; weight: number }[] | null,
): Descriptor[] {
  const seed =
    apiDefaults && apiDefaults.length > 0
      ? apiDefaults
      : (DESC_DEFAULTS[genreId] ?? DESC_DEFAULTS.edm!);
  return seed.map((d) => ({
    id: d.label,
    label: d.label,
    cat: d.cat as DescriptorCategory,
    weight: d.weight as DescriptorWeight,
    muted: false,
  }));
}

const CARDS: { id: SetupCardId; label: string }[] = [
  { id: "genre", label: "GENRE" },
  { id: "preset", label: "PRESET" },
  { id: "lyrics", label: "LYRICS" },
  { id: "tempo", label: "TEMPO & KEY" },
  { id: "descriptors", label: "DESCRIPTORS" },
  { id: "reference", label: "REFERENCE" },
];

export function SetupColumn() {
  const s = useSession();
  const { leftCollapsed, togglePanel, cards, toggleCard } = s;

  // Transient UI state (not in session store)
  const [genres, setGenres] = useState<GenreInfo[]>([]);
  const [presets, setPresets] = useState<GenrePreset[]>([]);
  const [descDefaults, setDescDefaults] =
    useState<GenreDescriptorDefaults | null>(null);
  const [genreSearch, setGenreSearch] = useState("");
  const [presetSearch, setPresetSearch] = useState("");

  useEffect(() => {
    fetchGenres()
      .then(setGenres)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (s.genreId) {
      fetchPresets(s.genreId)
        .then(setPresets)
        .catch(() => {});
      fetchDescriptorDefaults(s.genreId)
        .then(setDescDefaults)
        .catch(() => {});
    }
  }, [s.genreId]);

  // Genre color lookup (from API color field or known mapping)
  const genreColor = genres.find((g) => g.id === s.genreId)?.color ?? "cyan";

  if (leftCollapsed) {
    return (
      <div
        class="col-rail collapsed"
        onClick={() => togglePanel("left")}
        title="Expand setup"
      >
        <CaretRight size={16} />
        <span class="rail-vertical-label">SETUP</span>
      </div>
    );
  }

  return (
    <div class="setup-col">
      <div class="col-header">
        <span class="col-header-label">SETUP</span>
        <button
          class="col-collapse-btn"
          onClick={() => togglePanel("left")}
          title="Collapse setup"
        >
          <CaretLeft size={16} />
        </button>
      </div>
      <div class="col-body tf-scroll">
        {CARDS.map((c) => (
          <div class="setup-card" key={c.id}>
            <button class="setup-card-header" onClick={() => toggleCard(c.id)}>
              <span class="setup-card-label">{c.label}</span>
              <span class="setup-card-summary">{cardSummary(c.id, s)}</span>
              {cards[c.id] ? (
                <CaretDown size={14} class="setup-card-chevron" />
              ) : (
                <CaretRight size={14} class="setup-card-chevron" />
              )}
            </button>
            {cards[c.id] && (
              <div class="setup-card-body">
                {renderCardBody(c.id, s, {
                  genres,
                  presets,
                  descDefaults,
                  genreSearch,
                  setGenreSearch,
                  presetSearch,
                  setPresetSearch,
                  genreColor,
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function cardSummary(
  id: SetupCardId,
  s: ReturnType<typeof useSession>,
): string {
  switch (id) {
    case "genre":
      return s.genreId ? s.genreId.toUpperCase() : "—";
    case "preset":
      return s.presetIds.length
        ? s.presetIds.map((p) => p.replace(/_/g, " ")).join(", ")
        : "—";
    case "lyrics":
      return s.lyricsMode === "full_lyrics" ? "On" : "Off";
    case "tempo":
      return s.bpm ? `${s.bpm} BPM · ${s.key || "—"}` : "—";
    case "descriptors": {
      const active = s.tags.filter((t) => !t.muted).length;
      return `${active} active`;
    }
    case "reference":
      return s.reference ? "set" : "none";
  }
}

interface CardCtx {
  genres: GenreInfo[];
  presets: GenrePreset[];
  descDefaults: GenreDescriptorDefaults | null;
  genreSearch: string;
  setGenreSearch: (v: string) => void;
  presetSearch: string;
  setPresetSearch: (v: string) => void;
  genreColor: string;
}

function renderCardBody(
  id: SetupCardId,
  s: ReturnType<typeof useSession>,
  ctx: CardCtx,
): preact.VNode {
  switch (id) {
    case "genre":
      return <GenreCardContent {...ctx} s={s} />;
    case "preset":
      return <PresetCardContent {...ctx} s={s} />;
    case "lyrics":
      return <LyricsCardContent s={s} />;
    case "tempo":
      return <TempoCardContent s={s} />;
    case "descriptors":
      return <DescriptorsCardContent {...ctx} s={s} />;
    case "reference":
      return <ReferenceCardContent s={s} />;
  }
}

/* ─── GENRE ─── */

function GenreCardContent({
  genres,
  genreSearch,
  setGenreSearch,
  presets,
  descDefaults,
  s,
}: CardCtx & { s: ReturnType<typeof useSession> }) {
  const filtered = genres.filter(
    (g) =>
      !genreSearch ||
      g.name.toLowerCase().includes(genreSearch.toLowerCase()) ||
      g.id.toLowerCase().includes(genreSearch.toLowerCase()),
  );

  return (
    <>
      <div style="position:relative;margin-bottom:8px">
        <MagnifyingGlass
          size={14}
          style="position:absolute;left:8px;top:50%;transform:translateY(-50%);color:var(--faint)"
        />
        <input
          class="setup-search"
          placeholder={`Search ${genres.length} genres…`}
          value={genreSearch}
          onInput={(e) => setGenreSearch((e.target as HTMLInputElement).value)}
        />
      </div>
      <div class="setup-select-list tf-scroll" style="max-height:200px">
        {filtered.map((g) => {
          const active = s.genreId === g.id;
          return (
            <button
              key={g.id}
              class={`setup-select-item${active ? " active" : ""}`}
              onClick={() => {
                if (g.id === s.genreId) return;
                const firstPreset = presets?.[0]?.id ?? "";
                const firstTheme =
                  (LYRIC_THEMES[g.id] ?? LYRIC_THEMES.edm!)?.[0] ?? "";
                s.setSession({
                  genreId: g.id,
                  presetId: firstPreset,
                  presetIds: firstPreset ? [firstPreset] : [],
                  tags: defaultDescriptors(g.id, descDefaults?.defaults),
                  sections: defaultSections(g.id),
                  lyricThemes: firstTheme ? [firstTheme] : [],
                  lyricsGenerated: false,
                  lyricLines: {},
                });
              }}
            >
              <span
                class="setup-dot"
                style={{
                  background: `var(--hue-${g.color ?? "slate"})`,
                }}
              />
              <span class="setup-select-name">{g.name}</span>
              {g.subgenre_count && (
                <span class="setup-select-sub">{g.subgenre_count}</span>
              )}
              {active && (
                <CheckCircle
                  size={16}
                  weight="fill"
                  style="color:var(--success-text);margin-left:auto"
                />
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}

/* ─── PRESET ─── */

function PresetCardContent({
  presets,
  presetSearch,
  setPresetSearch,
  s,
}: CardCtx & { s: ReturnType<typeof useSession> }) {
  const filtered = presets.filter(
    (p) =>
      !presetSearch ||
      p.name.toLowerCase().includes(presetSearch.toLowerCase()),
  );

  return (
    <>
      <div style="position:relative;margin-bottom:8px">
        <MagnifyingGlass
          size={14}
          style="position:absolute;left:8px;top:50%;transform:translateY(-50%);color:var(--faint)"
        />
        <input
          class="setup-search"
          placeholder={`Search ${presets.length} presets…`}
          value={presetSearch}
          onInput={(e) => setPresetSearch((e.target as HTMLInputElement).value)}
        />
      </div>
      <div class="setup-select-list tf-scroll" style="max-height:200px">
        {filtered.map((p) => {
          const active = s.presetIds.includes(p.id);
          return (
            <button
              key={p.id}
              class={`setup-select-item${active ? " active" : ""}`}
              onClick={() => {
                // Toggle multi-select
                const next = active
                  ? s.presetIds.filter((id) => id !== p.id)
                  : [...s.presetIds, p.id];
                s.setSession({ presetIds: next, presetId: next[0] ?? "" });
              }}
            >
              <span style="flex:1;text-align:left;font-size:12px;font-weight:600;color:var(--tx)">
                {p.name}
              </span>
              {active && (
                <CheckCircle
                  size={16}
                  weight="fill"
                  style="color:var(--success-text);margin-left:auto"
                />
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}

/* ─── LYRICS ─── */

function LyricsCardContent({ s }: { s: ReturnType<typeof useSession> }) {
  const lyricsOn = s.lyricsMode === "full_lyrics";
  const themes = LYRIC_THEMES[s.genreId] ?? LYRIC_THEMES.edm!;

  return (
    <>
      <div class="setup-row" style="justify-content:space-between">
        <span style="font-size:12px;font-weight:600;color:var(--tx)">
          Vocals & lyrics
        </span>
        <button
          class="setup-toggle"
          style={{
            background: lyricsOn ? "var(--forge)" : "#D9CEBE",
            justifyContent: lyricsOn ? "flex-end" : "flex-start",
          }}
          onClick={() =>
            s.setSession({
              lyricsMode: lyricsOn ? "strict_instrumental" : "full_lyrics",
            })
          }
        >
          <span class="setup-toggle-knob" />
        </button>
      </div>
      {!lyricsOn ? (
        <p class="setup-hint">
          Instrumental only. No lyrics or vocals will be generated. Suno
          metatags will use instrumental markers.
        </p>
      ) : (
        <>
          <p class="setup-hint">
            Adding lyrics? Set the vibe and angle below, or leave blank for the
            AI to invent.
          </p>
          <div
            class="tf-mono"
            style="font-size:9.5px;letter-spacing:.1em;color:var(--faint);font-weight:600;margin:10px 0 7px"
          >
            WHAT'S THE SONG ABOUT?
          </div>
          <textarea
            class="setup-textarea"
            placeholder="e.g. a late-night drive after a breakup, chasing the last of the city lights…"
            value={s.lyricTopic}
            onInput={(e) =>
              s.setSession({
                lyricTopic: (e.target as HTMLTextAreaElement).value,
              })
            }
          />

          <div
            class="tf-mono"
            style="font-size:9.5px;letter-spacing:.1em;color:var(--faint);font-weight:600;margin:10px 0 7px"
          >
            ANGLE
          </div>
          <div class="setup-chip-row">
            {LYRIC_ANGLES.map((a) => {
              const active = s.lyricAngle === a.id;
              return (
                <button
                  key={a.id}
                  class={`setup-chip${active ? " active-dark" : ""}`}
                  onClick={() =>
                    s.setSession({ lyricAngle: a.id as typeof s.lyricAngle })
                  }
                >
                  {a.label}
                </button>
              );
            })}
          </div>

          <div
            class="tf-mono"
            style="font-size:9.5px;letter-spacing:.1em;color:var(--faint);font-weight:600;margin:10px 0 7px"
          >
            THEMES
          </div>
          <div class="setup-pill-row">
            {themes.map((t) => {
              const active = s.lyricThemes.includes(t);
              return (
                <button
                  key={t}
                  class={`setup-pill${active ? " active" : ""}`}
                  onClick={() => {
                    const next = active
                      ? s.lyricThemes.filter((th) => th !== t)
                      : [...s.lyricThemes, t];
                    s.setSession({ lyricThemes: next });
                  }}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}

/* ─── TEMPO & KEY ─── */

function TempoCardContent({ s }: { s: ReturnType<typeof useSession> }) {
  const bpm = s.bpm ?? 128;
  const currentKey =
    s.key && s.scale ? `${s.key} ${s.scale === "major" ? "maj" : "min"}` : "";

  return (
    <>
      <div
        class="tf-mono"
        style="font-size:9.5px;letter-spacing:.1em;color:var(--faint);font-weight:600;margin-bottom:7px"
      >
        TEMPO
      </div>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
        <span
          class="tf-mono"
          style="font-size:14px;font-weight:700;color:var(--forge)"
        >
          {bpm}
          <span style="font-size:9px;color:var(--faint);font-weight:500">
            {" "}
            BPM
          </span>
        </span>
        <div style="flex:1">
          <input
            type="range"
            class="setup-slider"
            min={60}
            max={200}
            value={bpm}
            onInput={(e) =>
              s.setSession({
                bpm: Number((e.target as HTMLInputElement).value),
              })
            }
          />
        </div>
      </div>

      <div
        class="tf-mono"
        style="font-size:9.5px;letter-spacing:.1em;color:var(--faint);font-weight:600;margin-bottom:7px"
      >
        KEY
      </div>
      <select
        class="setup-select"
        value={currentKey}
        onChange={(e) => {
          const val = (e.target as HTMLSelectElement).value;
          const parts = val.split(" ");
          if (parts.length === 2) {
            const scale =
              parts[1] === "maj"
                ? "major"
                : parts[1] === "min"
                  ? "minor"
                  : parts[1]!;
            s.setSession({ key: parts[0]!, scale: scale as "major" | "minor" });
          }
        }}
      >
        <option value="" disabled>
          Select a key
        </option>
        {KEY_OPTIONS.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </>
  );
}

/* ─── DESCRIPTORS ─── */

function DescriptorsCardContent({
  descDefaults,
  s,
}: {
  descDefaults: GenreDescriptorDefaults | null;
  s: ReturnType<typeof useSession>;
}) {
  const apiPool = descDefaults?.categories;
  const pool =
    apiPool && apiPool.length > 0
      ? (apiPool as {
          cat: DescriptorCategory;
          label: string;
          hue: string;
          chips: string[];
        }[])
      : (CAT_POOLS[s.genreId] ?? CAT_POOLS.edm!);
  const activeTags = s.tags.filter((t) => !t.muted);
  const seedData =
    descDefaults?.defaults ?? DESC_DEFAULTS[s.genreId] ?? DESC_DEFAULTS.edm!;
  const seedCount = seedData.length;

  return (
    <>
      <div class="setup-desc-badge-row">
        <span class="setup-desc-badge">
          {s.genreId.toUpperCase()} · {seedCount} descriptors seeded
        </span>
        <span style="font-size:10px;color:var(--faint)">override freely</span>
        <button
          class="setup-link-btn"
          onClick={() =>
            s.setSession({
              tags: defaultDescriptors(s.genreId, descDefaults?.defaults),
            })
          }
        >
          Reset
        </button>
      </div>
      <div class="setup-desc-lanes tf-scroll" style="max-height:246px">
        {pool.map((cat) => {
          const catTags = s.tags.filter((t) => t.cat === cat.cat && !t.muted);
          return (
            <div class="setup-desc-lane" key={cat.cat}>
              <div class="setup-desc-lane-header">
                <span class="setup-dot" style={{ background: cat.hue }} />
                <span
                  class="tf-mono"
                  style="font-size:9px;letter-spacing:.08em;color:var(--dim);font-weight:600"
                >
                  {cat.label}
                </span>
                <span class="setup-desc-lane-divider" />
                <span class="tf-mono" style="font-size:9px;color:var(--faint)">
                  {catTags.length}
                </span>
              </div>
              <div class="setup-desc-chips">
                {cat.chips.map((chip) => {
                  const tag = s.tags.find((t) => t.label === chip);
                  const active = !!tag && !tag.muted;
                  return (
                    <button
                      key={chip}
                      class={`setup-desc-chip${active ? " active" : ""}`}
                      style={
                        active
                          ? { borderColor: cat.hue, background: "var(--inset)" }
                          : undefined
                      }
                      onClick={() =>
                        s.setSession({ tags: cycleTag(s.tags, chip, cat.cat) })
                      }
                    >
                      <span class="setup-desc-meter" style={{ color: cat.hue }}>
                        {Array.from({ length: 3 }, (_, i) => (
                          <span
                            key={i}
                            class="setup-desc-meter-bar"
                            style={{
                              height: `${3 + i * 2}px`,
                              background:
                                active && (tag?.weight ?? 0) > i
                                  ? cat.hue
                                  : "var(--border-chip-off)",
                            }}
                          />
                        ))}
                      </span>
                      <span>{chip}</span>
                      {active && (
                        <span class="setup-desc-weight">{tag?.weight}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ─── REFERENCE ─── */

function ReferenceCardContent({ s }: { s: ReturnType<typeof useSession> }) {
  return (
    <textarea
      class="setup-textarea"
      style="min-height:72px"
      placeholder="Paste a reference track URL or describe the vibe…"
      value={s.reference}
      onInput={(e) =>
        s.setSession({ reference: (e.target as HTMLTextAreaElement).value })
      }
    />
  );
}
