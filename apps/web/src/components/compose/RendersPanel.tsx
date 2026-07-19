import { CaretLeft, CaretRight, Waveform } from "@phosphor-icons/react";
import { useSession } from "../../lib/session";

export function RendersPanel() {
  const { rightCollapsed, togglePanel, takes } = useSession();

  if (rightCollapsed) {
    return (
      <div
        class="col-rail collapsed"
        onClick={() => togglePanel("right")}
        title="Expand renders"
      >
        <CaretLeft size={16} />
        <span class="rail-vertical-label">RENDERS</span>
      </div>
    );
  }

  return (
    <div class="renders-panel">
      <div class="col-header">
        <button
          class="col-collapse-btn"
          onClick={() => togglePanel("right")}
          title="Collapse renders"
        >
          <CaretRight size={16} />
        </button>
        <span class="col-pill">
          <Waveform size={14} />
          Renders · {takes.length}
        </span>
      </div>
      <div class="col-body tf-scroll">
        <div class="renders-subheader">
          <span class="renders-subheader-label">GENERATED SONGS</span>
        </div>
        {takes.length === 0 ? (
          <p class="renders-empty">
            No renders yet. Forge the bundle to generate.
          </p>
        ) : (
          <div class="renders-list" />
        )}
      </div>
    </div>
  );
}
