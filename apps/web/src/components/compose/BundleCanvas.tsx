import {
  Textbox,
  SlidersHorizontal,
  Rows,
  MusicNotes,
} from "@phosphor-icons/react";

const BLOCKS = [
  { icon: Textbox, color: "#9B6FD6", label: "TITLE" },
  { icon: SlidersHorizontal, color: "#3FA9C4", label: "STYLE CONSOLE" },
  { icon: Rows, color: "#C98A2B", label: "ARRANGEMENT STRUCTURE" },
  { icon: MusicNotes, color: "#D24B4E", label: "ARRANGEMENT" },
];

export function BundleCanvas() {
  return (
    <div class="bundle-canvas tf-scroll">
      <div class="bundle-inner">
        {BLOCKS.map((b) => {
          const Icon = b.icon;
          return (
            <div class="bundle-block" key={b.label}>
              <div class="bundle-block-header">
                <Icon size={16} style={{ color: b.color }} />
                <span class="bundle-block-title">{b.label}</span>
              </div>
              <div class="bundle-block-body">
                <span class="bundle-block-placeholder">
                  Wired in Subissue 3/4
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
