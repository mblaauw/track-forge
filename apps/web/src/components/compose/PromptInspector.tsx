import { useState } from "preact/hooks";
import {
  CaretDown,
  CaretRight,
  Terminal,
  Waveform,
} from "@phosphor-icons/react";
import { useSession } from "../../lib/session";
import { sectionColor, sectionShowsVocal, vocalMeta } from "./arrangement";

export function PromptInspector({
  style,
  charCount,
  activeCount,
}: {
  style: string;
  charCount: number;
  activeCount: number;
}) {
  const s = useSession();
  const [copied, setCopied] = useState(false);
  const open = s.promptInspectorOpen;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(style);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      // clipboard not available
    }
  };

  return (
    <div class="bundle-block">
      <button
        class="bundle-block-header toggle"
        onClick={() => s.setSession({ promptInspectorOpen: !open })}
      >
        <Terminal size={16} style="color:var(--icon-style)" />
        <span class="bundle-block-title">SUNO PROMPT</span>
        {activeCount > 0 && (
          <span class="bundle-block-meta">
            {activeCount} active · {charCount} chars
          </span>
        )}
        {open ? (
          <CaretDown size={14} style="margin-left:auto;color:var(--faint)" />
        ) : (
          <CaretRight size={14} style="margin-left:auto;color:var(--faint)" />
        )}
      </button>
      {open && (
        <div class="bundle-block-body">
          <div class="prompt-inspector-section">
            <div class="prompt-inspector-label-row">
              <span class="tf-mono prompt-inspector-label">STYLE</span>
              {style && activeCount > 0 && (
                <button class="bundle-copy-btn" onClick={handleCopy}>
                  {copied ? "Copied" : "Copy"}
                </button>
              )}
            </div>
            <div class="style-preview-box">
              {style || "Add descriptors to compile your style prompt…"}
            </div>
          </div>

          <div class="prompt-inspector-section last">
            <span class="tf-mono prompt-inspector-label">METATAGS</span>
            {s.lyricsMode === "strict_instrumental" && (
              <div class="lyrics-info-box" style="margin:0 0 10px">
                <Waveform size={14} />
                <span>
                  Instrumental — the sections below use Suno metatags to
                  describe movement. Suno reads these metatags directly.
                </span>
              </div>
            )}
            {s.sections.map((sec) => {
              const hue = sectionColor(sec.name);
              return (
                <div class="metatag-row" key={sec.id}>
                  <span style={{ color: hue, fontWeight: 700 }}>
                    [{sec.name}
                    {sec.deltas.length > 0 ? `: ${sec.deltas.join(", ")}` : ""}]
                  </span>
                  {sec.vocal && sectionShowsVocal(sec, s.lyricsMode) && (
                    <span class="metatag-vocal">{vocalMeta(sec.vocal)}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
