import { useState, useEffect, useRef } from "preact/hooks";
import {
  Textbox,
  SlidersHorizontal,
  Rows,
  MusicNotes,
} from "@phosphor-icons/react";
import { useSession } from "../../lib/session";
import { previewStyle } from "../../api";

export function BundleCanvas() {
  const s = useSession();
  const [stylePreview, setStylePreview] = useState("");
  const [charCount, setCharCount] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const activeDescs = s.tags.filter((t) => !t.muted);
  const descriptorsPayload = activeDescs.map((t) => ({
    label: t.label,
    cat: t.cat,
    weight: t.weight,
  }));

  // Debounced preview call on any relevant change
  useEffect(() => {
    if (descriptorsPayload.length === 0) {
      setStylePreview("Add descriptors to compile your style prompt…");
      setCharCount(0);
      setActiveCount(0);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      previewStyle({
        genreId: s.genreId,
        presetIds: s.presetIds,
        descriptors: descriptorsPayload,
        bpm: s.bpm ?? 128,
        key: s.key,
        scale: s.scale,
        sections: s.sections.map((sec) => ({
          name: sec.name,
          fn: sec.fn,
        })),
        lyricsMode: s.lyricsMode,
        vocalType: null,
      })
        .then((result) => {
          setStylePreview(result.style);
          setCharCount(result.charCount);
          setActiveCount(result.activeCount);
        })
        .catch(() => {
          setStylePreview("Error compiling style…");
        });
    }, 250);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [
    s.genreId,
    s.presetIds.join(","),
    descriptorsPayload.map((d) => `${d.label}:${d.weight}`).join(","),
    s.bpm,
    s.key,
    s.scale,
    s.lyricsMode,
  ]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(stylePreview);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      // clipboard not available
    }
  };

  return (
    <div class="bundle-canvas tf-scroll">
      <div class="bundle-inner">
        {/* TITLE block */}
        <div class="bundle-block">
          <div class="bundle-block-header">
            <Textbox size={16} style="color:var(--icon-title)" />
            <span class="bundle-block-title">TITLE</span>
          </div>
          <div class="bundle-block-body">
            <input
              class="bundle-title-input"
              placeholder="Untitled"
              value={s.title}
              onInput={(e) =>
                s.setSession({ title: (e.target as HTMLInputElement).value })
              }
            />
          </div>
        </div>

        {/* STYLE CONSOLE block */}
        <div class="bundle-block">
          <div class="bundle-block-header">
            <SlidersHorizontal size={16} style="color:var(--icon-style)" />
            <span class="bundle-block-title">STYLE CONSOLE</span>
            {activeCount > 0 && (
              <span class="bundle-block-meta">
                {activeCount} active · {charCount} chars
              </span>
            )}
            <div style="margin-left:auto">
              {stylePreview && activeCount > 0 && (
                <button class="bundle-copy-btn" onClick={handleCopy}>
                  {copied ? "Copied" : "Copy"}
                </button>
              )}
            </div>
          </div>
          <div class="bundle-block-body">
            <div class="style-preview-box">
              {stylePreview || "Add descriptors to compile your style prompt…"}
            </div>
          </div>
        </div>

        {/* ARRANGEMENT STRUCTURE placeholder */}
        <div class="bundle-block">
          <div class="bundle-block-header">
            <Rows size={16} style="color:var(--icon-arr)" />
            <span class="bundle-block-title">ARRANGEMENT STRUCTURE</span>
          </div>
          <div class="bundle-block-body">
            <span class="bundle-block-placeholder">Wired in Subissue 4b</span>
          </div>
        </div>

        {/* LYRICS / ARRANGEMENT placeholder */}
        <div class="bundle-block">
          <div class="bundle-block-header">
            <MusicNotes size={16} style="color:var(--icon-lyrics)" />
            <span class="bundle-block-title">ARRANGEMENT</span>
          </div>
          <div class="bundle-block-body">
            <span class="bundle-block-placeholder">Wired in Subissue 4c</span>
          </div>
        </div>
      </div>
    </div>
  );
}
