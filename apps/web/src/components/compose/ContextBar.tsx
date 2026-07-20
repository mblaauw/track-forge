import { Flame, CircleNotch, Shuffle } from "@phosphor-icons/react";
import { useSession } from "../../lib/session";
import { randomSessionName } from "./arrangement";

function keyLabel(key: string, scale: "major" | "minor"): string {
  if (!key) return "—";
  return key + (scale === "minor" ? "m" : "");
}

export function ContextBar({
  onForge,
  forgeDisabled,
}: {
  onForge: () => void;
  forgeDisabled: boolean;
}) {
  const s = useSession();
  const forging = s.status === "in_progress" || s.forgeRunning;
  const statusDot = forging ? "#E0A63E" : "#3DDC84";
  const statusText = forging ? "FORGING" : "READY";

  const presetLabel = s.presetLabels.length
    ? s.presetLabels.join(", ")
    : s.presetIds.length
      ? s.presetIds.map((p) => p.replace(/_/g, " ")).join(", ")
      : "—";
  const bpmLabel = s.bpm ? `${s.bpm} BPM` : "— BPM";

  return (
    <header class="ctx-bar">
      <div class="ctx-left">
        <div style="display:flex;align-items:center;gap:6px">
          <input
            class="ctx-name-input"
            aria-label="Session name"
            placeholder="Untitled Session"
            value={s.name}
            onInput={(e) =>
              s.setSession({ name: (e.target as HTMLInputElement).value })
            }
          />
          <button
            class="ctx-name-gen-btn"
            onClick={() => s.setSession({ name: randomSessionName() })}
            title="Generate session name"
            style="background:none;border:none;cursor:pointer;color:var(--faint);padding:4px;display:flex"
          >
            <Shuffle size={14} />
          </button>
        </div>
        <div class="ctx-meta">
          <span class="ctx-meta-genre">{s.genreId || "—"}</span>
          <span class="ctx-meta-sep">/</span>
          <span>{presetLabel}</span>
          <span class="ctx-meta-sep">·</span>
          <span>{bpmLabel}</span>
          <span class="ctx-meta-sep">·</span>
          <span>{keyLabel(s.key, s.scale)}</span>
        </div>
      </div>

      <div class="ctx-right">
        <div class="ctx-status">
          <span class="ctx-status-dot" style={{ background: statusDot }} />
          <span class="ctx-status-text">{statusText}</span>
        </div>
        <button
          class={`ctx-forge-btn${forging ? " running" : ""}`}
          disabled={forgeDisabled || forging}
          onClick={onForge}
        >
          {forging ? (
            <CircleNotch size={16} class="tf-spin" />
          ) : (
            <Flame size={16} />
          )}
          {forging ? "Forging…" : s.forgeLabel}
        </button>
      </div>
    </header>
  );
}
