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

  return (
    <header class="transport-bar">
      <span class="view-badge">{label}</span>

      <input
        class="project-name-input"
        placeholder="Untitled Session"
        value=""
        readOnly
      />

      <div class="breadcrumb">
        <span>EDM</span>
        <span class="breadcrumb-sep">·</span>
        <span>Progressive House</span>
        <span class="breadcrumb-sep">·</span>
        <span>128 BPM · Cm</span>
      </div>

      <div class="level-meters">
        {Array.from({ length: 7 }, (_, i) => (
          <div
            class={`level-bar${i % 2 === 0 ? " active" : ""}`}
            style={{ height: `${6 + Math.random() * 14}px` }}
          />
        ))}
      </div>

      <span class="transport-status idle">IDLE</span>
      <span class="transport-clock">00:00:00</span>

      <button class="btn-primary" disabled>FORGE</button>
    </header>
  );
}
