export function Studio({ id }: { id: string }) {
  return (
    <div>
      {/* Bundle Header */}
      <div class="bundle-header">
        <span class="bundle-badge">Bundle · v3</span>
        <input class="project-name-input" value="Midnight Express" style="font-size:22px;font-weight:700;max-width:300px" readOnly />
        <span class="bundle-stats-pill">1 style · 1 lyric · 2 takes</span>
      </div>

      {/* Artifacts */}
      <div class="studio-layout">
        {/* Style Panel */}
        <div class="artifact-panel">
          <div class="artifact-panel-header">Style</div>
          <div class="artifact-panel-body">
            <div class="style-text">
              Progressive House, Melodic, Euphoric<br />
              driving bassline, layered synths, sidechain pumping<br />
              128 BPM · Cm · high fidelity, professional mix
            </div>
            <div class="style-tags">
              <span class="lane-chip">Progressive House</span>
              <span class="lane-chip">Melodic</span>
              <span class="lane-chip">Euphoric</span>
              <span class="lane-chip">Synth</span>
              <span class="lane-chip">Sidechain</span>
              <span class="lane-chip">Reverb</span>
            </div>
          </div>
        </div>

        {/* Lyric Sheet */}
        <div class="artifact-panel">
          <div class="artifact-panel-header">Lyric Sheet</div>
          <div class="artifact-panel-body lyric-sheet">
            <div class="section-header">Verse 1</div>
            <div class="lyric-line">
              <span class="lyric-syllables">(8)</span>
              <span class="lyric-text">Under the neon sky we rise</span>
            </div>
            <div class="lyric-line">
              <span class="lyric-syllables">(7)</span>
              <span class="lyric-text">Electric dreams come alive</span>
            </div>
            <div class="section-header">Chorus</div>
            <div class="lyric-line">
              <span class="lyric-syllables">(6)</span>
              <span class="lyric-text">We are the night</span>
            </div>
            <div class="lyric-line">
              <span class="lyric-syllables">(8)</span>
              <span class="lyric-text">Burning bright in the dark</span>
            </div>
            <div class="total-syllables">Total: 88 syllables</div>
          </div>
        </div>
      </div>

      {/* Audio Takes */}
      <div class="takes-section">
        <h2 class="takes-title">Audio Takes</h2>
        <div class="takes-list">
          {[
            { title: "Midnight Express - Take 1", meta: "Suno v4 · 3:24", duration: "3:24", favored: false },
            { title: "Midnight Express - Take 2", meta: "Suno v4 · 3:28", duration: "3:28", favored: true },
          ].map((take, i) => (
            <div class={`take-card${take.favored ? " favored" : ""}`}>
              <button class="take-play">
                <i class="ph-play-fill" />
              </button>
              <div class="take-info">
                <div class="take-title">{take.title}</div>
                <div class="take-meta">{take.meta}</div>
              </div>
              <div class="take-waveform">
                {Array.from({ length: 46 }, (_, j) => (
                  <div class="bar" style={{ height: `${3 + Math.random() * 34}px` }} />
                ))}
              </div>
              <span class="take-duration">{take.duration}</span>
              <div class="take-actions">
                <button class="take-ab">A</button>
                <button class={`take-star${take.favored ? " active" : ""}`}>
                  <i class={take.favored ? "ph-star-fill" : "ph-star"} />
                </button>
              </div>
            </div>
          ))}
        </div>
        <button class="render-btn">
          <i class="ph-plus-circle" />
          Render new take
        </button>
      </div>
    </div>
  );
}
