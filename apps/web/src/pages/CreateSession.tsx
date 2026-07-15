import { useState, useEffect, useMemo, useRef } from "preact/hooks";
import { useRouter } from "../lib/router";
import { fetchGenres, createJob, type GenreInfo } from "../api";
import { useSession } from "../lib/session";
import { edmModule } from "@track-forge/genre-edm";
import { hipHopModule } from "@track-forge/genre-hiphop";
import { popModule } from "@track-forge/genre-pop";
import { ambientModule } from "@track-forge/genre-ambient";
import { dnbModule } from "@track-forge/genre-dnb";
import type { GenreModule, TagCategory } from "@track-forge/genre-core";

const GENRE_MODULES: Record<string, GenreModule> = {
  edm: edmModule as unknown as GenreModule,
  hiphop: hipHopModule as unknown as GenreModule,
  pop: popModule as unknown as GenreModule,
  ambient: ambientModule as unknown as GenreModule,
  dnb: dnbModule as unknown as GenreModule,
};

const GENRE_SUBGENRE_COUNTS: Record<string, string> = {
  edm: "80+",
  hiphop: "40+",
  pop: "20+",
  ambient: "15+",
  dnb: "10+",
};

const GENRE_SHORT: Record<string, string> = {
  edm: "EDM", hiphop: "HIP", pop: "POP", ambient: "AMB", dnb: "DNB",
};

const KEY_OPTIONS = [
  "C maj", "Db maj", "D maj", "Eb maj", "E maj", "F maj",
  "F# maj", "G maj", "Ab maj", "A maj", "Bb maj", "B maj",
  "C min", "C# min", "D min", "D# min", "E min", "F min",
  "F# min", "G min", "G# min", "A min", "A# min", "B min",
];

const GENRE_COLORS: Record<string, string> = {
  edm: "cyan",
  hiphop: "amber",
  pop: "violet",
  ambient: "accent",
  dnb: "red",
};

const SEC_COLORS: Record<string, string> = {
  // Structural bookends — neutral gray
  intro: "#3a4048", outro: "#3a4048", break: "#3a4048", fade: "#3a4048",
  // Tension / energy build-up — amber
  build: "var(--amber)", build_2: "var(--amber)", pre: "var(--amber)", rise: "var(--amber)",
  // Climax / peak energy — green
  drop: "var(--acc)", drop_2: "var(--acc)", hook: "var(--acc)", peak: "var(--acc)",
  chorus: "var(--acc)", bloom: "var(--acc)",
  // Narrative / flow — cyan
  verse: "var(--cyan)", groove: "var(--cyan)", loop: "var(--cyan)",
  swell: "var(--cyan)", resolve: "var(--cyan)",
  // Transition / modulation — violet
  bridge: "var(--violet)", emerge: "var(--violet)", drift: "var(--violet)",
  breakdown: "var(--violet)", sparse: "var(--violet)",
};

function formatSectionName(name: string): string {
  return name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const SECTION_PALETTE = ["Intro", "Build", "Drop", "Breakdown", "Bridge", "Outro"];

export function CreateSession() {
  const { navigate } = useRouter();
  const [genres, setGenres] = useState<GenreInfo[]>([]);
  const [genreId, setGenreId] = useState("edm");
  const [presetId, setPresetId] = useState("");
  const [inputs, setInputs] = useState<Record<string, unknown>>({});
  const [reference, setReference] = useState("");
  const [lyricsMode, setLyricsMode] = useState("");
  const [selectedSectionIdx, setSelectedSectionIdx] = useState(0);
  const [sections, setSections] = useState<{ section: string; bars: number }[]>([]);
  const [sectionsDirty, setSectionsDirty] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tags, setTags] = useState<{ label: string; category: string; weight: number; muted: boolean }[]>([]);
  const [addingCat, setAddingCat] = useState<string | null>(null);
  const [selectedTagIdx, setSelectedTagIdx] = useState<number | null>(null);
  const [openSection, setOpenSection] = useState<string | null>("foundation");

  useEffect(() => {
    fetchGenres().then(setGenres).catch(() => {});
  }, []);

  const mod = GENRE_MODULES[genreId];

  useEffect(() => {
    const m = GENRE_MODULES[genreId];
    if (m) {
      setInputs({ ...(m.defaults as Record<string, unknown>) });
      const firstPreset = m.presets[0];
      setPresetId(firstPreset?.id ?? "");
      setSectionsDirty(false);
    }
  }, [genreId]);

  const selectedPreset = mod?.presets.find((p) => p.id === presetId);

  useEffect(() => {
    if (selectedPreset) {
      setInputs((prev) => ({ ...prev, ...selectedPreset.values }));
    }
  }, [presetId]);

  useEffect(() => {
    const l = inputs.lyricsMode;
    setLyricsMode(typeof l === "string" ? l : "");
  }, [inputs.lyricsMode]);

  const arrangement = useMemo(() => {
    if (!mod) return [];
    try {
      const bp = mod.compileBlueprint(inputs as Record<string, unknown>) as Record<string, unknown>;
      if (bp.arrangement) return bp.arrangement as { section: string; bars: number }[];
      if (bp.songStructure) return (bp.songStructure as string[]).map((s) => ({ section: s, bars: 8 }));
    } catch {
      // blueprint may fail validation for partial inputs
    }
    return [];
  }, [genreId, presetId, inputs]);

  useEffect(() => {
    if (!sectionsDirty) setSections(arrangement);
  }, [arrangement, sectionsDirty]);

  const currentKey = (() => {
    const k = inputs.key as string;
    const s = inputs.scale as string;
    if (!k || k === "auto") return "";
    return `${k} ${s}`;
  })();

  const activeTags = tags.filter((t) => !t.muted).sort((a, b) => b.weight - a.weight);
  const tagLabels = activeTags.map((t) => t.label).join(", ");

  const stylePreviewText = (() => {
    if (!tagLabels) return "";
    const bpm = (inputs.bpm as number) ?? "";
    const k = inputs.key as string;
    const s = inputs.scale as string;
    const keyDisplay = !k || k === "auto" ? "" : `${k}${s === "minor" ? "m" : ""}`;
    const keyPart = keyDisplay ? ` · ${keyDisplay}` : "";
    return `${tagLabels} · ${bpm} BPM${keyPart} · high fidelity, professional mix`;
  })();

  const filteredGenres = genres.filter((g) => GENRE_MODULES[g.id]);

  const totalBars = sections.reduce((s, sec) => s + sec.bars, 0);
  const estSeconds = totalBars * 4 * 60 / ((inputs.bpm as number) || 120);
  const activeCount = tags.filter((t) => !t.muted).length;
  const styleChars = stylePreviewText.length;
  const sectionsLine = sections.length > 0 ? `${formatSectionName(sections[0]!.section)} +${sections.length - 1} more sections · ${totalBars} bars${sectionsDirty ? " · Custom arrangement" : ""}` : "";

  const lyricsOptions = useMemo(() => {
    switch (genreId) {
      case "edm":
      case "ambient":
      case "dnb":
        return [
          { value: "full_lyrics", label: "Full Lyrics" },
          { value: "guided_instrumental", label: "Hook Only" },
          { value: "strict_instrumental", label: "Instrumental" },
        ];
      default:
        return [
          { value: "instrumental", label: "Instrumental" },
          { value: "full_lyrics", label: "Full Lyrics" },
        ];
    }
  }, [genreId]);

  const handleGenreClick = (id: string) => {
    setGenreId(id);
    setSelectedSectionIdx(0);
  };

  const handlePresetClick = (id: string) => {
    setPresetId(id);
  };

  const handleTempoChange = (e: Event) => {
    const val = parseInt((e.target as HTMLInputElement).value, 10);
    setInputs((prev) => ({ ...prev, bpm: val }));
  };

  const handleKeyChange = (e: Event) => {
    const val = (e.target as HTMLSelectElement).value;
    const parts = val.split(" ");
    if (parts.length === 2) {
      const scale = parts[1] === "maj" ? "major" : parts[1] === "min" ? "minor" : parts[1]!;
      setInputs((prev) => ({ ...prev, key: parts[0]!, scale }));
    }
  };

  const handleLyricsModeChange = (mode: string) => {
    setInputs((prev) => ({ ...prev, lyricsMode: mode }));
  };

  const decrementBars = () => {
    setSectionsDirty(true);
    setSections((prev) => {
      const next = [...prev];
      if (selectedSectionIdx < 0 || selectedSectionIdx >= next.length) return prev;
      const sec = { ...next[selectedSectionIdx]! };
      if (sec.bars > 4) {
        sec.bars -= 1;
        next[selectedSectionIdx] = sec;
      }
      return next;
    });
  };

  const incrementBars = () => {
    setSectionsDirty(true);
    setSections((prev) => {
      const next = [...prev];
      if (selectedSectionIdx < 0 || selectedSectionIdx >= next.length) return prev;
      const sec = { ...next[selectedSectionIdx]! };
      if (sec.bars < 64) {
        sec.bars += 1;
        next[selectedSectionIdx] = sec;
      }
      return next;
    });
  };

  const duplicateSection = () => {
    const i = selectedSectionIdx;
    if (i < 0 || i >= sections.length) return;
    setSectionsDirty(true);
    setSections((prev) => {
      const arr = [...prev];
      arr.splice(i + 1, 0, { ...arr[i]! });
      return arr;
    });
    setSelectedSectionIdx(i + 1);
  };

  const removeSection = () => {
    const i = selectedSectionIdx;
    if (i < 0 || i >= sections.length) return;
    setSectionsDirty(true);
    setSections((prev) => prev.filter((_, j) => j !== i));
    setSelectedSectionIdx(Math.max(0, i - 1));
  };

  const addSection = (type: string) => {
    setSectionsDirty(true);
    setSections((prev) => [...prev, { section: type, bars: 16 }]);
    setSelectedSectionIdx(sections.length);
  };

  const dragIdx = useRef<number | null>(null);

  const reorderSection = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0) return;
    setSectionsDirty(true);
    setSections((prev) => {
      const arr = [...prev];
      const [m] = arr.splice(from, 1);
      if (!m) return prev;
      arr.splice(to, 0, m);
      return arr;
    });
    setSelectedSectionIdx(to);
  };

  const moveSection = (dir: number) => {
    const to = selectedSectionIdx + dir;
    if (to < 0 || to >= sections.length) return;
    reorderSection(selectedSectionIdx, to);
  };

  const startResize = (i: number, e: PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startBars = sections[i]?.bars ?? 8;
    const totalBars = sections.reduce((s, sec) => s + sec.bars, 0);
    const track = (e.target as HTMLElement).closest(".arrangement-bar") as HTMLElement;
    if (!track) return;
    const pxPerBar = track.offsetWidth / Math.max(1, totalBars);

    const move = (ev: PointerEvent) => {
      const dBars = Math.round((ev.clientX - startX) / Math.max(4, pxPerBar) / 4) * 4;
      setSectionsDirty(true);
      setSections((prev) =>
        prev.map((sec, j) => (j === i ? { ...sec, bars: Math.max(4, Math.min(128, startBars + dBars)) } : sec)),
      );
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const handleSubmit = async () => {
    if (!mod) return;
    setSubmitting(true);
    setError(null);
    try {
      const job = await createJob({
        genreId,
        presetId: presetId || mod.presets[0]?.id || "",
        inputs: { ...inputs, styleTags: tags, arrangement: sections },
        reference: reference || undefined,
        name: "Untitled Session",
      });
      navigate(`/forge/${job.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const { setSession, resetSession } = useSession();
  useEffect(() => {
    const k = inputs.key as string, sc = inputs.scale as string;
    setSession({
      jobId: null,
      genreId,
      presetId: presetId || "",
      bpm: (inputs.bpm as number) ?? null,
      key: !k || k === "auto" ? "" : `${k}${sc === "minor" ? "m" : ""}`,
      status: "idle",
      onForge: handleSubmit,
      forgeLabel: submitting ? "CREATING…" : "FORGE",
      forgeDisabled: submitting,
    });
    return () => resetSession();
  }, [genreId, presetId, inputs.bpm, inputs.key, inputs.scale, submitting]);

  const addTag = (label: string, category: string) => {
    setTags((prev) => {
      const existing = prev.findIndex((t) => t.label === label && t.category === category);
      if (existing >= 0) {
        setSelectedTagIdx(null);
        return prev.filter((_, i) => i !== existing);
      }
      const next = [...prev, { label, category, weight: 2, muted: false }];
      setSelectedTagIdx(next.length - 1);
      return next;
    });
  };

  return (
    <div class="create-layout">
      <div class="create-left">
        <div class="create-header">
          <div class="panel-title">New Session</div>
        </div>

        {/* Compiled style prompt — always visible on top */}
        <div class="panel-card">
          <div class="panel-title-bar">
            <div class="panel-title">Compiled style prompt · live</div>
            <span class="preview-dot" />
          </div>
          <p class="console-desc">Weight each descriptor's influence, mute to A/B, and watch the prompt compile live.</p>
          <div class="fingerprint-spectrum">
            {(() => {
              const cats = GENRE_MODULES[genreId]?.tagCategories ?? [];
              const totals = cats.map((c) => ({
                color: c.color,
                weight: tags.filter((t) => t.category === c.id && !t.muted).reduce((s, t) => s + t.weight, 0),
              }));
              const max = Math.max(1, ...totals.map((t) => t.weight));
              return totals.map((t, i) => (
                <div key={i} class={`fingerprint-bar ${t.color}`} style={{ flex: Math.max(0.2, t.weight || 0.2), height: `${8 + (t.weight / max) * 16}px`, opacity: t.weight ? 1 : 0.25 }} />
              ));
            })()}
          </div>
          <div class="fingerprint-label">
            <span>SIGNATURE</span>
            <span>{tags.reduce((s, t) => s + (t.muted ? 0 : t.weight), 0)} units · {activeCount} active</span>
          </div>
          <div class="style-preview" style="margin:0;border:none;background:var(--panel)">
            {stylePreviewText || "Select tags to build your style"}
            {sectionsLine && <div class="sections-line">{sectionsLine}</div>}
          </div>
        </div>

        {/* Style Console — always visible */}
        <div class="panel-card accordion-section">
          <div class="panel-title-bar">
            <div class="panel-title" style="margin:0">Style Console</div>
            <span class="console-stats">{activeCount} active · {styleChars} chars</span>
          </div>

          <div class="category-lanes">
            {(GENRE_MODULES[genreId]?.tagCategories ?? []).map((cat) => {
              const selectedCount = tags.filter((t) => t.category === cat.id).length;
              return (
                <div key={cat.id} class="category-lane">
                  <div class="lane-header-row">
                    <div class="lane-dot" style={{ background: `var(--${cat.color})` }} />
                    <span class="lane-label">{cat.name.toUpperCase()}</span>
                    <div class="lane-divider" />
                    <span class="lane-count">{selectedCount}</span>
                    <button class="lane-add" onClick={() => setAddingCat(addingCat === cat.id ? null : cat.id)}>+</button>
                  </div>
                  <div class="lane-chips">
                    {(() => {
                      const added = tags.filter((t) => t.category === cat.id).map((t) => t.label);
                      const labels = [...new Set([...added, ...cat.suggestions])].slice(0, 8);
                      return labels.map((s) => {
                        const idx = tags.findIndex((t) => t.label === s && t.category === cat.id);
                        const tag = idx >= 0 ? tags[idx] : undefined;
                        const isSelected = idx >= 0 && idx === selectedTagIdx;
                        const weight = tag?.weight ?? 2;
                        return (
                          <button
                            key={s}
                            class={`lane-chip${tag ? " active" : ""}${isSelected ? " selected" : ""}${tag?.muted ? " muted" : ""}`}
                            onClick={() => (tag ? setSelectedTagIdx(idx) : addTag(s, cat.id))}
                          >
                            <span class="chip-bars">
                              {[1, 2, 3].map((lv) => (
                                <span key={lv} class="chip-bar" style={{ height: `${3 + lv * 2.5}px`, background: lv <= weight ? `var(--${cat.color})` : "var(--line2)" }} />
                              ))}
                            </span>
                            <span class="chip-label">{s}</span>
                          </button>
                        );
                      });
                    })()}
                    {tags.filter((t) => t.category === cat.id).length === 0 && <span class="lane-empty">— empty —</span>}
                  </div>
                  {addingCat === cat.id && (
                    <div class="add-panel">
                      <div class="add-suggestions">
                      {cat.suggestions.filter((s) => !tags.some((t) => t.label === s && t.category === cat.id)).slice(0, 6).map((s) => (
                        <button key={s} class="add-suggestion" onClick={() => { addTag(s, cat.id); }}>+ {s}</button>
                      ))}
                      </div>
                      <div class="add-input-row">
                        <input class="custom-tag-input" placeholder="custom descriptor…" onKeyDown={(e) => { if (e.key === "Enter") { const v = (e.target as HTMLInputElement).value.trim(); if (v) { addTag(v, cat.id); } (e.target as HTMLInputElement).value = ""; } }} />
                        <button class="add-btn" onClick={() => { const inp = document.querySelector(".custom-tag-input") as HTMLInputElement; if (inp) { const v = inp.value.trim(); if (v) { addTag(v, cat.id); } inp.value = ""; } }}>Add</button>
                        <button class="done-btn" onClick={() => setAddingCat(null)}>Done</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {selectedTagIdx != null && tags[selectedTagIdx] && (() => {
            const i = selectedTagIdx;
            const tag = tags[i]!;
            const catColor = GENRE_MODULES[genreId]?.tagCategories?.find((c) => c.id === tag.category)?.color ?? "accent";
            const setTag = (patch: Partial<typeof tag>) =>
              setTags((prev) => prev.map((t, j) => (j === i ? { ...t, ...patch } : t)));
            return (
              <div class="tag-channel-strip">
                <div class="tag-strip-row">
                  <span class="tag-strip-dot" style={{ background: `var(--${catColor})` }} />
                  <input class="tag-strip-name-input" value={tag.label} onInput={(e) => setTag({ label: (e.target as HTMLInputElement).value })} />
                  <button class="tag-remove" onClick={() => { setTags((prev) => prev.filter((_, j) => j !== i)); setSelectedTagIdx(null); }}>
                    <i class="ph-x" />
                  </button>
                </div>
                <div class="tag-strip-controls">
                  <span class="tag-strip-label">Weight</span>
                  <div class="tag-weight-selector">
                    {(["Sub", "Bal", "Dom"] as const).map((w) => {
                      const wv = w === "Sub" ? 1 : w === "Bal" ? 2 : 3;
                      return (
                        <button key={w} class={`weight-option${wv === tag.weight ? " active" : ""}`} onClick={() => setTag({ weight: wv })}>{w}</button>
                      );
                    })}
                  </div>
                  <button class={`tag-mute${tag.muted ? " muted" : ""}`} onClick={() => setTag({ muted: !tag.muted })}>
                    <i class="ph-speaker-simple-slash" />
                    {tag.muted ? "MUTED" : "MUTE"}
                  </button>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Foundation accordion */}
        <div class="panel-card accordion-section">
          <button class="accordion-header" onClick={() => setOpenSection(openSection === "foundation" ? null : "foundation")}>
            <div class="panel-title" style="margin:0">01 · Foundation</div>
            <span class="accordion-chevron">{openSection === "foundation" ? "▾" : "▸"}</span>
          </button>
          {openSection === "foundation" && <div class="accordion-body">
            <div class="genre-grid">
              {filteredGenres.map((g) => {
                const dotColor = GENRE_COLORS[g.id] ?? "accent";
                return (
                  <button
                    key={g.id}
                    class={`genre-card${genreId === g.id ? " active" : ""}`}
                    onClick={() => handleGenreClick(g.id)}
                  >
                    <div class="genre-square" style={{ background: `var(--${dotColor})` }}>{GENRE_SHORT[g.id] ?? g.id.toUpperCase()}</div>
                    <div class="genre-name">{g.name}</div>
                    <div class="genre-count">{GENRE_SUBGENRE_COUNTS[g.id] ?? ""} subgenres</div>
                  </button>
                );
              })}
            </div>
            {mod && mod.presets.length > 0 && (
              <div class="preset-row">
                {mod.presets.map((p) => (
                  <button
                    key={p.id}
                    class={`preset-pill${presetId === p.id ? " active" : ""}`}
                    onClick={() => handlePresetClick(p.id)}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}
            <div class="create-control-row" style="margin-top: 16px">
              <div class="control-group">
                <span class="control-label">Tempo</span>
                <div style="display:flex;align-items:center;gap:8px">
                  <input
                    class="tempo-slider"
                    type="range"
                    min="60"
                    max="200"
                    value={(inputs.bpm as number) ?? 120}
                    onInput={handleTempoChange}
                  />
                  <span class="tempo-value">{(inputs.bpm as number) ?? 120}</span>
                </div>
              </div>
              <div class="control-group">
                <span class="control-label">Key</span>
                <select class="key-select" value={currentKey} onChange={handleKeyChange}>
                  <option value="" disabled>Select key</option>
                  {KEY_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>}
        </div>

        {/* Arrangement accordion */}
        <div class="panel-card accordion-section">
          <button class="accordion-header" onClick={() => setOpenSection(openSection === "arrangement" ? null : "arrangement")}>
            <div class="panel-title" style="margin:0">02 · Arrangement</div>
            <span class="accordion-chevron">{openSection === "arrangement" ? "▾" : "▸"}</span>
          </button>
          {openSection === "arrangement" && <div class="accordion-body">
            <div class="arrangement-header">
              <div>
                <p class="arrangement-help">drag to reorder · drag edge to resize · click to edit</p>
              </div>
              <div class="arrangement-total">{totalBars} bars · {`${Math.floor(estSeconds / 60)}:${Math.round(estSeconds % 60).toString().padStart(2, "0")}`}</div>
            </div>
            <div class="arrangement-bar">
              {sections.map((sec, i) => {
                const base = SEC_COLORS[sec.section.toLowerCase()] ?? "#3a4048";
                const strong = base !== "#3a4048";
                return (
                  <div
                    key={i}
                    class={`arrangement-section${i === selectedSectionIdx ? " selected" : ""}`}
                    style={{ flex: sec.bars, background: strong ? base : "var(--raised)", color: strong ? "#08090B" : "var(--dim)" }}
                    onClick={() => setSelectedSectionIdx(i)}
                    draggable={true}
                    onDragStart={(e: DragEvent) => { dragIdx.current = i; e.dataTransfer!.effectAllowed = "move"; }}
                    onDragOver={(e: DragEvent) => e.preventDefault()}
                    onDrop={(e: DragEvent) => { e.preventDefault(); if (dragIdx.current != null) reorderSection(dragIdx.current, i); dragIdx.current = null; }}
                    onDragEnd={() => { dragIdx.current = null; }}
                  >
                    <div class="sec-label">{i === selectedSectionIdx && <span class="sec-dot" style={{ background: base }} />}{formatSectionName(sec.section)}</div>
                    <div class="sec-bars">{sec.bars} bars</div>
                    <span class="arrangement-grip" style={{ background: strong ? "linear-gradient(90deg,transparent,rgba(0,0,0,0.25))" : "linear-gradient(90deg,transparent,rgba(255,255,255,0.12))" }} onPointerDown={(e) => startResize(i, e)} />
                  </div>
                );
              })}
            </div>
            {sections.length > 0 && (
              <>
                <div class="arrangement-editor" style="margin-top: 12px">
                  <div class="bar-control">
                    <button class="bar-btn" onClick={decrementBars}>−</button>
                    <span class="bar-count">{sections[selectedSectionIdx]?.bars ?? 0}</span>
                    <button class="bar-btn" onClick={incrementBars}>+</button>
                  </div>
                  <span style="font-size:12px;color:var(--text-dim)">bars</span>
                  <button class="bar-btn" onClick={() => moveSection(-1)} title="Move left">‹</button>
                  <button class="bar-btn" onClick={() => moveSection(1)} title="Move right">›</button>
                  <button class="section-action-btn" onClick={duplicateSection}>Duplicate</button>
                  <button class="section-action-btn" onClick={removeSection}>Remove</button>
                </div>
                <div class="preset-row" style="margin-top: 12px">
                  {SECTION_PALETTE.map((type) => (
                    <button key={type} class="preset-pill" onClick={() => addSection(type)}>+ {type}</button>
                  ))}
                </div>
              </>
            )}
          </div>}
        </div>

        {/* Reference accordion */}
        <div class="panel-card accordion-section">
          <button class="accordion-header" onClick={() => setOpenSection(openSection === "reference" ? null : "reference")}>
            <div class="panel-title" style="margin:0">03 · Reference material</div>
            <span class="accordion-chevron">{openSection === "reference" ? "▾" : "▸"}</span>
          </button>
          {openSection === "reference" && <div class="accordion-body">
            <textarea
              class="reference-textarea"
              placeholder="Paste a reference track URL or description..."
              value={reference}
              onInput={(e) => setReference((e.target as HTMLTextAreaElement).value)}
            />
            <div class="lyrics-mode-row">
              {lyricsOptions.map((opt) => (
                <button
                  key={opt.value}
                  class={`lyrics-mode-btn${lyricsMode === opt.value ? " active" : ""}`}
                  onClick={() => handleLyricsModeChange(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>}
        </div>

        {error && <p class="error" style="color:var(--red);font-size:13px">{error}</p>}

        <button class="btn btn-primary" style="width:100%" disabled={submitting} onClick={handleSubmit}>
          {submitting ? "Creating…" : "Launch Session"}
        </button>
      </div>
    </div>
  );
}
