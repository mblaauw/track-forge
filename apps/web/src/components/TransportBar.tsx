import { useRouter } from "../lib/router";

const VIEW_LABELS: Record<string, string> = {
  "/": "LIB",
  "/create": "SES",
  "/forge": "RUN",
  "/studio": "MIX",
};

export function TransportBar() {
  const { path } = useRouter();
  const viewCode = Object.keys(VIEW_LABELS).find((k) =>
    k === "/" ? path === "/" : path.startsWith(k),
  );
  const label = viewCode ? VIEW_LABELS[viewCode] : "---";
  const now = new Date();
  const clock = now.toTimeString().slice(0, 8);

  return (
    <header class="transport-bar">
      <div class="transport-left">
        <span class="view-badge">{label}</span>
        <div class="transport-meta">
          <input
            class="project-name-input"
            placeholder="Untitled Session"
          />
          <div class="breadcrumb">
            <span class="breadcrumb-tag">EDM</span>
            <span class="breadcrumb-sep">/</span>
            <span>Progressive House</span>
            <span class="breadcrumb-sep">·</span>
            <span>128 BPM · Cm</span>
          </div>
        </div>
      </div>

      <div class="transport-center">
        <div class="level-meters">
          {Array.from({ length: 7 }, (_, i) => {
            const col = i >= 5 ? "var(--red)" : i >= 3 ? "var(--amber)" : "var(--acc)";
            return (
              <div
                class={`level-bar${i % 2 === 0 ? " active" : ""}`}
                style={{ height: `${6 + Math.random() * 14}px`, background: i % 2 === 0 ? col : undefined }}
              />
            );
          })}
        </div>
        <span class="transport-status idle">IDLE</span>
      </div>

      <div class="transport-right">
        <span class="transport-clock">{clock}</span>
        <button class="btn-primary" disabled>FORGE</button>
      </div>
    </header>
  );
}
