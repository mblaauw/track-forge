import { useState, useEffect, useCallback, useRef } from "preact/hooks";
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
import { defaultSections } from "./arrangement";
import { randomTitle } from "./arrangement";
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

function defaultDescriptors(
  genreId: string,
  apiDefaults?: { label: string; cat: string; weight: number }[] | null,
): Descriptor[] {
  const seed =
    apiDefaults && apiDefaults.length > 0
      ? apiDefaults
      : [
          {
            label: "supersaw",
            cat: "sound" as DescriptorCategory,
            weight: 2 as DescriptorWeight,
          },
        ];
  return seed.map((d) => ({
    id: d.label,
    label: d.label,
    cat: d.cat as DescriptorCategory,
    weight: d.weight as DescriptorWeight,
    muted: false,
  }));
}

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

  // Seed initial state once when genre/presets/descriptors are ready
  const seededRef = useRef(false);
  const prevGenreRef = useRef(s.genreId);
  useEffect(() => {
    if (prevGenreRef.current !== s.genreId) {
      prevGenreRef.current = s.genreId;
      seededRef.current = false;
    }
  }, [s.genreId]);

  useEffect(() => {
    if (
      !seededRef.current &&
      presets.length > 0 &&
      descDefaults &&
      s.tags.length === 0
    ) {
      seededRef.current = true;
      const themes = descDefaults.lyricThemes;
      const sections = defaultSections(s.genreId);
      s.setSession({
        presetIds: [presets[0]!.id],
        presetId: presets[0]!.id,
        presetLabels: [presets[0]!.name],
        tags: defaultDescriptors(s.genreId, descDefaults.defaults),
        sections,
        selSectionId: sections[0]?.id ?? null,
        lyricThemes: themes.length > 0 ? [themes[0]!] : [],
        title: s.title || randomTitle(),
      });
    }
  }, [presets, descDefaults]);

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
      return s.presetLabels.length
        ? s.presetLabels.join(", ")
        : s.presetIds.length
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
      return <LyricsCardContent descDefaults={ctx.descDefaults} s={s} />;
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
                const themes = descDefaults?.lyricThemes ?? [];
                const firstTheme = themes[0] ?? "";
                const genreSections = defaultSections(g.id);
                s.setSession({
                  genreId: g.id,
                  presetId: "",
                  presetIds: [],
                  presetLabels: [],
                  tags: [],
                  sections: genreSections,
                  selSectionId: genreSections[0]?.id ?? null,
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
                const labels = next.map((id) => {
                  const match = presets.find((pr) => pr.id === id);
                  return match?.name ?? id.replace(/_/g, " ");
                });
                s.setSession({
                  presetIds: next,
                  presetId: p.id,
                  presetLabels: labels,
                });
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

function LyricsCardContent({
  descDefaults,
  s,
}: {
  descDefaults: GenreDescriptorDefaults | null;
  s: ReturnType<typeof useSession>;
}) {
  const lyricsOn = s.lyricsMode === "full_lyrics";
  const themes = descDefaults?.lyricThemes ?? [];

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
            {(descDefaults?.lyricAngles ?? []).map((a) => {
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
  presets,
  s,
}: {
  descDefaults: GenreDescriptorDefaults | null;
  presets: GenrePreset[];
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
      : [];
  const activeTags = s.tags.filter((t) => !t.muted);
  const seedData = descDefaults?.defaults ?? [];
  const seedCount = seedData.length;

  return (
    <>
      <div class="setup-desc-badge-row">
        <span class="setup-desc-badge">
          {(s.presetIds.length > 0
            ? s.presetIds
                .map((id) => {
                  const p = presets.find((pr) => pr.id === id);
                  return p?.name ?? id.replace(/_/g, " ");
                })
                .join(", ")
            : s.genreId.toUpperCase()) + " · preset seed"}
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
    <>
      <textarea
        class="setup-textarea"
        style="min-height:72px"
        placeholder="Paste a reference track URL or describe the vibe…"
        value={s.reference}
        onInput={(e) =>
          s.setSession({ reference: (e.target as HTMLTextAreaElement).value })
        }
      />
      <div
        class="tf-mono"
        style="font-size:9.5px;letter-spacing:.1em;color:var(--faint);font-weight:600;margin:10px 0 7px"
      >
        AVOID (comma-separated)
      </div>
      <textarea
        class="setup-textarea"
        style="min-height:48px"
        placeholder="e.g. autotune, distortion, orchestral swells…"
        value={s.excludedStyles}
        onInput={(e) =>
          s.setSession({
            excludedStyles: (e.target as HTMLTextAreaElement).value,
          })
        }
      />
    </>
  );
}
