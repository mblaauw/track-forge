import { useState, useEffect, useMemo } from "preact/hooks";
import { useRouter } from "../lib/router";
import { fetchGenres, createJob, type GenreInfo } from "../api";
import { edmModule } from "@track-forge/genre-edm";
import { hipHopModule } from "@track-forge/genre-hiphop";
import type { GenreModule } from "@track-forge/genre-core";

const GENRE_MODULES: Record<string, GenreModule> = {
  edm: edmModule as unknown as GenreModule,
  hiphop: hipHopModule as unknown as GenreModule,
};

const GENRE_SUBGENRE_COUNTS: Record<string, string> = {
  edm: "80+",
  hiphop: "40+",
};

const KEY_OPTIONS = [
  "C maj", "Db maj", "D maj", "Eb maj", "E maj", "F maj",
  "F# maj", "G maj", "Ab maj", "A maj", "Bb maj", "B maj",
  "C min", "C# min", "D min", "D# min", "E min", "F min",
  "F# min", "G min", "G# min", "A min", "A# min", "B min",
];

const PRESET_TAGS: Record<string, { genre: string[]; mood: string[]; inst: string[]; prod: string[] }> = {
  deep_house_chill: {
    genre: ["Deep House", "Electronic"],
    mood: ["Warm", "Soulful", "Chill"],
    inst: ["Synth", "Pad", "Organ"],
    prod: ["Sidechain", "Smooth Mix", "Analog Warmth"],
  },
  tech_house_driving: {
    genre: ["Tech House", "Electronic"],
    mood: ["Driving", "Hypnotic", "Energetic"],
    inst: ["Synth", "Percussion", "Bassline"],
    prod: ["Tight Mix", "Compression", "Filter"],
  },
  progressive_house_euphoric: {
    genre: ["Progressive House", "Electronic"],
    mood: ["Euphoric", "Uplifting", "Building"],
    inst: ["Synth Leads", "Pads", "Arpeggios"],
    prod: ["Sidechain", "Layering", "Sweeps"],
  },
  detroit_techno_deep: {
    genre: ["Detroit Techno", "Techno"],
    mood: ["Deep", "Hypnotic", "Dark"],
    inst: ["Synth", "Sequencer", "Drum Machine"],
    prod: ["Minimal Mix", "Reverb", "Delay"],
  },
};

const GENRE_COLORS: Record<string, string> = {
  edm: "cyan",
  hiphop: "amber",
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
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    setSections(arrangement);
  }, [arrangement]);

  const currentKey = (() => {
    const k = inputs.key as string;
    const s = inputs.scale as string;
    if (!k || k === "auto") return "";
    return `${k} ${s}`;
  })();

  const presetTags = presetId && PRESET_TAGS[presetId] ? PRESET_TAGS[presetId] : null;

  const stylePreviewText = (() => {
    if (!presetTags) return "";
    const tagParts = [...presetTags.genre, ...presetTags.mood, ...presetTags.inst, ...presetTags.prod].join(", ");
    const bpm = (inputs.bpm as number) ?? "";
    const k = inputs.key as string;
    const s = inputs.scale as string;
    const keyDisplay = !k || k === "auto" ? "" : `${k}${s === "minor" ? "m" : ""}`;
    return `${tagParts} · ${bpm} BPM · ${keyDisplay} · high fidelity, professional mix`;
  })();

  const filteredGenres = genres.filter((g) => GENRE_MODULES[g.id]);

  const lyricsOptions = useMemo(() => {
    if (genreId === "edm") {
      return [
        { value: "full_lyrics", label: "Full Lyrics" },
        { value: "guided_instrumental", label: "Hook Only" },
        { value: "strict_instrumental", label: "Instrumental" },
      ];
    }
    return [
      { value: "instrumental", label: "Instrumental" },
      { value: "full_lyrics", label: "Full Lyrics" },
    ];
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
              {[
                { key: "genre", label: "GENRE", dot: "accent" },
                { key: "mood", label: "MOOD", dot: "amber" },
                { key: "inst", label: "INST", dot: "cyan" },
                { key: "prod", label: "PROD", dot: "violet" },
              ].map((lane) => {
                const chips = presetTags ? presetTags[lane.key as keyof typeof presetTags] : [];
                return (
                  <div key={lane.key} class="category-lane">
                    <div class="lane-dot" style={{ background: `var(--${lane.dot})` }} />
                    <span class="lane-label">{lane.label}</span>
                    <div class="lane-chips">
                      {chips.map((chip) => (
                        <span key={chip} class="lane-chip">{chip}</span>
                      ))}
                    </div>
                    <span class="lane-count">{chips.length}</span>
                    <button class="lane-add">+</button>
                  </div>
                );
              })}
            </div>

            {presetTags && presetTags.genre.length > 0 && (
              <div class="tag-channel-strip">
                <span class="tag-strip-name">{presetTags.genre[0]}</span>
                <div class="tag-weight-selector">
                  <button class="weight-option">Sub</button>
                  <button class="weight-option active">Bal</button>
                  <button class="weight-option">Dom</button>
                </div>
                <button class="tag-mute">
                  <i class="ph-speaker-simple-slash" />
                </button>
                <button class="tag-remove">
                  <i class="ph-x" />
                </button>
              </div>
            )}

            <div class="style-preview">
              {stylePreviewText || "Select a preset to preview style"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
