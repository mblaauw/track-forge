export function Forge({ id }: { id: string }) {
  const stages = [
    { num: "01", label: "Reference", desc: "Analyzing input", done: true },
    { num: "02", label: "Plan", desc: "Song structure", done: true },
    { num: "03", label: "Style", desc: "Sound design", done: true },
    { num: "04", label: "Lyrics", desc: "Writing lyrics", done: false, active: true },
    { num: "05", label: "Compose", desc: "Arrangement", done: false },
    { num: "06", label: "Review", desc: "Quality check", done: false },
    { num: "07", label: "Polish", desc: "Refinement", done: false },
    { num: "08", label: "Version", desc: "Finalize", done: false },
  ];

  const logs = [
    { time: "00:00:12", tag: "stage", msg: "Analyzing reference track..." },
    { time: "00:00:45", tag: "info", msg: "Genre: EDM, style: Progressive House" },
    { time: "00:01:20", tag: "done", msg: "Reference analysis complete" },
    { time: "00:01:22", tag: "stage", msg: "Generating song plan..." },
    { time: "00:02:10", tag: "done", msg: "Song plan generated (8 sections)" },
    { time: "00:02:15", tag: "stage", msg: "Crafting style prompt..." },
    { time: "00:03:05", tag: "done", msg: "Style prompt generated" },
    { time: "00:03:10", tag: "stage", msg: "Writing lyrics..." },
    { time: "00:04:30", tag: "info", msg: "Mode: full_lyrics, 3 verses, 2 choruses" },
  ];

  const doneCount = stages.filter((s) => s.done).length;
  const progress = (doneCount / stages.length) * 100;

  return (
    <div>
      <div class="forge-header">
        <div class="forge-progress">
          <div class="forge-progress-text">{doneCount}/{stages.length} stages · {progress}%</div>
          <div class="forge-progress-bar">
            <div class="forge-progress-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>
        <span class="forge-elapsed">00:04:30</span>
      </div>

      <div class="forge-layout">
        {/* Assembly Line */}
        <div class="assembly-line">
          <div class="assembly-rail">
            <div class="assembly-rail-progress" style={{ width: `${progress}%` }} />
          </div>
          <div class="assembly-billet" style={{ left: `${progress}%` }} />
          <div class="assembly-stations">
            {stages.map((s) => (
              <div class="station">
                <span class="station-badge">{s.num}</span>
                <div class={`station-dot${s.done ? " done" : s.active ? " active" : " pending"}`} />
                <span class="station-label">{s.label}</span>
                <span class="station-desc">{s.desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Terminal */}
        <div class="terminal">
          <div class="terminal-header">
            <div class="terminal-dot red" />
            <div class="terminal-dot amber" />
            <div class="terminal-dot green" />
            <span class="terminal-title">forge.log</span>
          </div>
          <div class="terminal-body">
            {logs.map((log) => (
              <div class="log-line">
                <span class="log-timestamp">{log.time}</span>
                <span class={`log-tag ${log.tag}`}>{log.tag.toUpperCase()}</span>
                <span class="log-message">{log.msg}</span>
              </div>
            ))}
            <div class="log-line">
              <span class="log-cursor" />
            </div>
          </div>
        </div>

        {/* Run Monitor */}
        <div class="run-monitor">
          <div class="run-monitor-header">Run Monitor</div>
          <table class="run-monitor-table">
            <tr>
              <td>Stage</td>
              <td>Lyrics · Writing lyrics</td>
            </tr>
            <tr>
              <td>Model</td>
              <td>kimi-k2.5</td>
            </tr>
            <tr>
              <td>Elapsed</td>
              <td>00:04:30</td>
            </tr>
            <tr>
              <td>Est. cost</td>
              <td>$0.02</td>
            </tr>
          </table>
        </div>

        {/* Actions */}
        <div class="forge-actions">
          <button class="btn-secondary danger">Cancel</button>
          <button class="btn-secondary">Open bundle</button>
          <button class="btn-primary">Start Forge</button>
        </div>
      </div>
    </div>
  );
}
