import { useSession } from "../../lib/session";
import { ContextBar } from "./ContextBar";
import { ForgeStrip } from "./ForgeStrip";
import { SetupColumn } from "./SetupColumn";
import { BundleCanvas } from "./BundleCanvas";
import { RendersPanel } from "./RendersPanel";
import { LibraryPanel } from "./LibraryPanel";

export function ComposeShell() {
  const { leftCollapsed, rightCollapsed, libraryCollapsed } = useSession();

  const leftW = leftCollapsed ? "42px" : "270px";
  const rightW = rightCollapsed ? "42px" : "320px";
  const libW = libraryCollapsed ? "42px" : "300px";
  const gridCols = `${leftW} minmax(0,1fr) ${rightW} ${libW}`;

  return (
    <div class="compose-shell">
      <div class="compose-main">
        <ContextBar />
        <ForgeStrip />
        <div class="compose-grid" style={{ gridTemplateColumns: gridCols }}>
          <SetupColumn />
          <BundleCanvas />
          <RendersPanel />
          <LibraryPanel />
        </div>
      </div>
    </div>
  );
}
