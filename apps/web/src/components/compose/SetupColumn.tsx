import { useState, useEffect, useCallback, useRef } from "preact/hooks";
import {
  CaretDown,
  CaretRight,
  CaretLeft,
  MagnifyingGlass,
  CheckCircle,
  SlidersHorizontal,
} from "@phosphor-icons/react";
import { useSession } from "../../lib/session";
import type { SessionState } from "../../lib/session";
import type {
  SetupCardId,
  SetupCardsOpen,
  Descriptor,
  DescriptorCategory,
  DescriptorWeight,
} from "./types";
import { buildSections, randomTitle } from "./arrangement";
import {
  fetchGenres,
  fetchPresets,
  fetchDescriptorDefaults,
  type GenreInfo,
  type GenrePreset,
  type GenreDescriptorDefaults,
} from "../../api";

const NOTE_NAMES = [
  "C",
  "Db",
  "D",
  "Eb",
  "E",
  "F",
  "F#",
  "G",
  "Ab",
  "A",
  "Bb",
  "B",
];

// Selecting a preset is meaningless if it doesn't actually change the sound —
// pull the preset's own bpm/key/scale/lyricsMode into the session so the
// preset is a real sonic starting point, not just a label.
function presetSessionPatch(preset: GenrePreset): Partial<SessionState> {
  const v = preset.values as {
    bpm?: number;
    key?: string;
    scale?: "major" | "minor";
    lyricsMode?: "full_lyrics" | "strict_instrumental";
    energy?: number;
    complexity?: number;
  };
  const patch: Partial<SessionState> = {
    presetIds: [preset.id],
    presetId: preset.id,
    presetLabels: [preset.name],
  };
  if (typeof v.bpm === "number") patch.bpm = v.bpm;
  if (typeof v.key === "string") patch.key = v.key;
  if (v.scale === "major" || v.scale === "minor") patch.scale = v.scale;
  if (
    v.lyricsMode === "full_lyrics" ||
    v.lyricsMode === "strict_instrumental"
  ) {
    patch.lyricsMode = v.lyricsMode;
  }
  if (typeof v.energy === "number") patch.energy = v.energy;
  if (typeof v.complexity === "number") patch.complexity = v.complexity;
  return patch;
}

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
  { id: "sound", label: "SOUND" },
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
  const [presetSearch, setPresetSearch] = useState("");

  useEffect(() => {
    fetchGenres()
      .then(setGenres)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (s.genreId) {
      // Fetch together and commit together — setting these from two
      // independent promises risks the seed effect below firing with one
      // genre's presets paired against another genre's still-stale
      // songStructure/descriptor data.
      Promise.all([fetchPresets(s.genreId), fetchDescriptorDefaults(s.genreId)])
        .then(([p, d]) => {
          setPresets(p);
          setDescDefaults(d);
        })
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
      const presetPatch = presetSessionPatch(presets[0]!);
      const sections = buildSections(
        descDefaults.songStructure,
        presetPatch.energy ?? s.energy,
        presetPatch.complexity ?? s.complexity,
      );
      s.setSession({
        ...presetPatch,
        tags: defaultDescriptors(s.genreId, descDefaults.defaults),
        sections,
        selSectionId: sections[0]?.id ?? null,
        lyricThemes: themes.length > 0 ? [themes[0]!] : [],
        title: s.title || randomTitle(),
      });
    }
  }, [presets, descDefaults]);

  if (leftCollapsed) {
    return (
      <div
        class="col-rail collapsed"
        onClick={() => togglePanel("left")}
        title="Expand setup"
        aria-label="Expand setup"
      >
        <CaretRight size={16} />
        <SlidersHorizontal size={18} />
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
        {renderCard("sound", s, cards, toggleCard, {
          genres,
          presets,
          descDefaults,
          presetSearch,
          setPresetSearch,
        })}

        <div class="setup-card static">
          <div class="setup-card-header static">
            <span class="setup-card-label">LYRICS</span>
          </div>
          <div class="setup-card-body">
            <LyricsCardContent descDefaults={descDefaults} s={s} />
          </div>
        </div>

        <div class="setup-card static">
          <div class="setup-card-header static">
            <span class="setup-card-label">TEMPO & KEY</span>
          </div>
          <div class="setup-card-body">
            <TempoCardContent s={s} />
          </div>
        </div>

        {renderCard("descriptors", s, cards, toggleCard, {
          genres,
          presets,
          descDefaults,
          presetSearch,
          setPresetSearch,
        })}
        {renderCard("reference", s, cards, toggleCard, {
          genres,
          presets,
          descDefaults,
          presetSearch,
          setPresetSearch,
        })}
      </div>
    </div>
  );
}

function renderCard(
  id: SetupCardId,
  s: ReturnType<typeof useSession>,
  cards: SetupCardsOpen,
  toggleCard: (id: SetupCardId) => void,
  ctx: CardCtx,
): preact.VNode {
  const label = CARDS.find((c) => c.id === id)!.label;
  return (
    <div class="setup-card" key={id}>
      <button class="setup-card-header" onClick={() => toggleCard(id)}>
        <span class="setup-card-label">{label}</span>
        <span class="setup-card-summary">{cardSummary(id, s)}</span>
        {cards[id] ? (
          <CaretDown size={14} class="setup-card-chevron" />
        ) : (
          <CaretRight size={14} class="setup-card-chevron" />
        )}
      </button>
      {cards[id] && (
        <div class="setup-card-body">{renderCardBody(id, s, ctx)}</div>
      )}
    </div>
  );
}

function cardSummary(
  id: SetupCardId,
  s: ReturnType<typeof useSession>,
): string {
  switch (id) {
    case "sound": {
      const genre = s.genreId ? s.genreId.toUpperCase() : "—";
      const preset = s.presetLabels.length
        ? s.presetLabels.join(", ")
        : s.presetIds.length
          ? s.presetIds.map((p) => p.replace(/_/g, " ")).join(", ")
          : "";
      return preset ? `${genre} · ${preset}` : genre;
    }
    case "descriptors": {
      const active = s.tags.filter((t) => !t.muted).length;
      return active > 0 ? `${active} active` : "None";
    }
    case "reference":
      return s.reference ? "Added" : "None";
  }
}

interface CardCtx {
  genres: GenreInfo[];
  presets: GenrePreset[];
  descDefaults: GenreDescriptorDefaults | null;
  presetSearch: string;
  setPresetSearch: (v: string) => void;
}

function renderCardBody(
  id: SetupCardId,
  s: ReturnType<typeof useSession>,
  ctx: CardCtx,
): preact.VNode {
  switch (id) {
    case "sound":
      return <SoundCardContent {...ctx} s={s} />;
    case "descriptors":
      return <DescriptorsCardContent {...ctx} s={s} />;
    case "reference":
      return <ReferenceCardContent s={s} />;
  }
}

/* ─── SOUND (genre + preset) ─── */

function SoundCardContent({
  genres,
  presets,
  presetSearch,
  setPresetSearch,
  descDefaults,
  s,
}: CardCtx & { s: ReturnType<typeof useSession> }) {
  const filteredPresets = presets.filter(
    (p) =>
      !presetSearch ||
      p.name.toLowerCase().includes(presetSearch.toLowerCase()),
  );

  return (
    <>
      <div class="setup-genre-chip-row">
        {genres.map((g) => {
          const active = s.genreId === g.id;
          return (
            <button
              key={g.id}
              class={`setup-genre-chip${active ? " active" : ""}`}
              onClick={() => {
                if (g.id === s.genreId) return;
                const themes = descDefaults?.lyricThemes ?? [];
                const firstTheme = themes[0] ?? "";
                // Sections/tags reset to empty here and get rebuilt by the
                // seed effect once this genre's own descriptor-defaults
                // (song_structure, presets) have loaded — using the
                // previous genre's still-cached data would build the wrong
                // arrangement for a moment.
                s.setSession({
                  genreId: g.id,
                  presetId: "",
                  presetIds: [],
                  presetLabels: [],
                  tags: [],
                  sections: [],
                  selSectionId: null,
                  lyricThemes: firstTheme ? [firstTheme] : [],
                  lyricsGenerated: false,
                  lyricLines: {},
                });
              }}
            >
              <span
                class="setup-dot"
                style={{ background: `var(--hue-${g.color ?? "slate"})` }}
              />
              {g.name}
              {active && <CheckCircle size={14} weight="fill" />}
            </button>
          );
        })}
      </div>

      <div class="setup-eyebrow">PRESET</div>
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
        {filteredPresets.map((p) => {
          const active = s.presetIds.includes(p.id);
          return (
            <button
              key={p.id}
              class={`setup-select-item${active ? " active" : ""}`}
              onClick={() => {
                if (active) return;
                const patch = presetSessionPatch(p);
                // Regenerate the arrangement to match the new preset's
                // energy/complexity — unless the user has already
                // customized it, in which case switching presets shouldn't
                // silently discard their edits.
                if (s.arrangeSource !== "custom" && descDefaults) {
                  const sections = buildSections(
                    descDefaults.songStructure,
                    patch.energy ?? s.energy,
                    patch.complexity ?? s.complexity,
                  );
                  patch.sections = sections;
                  patch.selSectionId = sections[0]?.id ?? null;
                  patch.lyricsGenerated = false;
                  patch.lyricLines = {};
                }
                s.setSession(patch);
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
          <div class="setup-eyebrow">WHAT'S THE SONG ABOUT?</div>
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

          <div class="setup-eyebrow">ANGLE</div>
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

          <div class="setup-eyebrow">THEMES</div>
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
  const scale = s.scale ?? "major";

  const setBpm = (v: number) => {
    if (!Number.isNaN(v)) s.setSession({ bpm: Math.min(200, Math.max(60, v)) });
  };

  return (
    <>
      <div class="setup-eyebrow">TEMPO</div>
      <div class="setup-tempo-row">
        <input
          type="number"
          class="setup-tempo-input tf-mono"
          min={60}
          max={200}
          value={bpm}
          onInput={(e) => setBpm(Number((e.target as HTMLInputElement).value))}
        />
        <span class="setup-tempo-unit tf-mono">BPM</span>
        <input
          type="range"
          class="setup-slider"
          min={60}
          max={200}
          value={bpm}
          onInput={(e) => setBpm(Number((e.target as HTMLInputElement).value))}
        />
      </div>

      <div class="setup-eyebrow">KEY</div>
      <div class="setup-key-grid">
        {NOTE_NAMES.map((note) => (
          <button
            key={note}
            type="button"
            class={`setup-key-btn${s.key === note ? " on" : ""}`}
            onClick={() => s.setSession({ key: note })}
          >
            {note}
          </button>
        ))}
      </div>
      <div class="setup-scale-toggle">
        <button
          type="button"
          class={`setup-scale-btn${scale === "major" ? " on" : ""}`}
          onClick={() => s.setSession({ scale: "major" })}
        >
          Major
        </button>
        <button
          type="button"
          class={`setup-scale-btn${scale === "minor" ? " on" : ""}`}
          onClick={() => s.setSession({ scale: "minor" })}
        >
          Minor
        </button>
      </div>
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
                  style="font-size:10.5px;letter-spacing:.08em;color:var(--label);font-weight:600"
                >
                  {cat.label}
                </span>
                <span class="setup-desc-lane-divider" />
                <span class="tf-mono" style="font-size:10px;color:var(--dim)">
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
      <div class="setup-eyebrow">AVOID (comma-separated)</div>
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
