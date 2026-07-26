import { useState } from "preact/hooks";
import { CaretDown, CaretRight, Terminal } from "@phosphor-icons/react";
import { useSession } from "../../lib/session";

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
        </div>
      )}
    </div>
  );
}
