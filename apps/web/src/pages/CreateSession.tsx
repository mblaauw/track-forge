export function CreateSession() {
  const genres = [
    { id: "edm", name: "EDM", dot: "cyan", count: "80+" },
    { id: "hiphop", name: "Hip-Hop", dot: "amber", count: "40+" },
    { id: "pop", name: "Pop", dot: "violet", count: "20+" },
    { id: "ambient", name: "Ambient", dot: "accent", count: "15+" },
  ];

  return (
    <div class="create-layout">
      <div class="create-left">
        {/* Foundation */}
        <div class="panel-card">
          <div class="panel-title">Foundation</div>
          <div class="genre-grid">
            {genres.map((g) => (
              <button class="genre-card">
                <div class="genre-dot" style={{ background: `var(--${g.dot})` }} />
                <div class="genre-name">{g.name}</div>
                <div class="genre-count">{g.count} subgenres</div>
              </button>
            ))}
          </div>
          <div class="preset-row">
            <button class="preset-pill active">Progressive House</button>
            <button class="preset-pill">Deep House</button>
            <button class="preset-pill">Melodic Techno</button>
            <button class="preset-pill">Trance</button>
          </div>
          <div class="create-control-row" style="margin-top: 16px">
            <div class="control-group">
              <span class="control-label">Tempo</span>
              <div style="display:flex;align-items:center;gap:8px">
                <input class="tempo-slider" type="range" min="60" max="200" value="128" />
                <span class="tempo-value">128</span>
              </div>
            </div>
            <div class="control-group">
              <span class="control-label">Key</span>
              <select class="key-select">
                <option>C maj</option><option>D min</option><option>E min</option>
                <option>F maj</option><option>G maj</option><option>A min</option>
              </select>
            </div>
          </div>
        </div>

        {/* Arrangement */}
        <div class="panel-card">
          <div class="panel-title">Arrangement</div>
          <div class="arrangement-bar">
            {["Intro", "Build", "Drop", "Break", "Build", "Drop", "Bridge", "Outro"].map((sec, i) => (
              <div class={`arrangement-section${i === 2 ? " selected" : ""}`}>
                <div class="sec-label">{sec}</div>
                <div class="sec-bars">{[8, 8, 16, 8, 8, 16, 8, 8][i]} bars</div>
              </div>
            ))}
          </div>
          <div class="arrangement-editor" style="margin-top: 12px">
            <div class="bar-control">
              <button class="bar-btn">−</button>
              <span class="bar-count">16</span>
              <button class="bar-btn">+</button>
            </div>
            <span style="font-size:12px;color:var(--text-dim)">bars</span>
            <button class="section-action-btn">Move</button>
            <button class="section-action-btn">Duplicate</button>
            <button class="section-action-btn">Remove</button>
          </div>
        </div>

        {/* Reference */}
        <div class="panel-card">
          <div class="panel-title">Reference</div>
          <textarea class="reference-textarea" placeholder="Paste a reference track URL or description..." />
          <div class="lyrics-mode-row">
            <button class="lyrics-mode-btn active">Full Lyrics</button>
            <button class="lyrics-mode-btn">Hook Only</button>
            <button class="lyrics-mode-btn">Instrumental</button>
          </div>
        </div>
      </div>

      {/* Style Console */}
      <div class="create-right">
        <div class="style-console">
          <div class="console-header">
            <span class="console-title">Style Console</span>
          </div>
          <div class="console-body">
            {/* Fingerprint */}
            <div class="fingerprint-spectrum">
              {[80, 60, 90, 40, 70, 50, 85, 45, 75, 55, 65, 35].map((h, i) => (
                <div
                  class={`fingerprint-bar ${i < 4 ? "accent" : i < 8 ? "cyan" : "dim"}`}
                  style={{ height: `${h * 0.6}px` }}
                />
              ))}
            </div>
            <div class="fingerprint-label">
              <span>SIGNATURE</span>
              <span>12 units · influence 86%</span>
            </div>

            {/* Category lanes */}
            <div class="category-lanes">
              {[
                { label: "GENRE", dot: "accent", chips: ["Progressive House", "Melodic"], count: 2 },
                { label: "MOOD", dot: "amber", chips: ["Euphoric", "Uplifting", "Energetic"], count: 3 },
                { label: "INST", dot: "cyan", chips: ["Synth", "Pad", "Pluck"], count: 3 },
                { label: "PROD", dot: "violet", chips: ["Sidechain", "Reverb", "Wide"], count: 3 },
              ].map((lane) => (
                <div class="category-lane">
                  <div class="lane-dot" style={{ background: `var(--${lane.dot})` }} />
                  <span class="lane-label">{lane.label}</span>
                  <div class="lane-chips">
                    {lane.chips.map((chip) => (
                      <span class="lane-chip">{chip}</span>
                    ))}
                  </div>
                  <span class="lane-count">{lane.count}</span>
                  <button class="lane-add">+</button>
                </div>
              ))}
            </div>

            {/* Selected tag */}
            <div class="tag-channel-strip">
              <span class="tag-strip-name">Sidechain</span>
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

            {/* Style Preview */}
            <div class="style-preview">
              Progressive House, Melodic, Euphoric, Uplifting, Energetic, Synth, Pad, Pluck, Sidechain, Reverb, Wide · 128 BPM · Cm · high fidelity, professional mix
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
