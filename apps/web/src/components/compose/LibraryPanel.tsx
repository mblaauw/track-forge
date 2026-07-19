import {
  CaretLeft,
  CaretRight,
  Stack,
  MagnifyingGlass,
} from "@phosphor-icons/react";
import { useSession } from "../../lib/session";

export function LibraryPanel() {
  const { libraryCollapsed, togglePanel } = useSession();

  if (libraryCollapsed) {
    return (
      <div
        class="col-rail collapsed"
        onClick={() => togglePanel("library")}
        title="Expand library"
      >
        <CaretLeft size={16} />
        <span class="rail-vertical-label">LIBRARY</span>
      </div>
    );
  }

  return (
    <div class="library-panel">
      <div class="col-header">
        <button
          class="col-collapse-btn"
          onClick={() => togglePanel("library")}
          title="Collapse library"
        >
          <CaretRight size={16} />
        </button>
        <span class="col-pill">
          <Stack size={14} />
          Library · 0
        </span>
      </div>
      <div class="col-body tf-scroll">
        <div class="library-search-wrap">
          <MagnifyingGlass size={14} class="library-search-icon" />
          <input class="library-search" placeholder="Search sessions…" />
        </div>
        <div class="library-subheader">
          <span class="library-subheader-label">SESSION ARCHIVE</span>
        </div>
        <p class="library-empty">No sessions yet.</p>
      </div>
    </div>
  );
}
