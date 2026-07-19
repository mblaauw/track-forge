import { useMemo, useState, useEffect } from "preact/hooks";
import {
  Rows,
  Shuffle,
  MicrophoneStage,
  Plus,
  X,
  CaretLeft,
  CaretRight,
} from "@phosphor-icons/react";
import { useSession } from "../../lib/session";
import { fetchDescriptorDefaults } from "../../api";
import type { Section, SectionFunction } from "./types";

const SEC_COLORS: Record<string, string> = {
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

const SECTION_FUNCTIONS: { id: SectionFunction; label: string }[] = [
  { id: "establish", label: "Establish" },
  { id: "introduce", label: "Introduce" },
  { id: "escalate", label: "Escalate" },
  { id: "contrast", label: "Contrast" },
  { id: "remove", label: "Remove" },
  { id: "peak", label: "Peak" },
  { id: "resolve", label: "Resolve" },
];

const DELTA_PALETTE = [
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

const SECTION_PALETTE = [
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

const vocalTypes = [
  "Female lead",
  "Male lead",
  "Duet",
  "Group·choir",
  "Wordless·textural",
];

const deliveryStyles = [
  "anthemic",
  "belted",
  "airy",
  "chopped",
  "vocoded",
  "laid back",
  "smooth",
  "ethereal",
  "powerful",
  "intimate",
];

function sectionColor(name: string): string {
  const key = name
    .toLowerCase()
    .replace(/[0-9]$/, "")
    .trim();
  return SEC_COLORS[key] ?? "var(--hue-slate)";
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 9);
}

function estTime(totalBars: number, bpm: number): string {
  const sec = (totalBars * 4 * 60) / Math.max(bpm, 1);
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function sectionIsVocal(sec: Section): boolean {
  const lowerDeltas = sec.deltas.map((d) => d.toLowerCase());
  if (lowerDeltas.includes("instrumental")) return false;
  if (lowerDeltas.includes("vocal focus") || lowerDeltas.includes("catchy"))
    return true;
  return /verse|chorus|hook|pre-chorus|refrain|bridge|drop/i.test(sec.name);
}

export function ArrangementEditor() {
  const s = useSession();
  const totalBars = s.sections.reduce((acc, sec) => acc + sec.bars, 0);
  const time = estTime(totalBars, s.bpm ?? 128);
  const sel = s.sections.find((sec) => sec.id === s.selSectionId);

  const [vocab, setVocab] = useState<{
    sectionFunctions: string[];
    deltaPalette: string[];
    sectionPalette: string[];
    vocalPresets: {
      type: string;
      deliveryStyle: string;
      defaultEnergy: number;
    }[];
  } | null>(null);

  useEffect(() => {
    if (s.genreId)
      fetchDescriptorDefaults(s.genreId)
        .then(setVocab)
        .catch(() => {});
  }, [s.genreId]);

  const deltas = vocab?.deltaPalette ?? DELTA_PALETTE;
  const sections = vocab?.sectionPalette ?? SECTION_PALETTE;
  const funcs = vocab?.sectionFunctions ?? SECTION_FUNCTIONS.map((f) => f.id);
  const vocalTypes = vocab?.vocalPresets.map((v) => v.type) ?? [
    "Female lead",
    "Male lead",
    "Duet",
    "Group·choir",
    "Wordless·textural",
  ];
  const deliveryStyles = [
    ...new Set(
      vocab?.vocalPresets.map((v) => v.deliveryStyle) ?? [
        "anthemic",
        "belted",
        "airy",
        "chopped",
        "vocoded",
        "laid back",
        "smooth",
        "ethereal",
        "powerful",
        "intimate",
      ],
    ),
  ];

  const genVariation = () => {
    const varied = s.sections.map((sec) => {
      const bars = [4, 8, 16, 24, 32][Math.floor(Math.random() * 5)]!;
      const deltaCount = 1 + Math.floor(Math.random() * 3);
      const deltas: string[] = [];
      const pool = [...DELTA_PALETTE];
      for (let i = 0; i < deltaCount && pool.length > 0; i++) {
        const idx = Math.floor(Math.random() * pool.length);
        deltas.push(pool[idx]!);
        pool.splice(idx, 1);
      }
      return {
        ...sec,
        bars,
        deltas,
        vocal: sectionIsVocal({ ...sec, deltas })
          ? {
              type: vocalTypes[Math.floor(Math.random() * vocalTypes.length)]!,
              delivery:
                deliveryStyles[
                  Math.floor(Math.random() * deliveryStyles.length)
                ]!,
              energy: (1 + Math.floor(Math.random() * 5)) as 1 | 2 | 3 | 4 | 5,
              adlibs: Math.random() > 0.5,
              harmonies: Math.random() > 0.5,
            }
          : undefined,
      };
    });
    s.setSession({
      sections: varied,
      arrangeSource: "custom",
      lyricsGenerated: false,
      lyricLines: {},
    });
  };

  return (
    <div class="bundle-block">
      <div class="bundle-block-header">
        <Rows size={16} style="color:var(--icon-arr)" />
        <span class="bundle-block-title">ARRANGEMENT STRUCTURE</span>
        <span class="bundle-block-meta">
          {totalBars} bars · {time}
        </span>
        <div style="margin-left:auto;display:flex;gap:6px">
          {s.arrangeSource === "custom" && (
            <button
              class="arr-action-btn"
              onClick={() =>
                s.setSession({
                  sections: defaultSections(s.genreId),
                  arrangeSource: "default",
                  selSectionId: null,
                  lyricsGenerated: false,
                  lyricLines: {},
                })
              }
            >
              Reset
            </button>
          )}
          <button class="arr-action-btn" onClick={genVariation}>
            <Shuffle size={14} /> Variation
          </button>
        </div>
      </div>
      <div class="bundle-block-body">
        <div class="arr-badge-row">
          <span
            class={`arr-badge${s.arrangeSource === "custom" ? " custom" : ""}`}
          >
            {s.arrangeSource === "custom"
              ? "CUSTOM ARRANGEMENT"
              : `DEFAULT · ${s.genreId.toUpperCase()}`}
          </span>
          <span class="arr-helper">
            Drag to reorder, click to edit each section
          </span>
        </div>

        {/* Section timeline */}
        <div class="arr-timeline">
          {s.sections.length === 0 ? (
            <div class="arr-empty">
              All sections removed
              <button
                class="arr-restore-btn"
                onClick={() =>
                  s.setSession({
                    sections: defaultSections(s.genreId),
                    arrangeSource: "default",
                  })
                }
              >
                Restore default
              </button>
            </div>
          ) : (
            <div class="arr-timeline-scroll">
              {s.sections.map((sec) => (
                <button
                  key={sec.id}
                  class={`arr-section${sec.id === s.selSectionId ? " selected" : ""}`}
                  style={{
                    flex: sec.bars,
                    background: sectionColor(sec.name),
                    minWidth: 34,
                  }}
                  onClick={() => s.setSession({ selSectionId: sec.id })}
                >
                  <span class="arr-section-name">{sec.name}</span>
                  <span class="arr-section-bars">{sec.bars}b</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Selected section editor */}
        {sel && (
          <div class="arr-editor">
            <div class="arr-editor-row">
              <span class="arr-editor-label">{sel.name}</span>
              <div class="arr-stepper">
                <button
                  class="arr-stepper-btn"
                  onClick={() => {
                    const next = s.sections.map((sec) =>
                      sec.id === sel.id && sec.bars > 4
                        ? { ...sec, bars: sec.bars - 4 }
                        : sec,
                    );
                    s.setSession({
                      sections: next,
                      arrangeSource: "custom",
                      lyricsGenerated: false,
                      lyricLines: {},
                    });
                  }}
                >
                  −
                </button>
                <span class="arr-stepper-value">{sel.bars}</span>
                <button
                  class="arr-stepper-btn"
                  onClick={() => {
                    const next = s.sections.map((sec) =>
                      sec.id === sel.id && sec.bars < 64
                        ? { ...sec, bars: sec.bars + 4 }
                        : sec,
                    );
                    s.setSession({
                      sections: next,
                      arrangeSource: "custom",
                      lyricsGenerated: false,
                      lyricLines: {},
                    });
                  }}
                >
                  +
                </button>
              </div>
              <div class="arr-editor-actions">
                <button
                  class="arr-editor-btn"
                  onClick={() => {
                    const idx = s.sections.findIndex(
                      (sec) => sec.id === sel.id,
                    );
                    if (idx <= 0) return;
                    const next = [...s.sections];
                    [next[idx - 1]!, next[idx]!] = [next[idx]!, next[idx - 1]!];
                    s.setSession({ sections: next, arrangeSource: "custom" });
                  }}
                  disabled={s.sections.indexOf(sel) === 0}
                >
                  <CaretLeft size={14} />
                </button>
                <button
                  class="arr-editor-btn"
                  onClick={() => {
                    const idx = s.sections.findIndex(
                      (sec) => sec.id === sel.id,
                    );
                    if (idx < 0 || idx >= s.sections.length - 1) return;
                    const next = [...s.sections];
                    [next[idx]!, next[idx + 1]!] = [next[idx + 1]!, next[idx]!];
                    s.setSession({ sections: next, arrangeSource: "custom" });
                  }}
                  disabled={s.sections.indexOf(sel) === s.sections.length - 1}
                >
                  <CaretRight size={14} />
                </button>
                <button
                  class="arr-editor-btn"
                  onClick={() => {
                    const newSec = { ...sel, id: generateId() };
                    const idx = s.sections.findIndex(
                      (sec) => sec.id === sel.id,
                    );
                    const next = [...s.sections];
                    next.splice(idx + 1, 0, newSec);
                    s.setSession({
                      sections: next,
                      selSectionId: newSec.id,
                      arrangeSource: "custom",
                      lyricsGenerated: false,
                      lyricLines: {},
                    });
                  }}
                >
                  Duplicate
                </button>
                <button
                  class="arr-editor-btn danger"
                  onClick={() => {
                    const next = s.sections.filter((sec) => sec.id !== sel.id);
                    s.setSession({
                      sections: next,
                      selSectionId: next[0]?.id ?? null,
                      arrangeSource: "custom",
                      lyricsGenerated: false,
                      lyricLines: {},
                    });
                  }}
                >
                  Remove
                </button>
              </div>
            </div>

            {/* Section function pills */}
            <div class="arr-editor-section">
              <span class="arr-editor-section-label">FUNCTION</span>
              <div class="arr-pill-row">
                {funcs.map((fnId) => {
                  const fnObj = SECTION_FUNCTIONS.find((f) => f.id === fnId);
                  if (!fnObj) return null;
                  return (
                    <button
                      key={fnId}
                      class={`arr-pill${sel.fn === fnId ? " active" : ""}`}
                      onClick={() => {
                        const next = s.sections.map((sec) =>
                          sec.id === sel.id
                            ? { ...sec, fn: fnId as SectionFunction }
                            : sec,
                        );
                        s.setSession({
                          sections: next,
                          arrangeSource: "custom",
                        });
                      }}
                    >
                      {fnObj.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Local deltas */}
            <div class="arr-editor-section">
              <span class="arr-editor-section-label">LOCAL CHANGE</span>
              <p class="arr-editor-helper">
                Only local changes live here — global sound belongs in the Style
                Console. A "vocal focus" delta (or Verse/Chorus/Hook/Drop
                section) gets lyrics; everything else stays instrumental.
              </p>
              <div class="arr-delta-row">
                {sel.deltas.map((delta) => (
                  <span class="arr-delta-pill">
                    {delta}
                    <button
                      class="arr-delta-remove"
                      onClick={() => {
                        const next = s.sections.map((sec) =>
                          sec.id === sel.id
                            ? {
                                ...sec,
                                deltas: sec.deltas.filter((d) => d !== delta),
                              }
                            : sec,
                        );
                        s.setSession({
                          sections: next,
                          arrangeSource: "custom",
                          lyricsGenerated: false,
                          lyricLines: {},
                        });
                      }}
                    >
                      <X size={10} />
                    </button>
                  </span>
                ))}
                <div class="arr-delta-add-group">
                  {deltas
                    .filter((d) => !sel.deltas.includes(d))
                    .map((delta) => (
                      <button
                        key={delta}
                        class="arr-delta-add"
                        onClick={() => {
                          const next = s.sections.map((sec) =>
                            sec.id === sel.id
                              ? { ...sec, deltas: [...sec.deltas, delta] }
                              : sec,
                          );
                          s.setSession({
                            sections: next,
                            arrangeSource: "custom",
                            lyricsGenerated: false,
                            lyricLines: {},
                          });
                        }}
                      >
                        <Plus size={10} /> {delta}
                      </button>
                    ))}
                </div>
              </div>
            </div>

            {/* Vocal delivery (only when section is vocal and not instrumental mode) */}
            {sectionIsVocal(sel) && s.lyricsMode !== "strict_instrumental" && (
              <div class="arr-vocal-editor">
                <MicrophoneStage size={14} style="color:var(--danger-text)" />
                <span
                  class="arr-editor-section-label"
                  style="color:var(--danger-text)"
                >
                  VOCAL DELIVERY
                </span>

                <div class="arr-editor-section" style="margin-top:8px">
                  <span class="arr-editor-sub-label">VOICE</span>
                  <select
                    class="arr-select"
                    value={sel.vocal?.type ?? vocalTypes[0]!}
                    onChange={(e) => {
                      const type = (e.target as HTMLSelectElement).value;
                      const next = s.sections.map((sec) =>
                        sec.id === sel.id
                          ? {
                              ...sec,
                              vocal: {
                                ...(sec.vocal ?? {
                                  delivery: deliveryStyles[0]!,
                                  energy: 3,
                                  adlibs: false,
                                  harmonies: false,
                                }),
                                type,
                              },
                            }
                          : sec,
                      );
                      s.setSession({ sections: next });
                    }}
                  >
                    {vocalTypes.map((vt: string) => (
                      <option key={vt} value={vt}>
                        {vt}
                      </option>
                    ))}
                  </select>
                </div>

                <div class="arr-editor-section">
                  <span class="arr-editor-sub-label">INTENSITY</span>
                  <div class="arr-intensity-row">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        class={`arr-intensity-dot${(sel.vocal?.energy ?? 3) >= n ? " filled" : ""}`}
                        style={
                          (sel.vocal?.energy ?? 3) >= n
                            ? { background: "var(--hue-red)" }
                            : undefined
                        }
                        onClick={() => {
                          const next = s.sections.map((sec) =>
                            sec.id === sel.id
                              ? {
                                  ...sec,
                                  vocal: {
                                    ...(sec.vocal ?? {
                                      type: vocalTypes[0]!,
                                      delivery: deliveryStyles[0]!,
                                      adlibs: false,
                                      harmonies: false,
                                    }),
                                    energy: n as 1 | 2 | 3 | 4 | 5,
                                  },
                                }
                              : sec,
                          );
                          s.setSession({ sections: next });
                        }}
                      />
                    ))}
                  </div>
                </div>

                <div class="arr-editor-section">
                  <span class="arr-editor-sub-label">DELIVERY STYLE</span>
                  <div class="arr-pill-row">
                    {deliveryStyles.map((ds) => (
                      <button
                        key={ds}
                        class={`arr-pill${(sel.vocal?.delivery ?? "") === ds ? " active" : ""}`}
                        onClick={() => {
                          const next = s.sections.map((sec) =>
                            sec.id === sel.id
                              ? {
                                  ...sec,
                                  vocal: {
                                    ...(sec.vocal ?? {
                                      type: vocalTypes[0]!,
                                      energy: 3,
                                      adlibs: false,
                                      harmonies: false,
                                    }),
                                    delivery: ds,
                                  },
                                }
                              : sec,
                          );
                          s.setSession({ sections: next });
                        }}
                      >
                        {ds}
                      </button>
                    ))}
                  </div>
                </div>

                <div class="arr-editor-section">
                  <div class="arr-toggle-row">
                    <button
                      class={`arr-toggle-btn${sel.vocal?.adlibs ? " on" : ""}`}
                      onClick={() => {
                        const next = s.sections.map((sec) =>
                          sec.id === sel.id
                            ? {
                                ...sec,
                                vocal: {
                                  ...(sec.vocal ?? {
                                    type: vocalTypes[0]!,
                                    delivery: deliveryStyles[0]!,
                                    energy: 3,
                                    adlibs: false,
                                    harmonies: false,
                                  }),
                                  adlibs: !(sec.vocal?.adlibs ?? false),
                                },
                              }
                            : sec,
                        );
                        s.setSession({ sections: next });
                      }}
                    >
                      Ad-libs
                    </button>
                    <button
                      class={`arr-toggle-btn${sel.vocal?.harmonies ? " on" : ""}`}
                      onClick={() => {
                        const next = s.sections.map((sec) =>
                          sec.id === sel.id
                            ? {
                                ...sec,
                                vocal: {
                                  ...(sec.vocal ?? {
                                    type: vocalTypes[0]!,
                                    delivery: deliveryStyles[0]!,
                                    energy: 3,
                                    adlibs: false,
                                    harmonies: false,
                                  }),
                                  harmonies: !(sec.vocal?.harmonies ?? false),
                                },
                              }
                            : sec,
                        );
                        s.setSession({ sections: next });
                      }}
                    >
                      Harmonies
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Add section */}
            <div class="arr-add-row">
              <span class="arr-add-label">
                INSERT AFTER {sel.name.toUpperCase()}
              </span>
              {sections
                .filter((name) => !s.sections.some((sec) => sec.name === name))
                .map((name) => (
                  <button
                    key={name}
                    class="arr-add-pill"
                    onClick={() => {
                      const newSec: Section = {
                        id: generateId(),
                        name,
                        bars: 8,
                        fn: "establish",
                        deltas: [],
                      };
                      const idx = s.sections.findIndex(
                        (sec) => sec.id === sel.id,
                      );
                      const next = [...s.sections];
                      next.splice(idx + 1, 0, newSec);
                      s.setSession({
                        sections: next,
                        selSectionId: newSec.id,
                        arrangeSource: "custom",
                        lyricsGenerated: false,
                        lyricLines: {},
                      });
                    }}
                  >
                    <Plus size={10} /> {name}
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function defaultSections(genreId: string): Section[] {
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
