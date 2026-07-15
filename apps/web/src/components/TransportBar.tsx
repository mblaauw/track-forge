import { useRouter } from "../lib/router";
import { useSession } from "../lib/session";

const VIEW_LABELS: Record<string, string> = {
  "/": "LIB",
  "/create": "SES",
  "/forge": "RUN",
  "/studio": "MIX",
};
const STATUS_TEXT: Record<string, string> = {
  idle: "IDLE",
  pending: "READY",
  in_progress: "FORGING",
  completed: "COMPLETE",
  failed: "FAILED",
  cancelled: "CANCELLED",
};
const STATUS_CLASS: Record<string, string> = {
  idle: "idle",
  pending: "ready",
  in_progress: "forging",
  completed: "ready",
  failed: "idle",
  cancelled: "idle",
};

export function TransportBar() {
  const { path } = useRouter();
  const s = useSession();

  const viewCode = Object.keys(VIEW_LABELS).find((k) =>
    k === "/" ? path === "/" : path.startsWith(k),
  );
  const label = viewCode ? VIEW_LABELS[viewCode] : "---";
  const clock = new Date().toTimeString().slice(0, 8);
  const active = s.status === "in_progress";

  return (
    <header class="transport-bar">
      <div class="transport-left">
        <span class="view-badge">{label}</span>
        <div class="transport-meta">
          <input
            class="project-name-input"
            placeholder="Untitled Session"
            value={s.name}
            onInput={(e) =>
              s.setSession({ name: (e.target as HTMLInputElement).value })
            }
          />
          {(s.genreId || s.presetId || s.bpm) && (
            <div class="breadcrumb">
              {s.genreId && (
                <span class="breadcrumb-tag">{s.genreId.toUpperCase()}</span>
              )}
              {s.presetId && (
                <>
                  <span class="breadcrumb-sep">/</span>
                  <span>{s.presetId.replace(/_/g, " ")}</span>
                </>
              )}
              {s.bpm && (
                <>
                  <span class="breadcrumb-sep">·</span>
                  <span>
                    {s.bpm} BPM{s.key ? ` · ${s.key}` : ""}
                  </span>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <div class="transport-center">
        <div class="level-meters">
          {Array.from({ length: 7 }, (_, i) => {
            const col =
              i >= 5 ? "var(--red)" : i >= 3 ? "var(--amber)" : "var(--acc)";
            const on = active && i % 2 === 0;
            return (
              <div
                key={i}
                class={`level-bar${on ? " active" : ""}`}
                style={{
                  background: on ? col : undefined,
                  animationPlayState: active ? "running" : "paused",
                  animationDelay: `${i * 0.08}s`,
                }}
              />
            );
          })}
        </div>
        <span class={`transport-status ${STATUS_CLASS[s.status] ?? "idle"}`}>
          {STATUS_TEXT[s.status] ?? "IDLE"}
        </span>
      </div>

      <div class="transport-right">
        <span class="transport-clock">{clock}</span>
        <button
          class="btn-primary"
          disabled={s.forgeDisabled || !s.onForge}
          onClick={() => s.onForge?.()}
        >
          {s.forgeLabel}
        </button>
      </div>
    </header>
  );
}
