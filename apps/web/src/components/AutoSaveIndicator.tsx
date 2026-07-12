import type { SaveStatus } from "../lib/useAutosave";

export function AutoSaveIndicator({ status }: { status: SaveStatus }) {
  if (status === "idle") return null;

  const map: Record<SaveStatus, { label: string; cls: string }> = {
    idle: { label: "", cls: "" },
    saving: { label: "Saving…", cls: "save-saving" },
    saved: { label: "Saved", cls: "save-saved" },
    error: { label: "Save failed", cls: "save-error" },
  };

  const { label, cls } = map[status];
  return <span class={`autosave-indicator ${cls}`}>{label}</span>;
}
