import { useState, useEffect, useMemo } from "preact/hooks";
import { useRouter } from "../lib/router";
import { fetchGenres, createJob, type GenreInfo } from "../api";
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
    return `${tagLabels} · ${bpm} BPM · ${keyDisplay} · high fidelity, professional mix`;
  })();

  const filteredGenres = genres.filter((g) => GENRE_MODULES[g.id]);

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
      setInputs((prev) => ({ ...prev, key: parts[0]!, scale: parts[1] }));
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

  const handleSubmit = async () => {
    if (!mod) return;
    setSubmitting(true);
    setError(null);
    try {
      const job = await createJob({
        genreId,
        presetId: presetId || mod.presets[0]?.id || "",
        inputs,
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

  const addTag = (label: string, category: string) => {
    setTags((prev) => {
      const existing = prev.findIndex((t) => t.label === label && t.category === category);
      if (existing >= 0) return prev.filter((_, i) => i !== existing);
      return [...prev, { label, category, weight: 2, muted: false }];
    });
  };

  return (
    <div class="create-layout">
      <div class="create-left">
        {/* Foundation */}
        <div class="panel-card">
          <div class="panel-title">Foundation</div>
          <div class="genre-grid">
            {filteredGenres.map((g) => {
              const dotColor = GENRE_COLORS[g.id] ?? "accent";
              return (
                <button
                  key={g.id}
                  class={`genre-card${genreId === g.id ? " active" : ""}`}
                  onClick={() => handleGenreClick(g.id)}
                >
                  <div class="genre-dot" style={{ background: `var(--${dotColor})` }} />
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
        </div>

        {/* Arrangement */}
        <div class="panel-card">
          <div class="panel-title">Arrangement</div>
          <div class="arrangement-bar">
            {sections.map((sec, i) => (
              <div
                key={i}
                class={`arrangement-section${i === selectedSectionIdx ? " selected" : ""}`}
                onClick={() => setSelectedSectionIdx(i)}
              >
                <div class="sec-label">{sec.section}</div>
                <div class="sec-bars">{sec.bars} bars</div>
              </div>
            ))}
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
                <button class="section-action-btn" onClick={() => {}}>Move</button>
                <button class="section-action-btn" onClick={() => {}}>Duplicate</button>
                <button class="section-action-btn" onClick={() => {}}>Remove</button>
              </div>
              <div class="preset-row" style="margin-top: 12px">
                {SECTION_PALETTE.map((type) => (
                  <button
                    key={type}
                    class="preset-pill"
                    onClick={() => {
                      // addSection stub
                    }}
                  >
                    + {type}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Reference */}
        <div class="panel-card">
          <div class="panel-title">Reference</div>
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
        </div>

        {error && <p class="error" style="color:var(--red);font-size:13px">{error}</p>}

        <button class="btn btn-primary" style="width:100%" disabled={submitting} onClick={handleSubmit}>
          {submitting ? "Creating…" : "Launch Session"}
        </button>
      </div>

      {/* Style Console */}
      <div class="create-right">
        <div class="style-console">
          <div class="console-header">
            <span class="console-title">Style Console</span>
          </div>
          <div class="console-body">
            <div class="fingerprint-spectrum">
              {[80, 60, 90, 40, 70, 50, 85, 45, 75, 55, 65, 35].map((h, i) => (
                <div
                  key={i}
                  class={`fingerprint-bar ${i < 4 ? "accent" : i < 8 ? "cyan" : "dim"}`}
                  style={{ height: `${h * 0.6}px` }}
                />
              ))}
            </div>
            <div class="fingerprint-label">
              <span>SIGNATURE</span>
              <span>12 units · influence 86%</span>
            </div>

            <div class="category-lanes">
              {(GENRE_MODULES[genreId]?.tagCategories ?? []).map((cat) => {
                const selectedCount = tags.filter((t) => t.category === cat.id).length;
                return (
                  <div key={cat.id} class="category-lane">
                    <div class="lane-dot" style={{ background: `var(--${cat.color})` }} />
                    <span class="lane-label">{cat.name.toUpperCase()}</span>
                    <div class="lane-chips">
                      {cat.suggestions.slice(0, 4).map((s) => {
                        const isSelected = tags.some((t) => t.label === s && t.category === cat.id);
                        return (
                          <span
                            key={s}
                            class={`lane-chip${isSelected ? " active" : ""}`}
                            onClick={() => addTag(s, cat.id)}
                          >
                            {s}
                          </span>
                        );
                      })}
                    </div>
                    <span class="lane-count">{selectedCount}</span>
                    <button class="lane-add">+</button>
                  </div>
                );
              })}
            </div>

            {tags.length > 0 && (
              <div class="tag-channel-strip">
                <span class="tag-strip-name">{tags[0]!.label}</span>
                <div class="tag-weight-selector">
                  {(["Sub", "Bal", "Dom"] as const).map((w) => (
                    <button
                      key={w}
                      class={`weight-option${(w === "Sub" ? 1 : w === "Bal" ? 2 : 3) === tags[0]!.weight ? " active" : ""}`}
                      onClick={() =>
                        setTags((prev) =>
                          prev.map((t, i) => (i === 0 ? { ...t, weight: w === "Sub" ? 1 : w === "Bal" ? 2 : 3 } : t))
                        )
                      }
                    >
                      {w}
                    </button>
                  ))}
                </div>
                <button class="tag-mute" onClick={() => setTags((prev) => prev.map((t, i) => (i === 0 ? { ...t, muted: !t.muted } : t)))}>
                  <i class="ph-speaker-simple-slash" />
                </button>
                <button class="tag-remove" onClick={() => setTags((prev) => prev.filter((_, i) => i !== 0))}>
                  <i class="ph-x" />
                </button>
              </div>
            )}

            <div class="style-preview">
              {stylePreviewText || "Select tags to build your style"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
