import { useState, useEffect, useRef } from "preact/hooks";
import { useSession } from "../../lib/session";
import { previewStyle } from "../../api";
import { ArrangementEditor } from "./ArrangementEditor";
import { LyricsBlock } from "./LyricsBlock";
import { PromptInspector } from "./PromptInspector";

export function BundleCanvas() {
  const s = useSession();
  const [stylePreview, setStylePreview] = useState("");
  const [charCount, setCharCount] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const activeDescs = s.tags.filter((t) => !t.muted);
  const descriptorsPayload = activeDescs.map((t) => ({
    label: t.label,
    cat: t.cat,
    weight: t.weight,
  }));

  const sectionsKey = s.sections
    .map(
      (sec) =>
        `${sec.name}:${sec.fn}:${sec.bars}:${sec.deltas.join("+")}:${sec.vocal?.type ?? ""}:${sec.vocal?.delivery ?? ""}`,
    )
    .join("|");

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
        sections: s.sections.map((sec) => ({
          name: sec.name,
          fn: sec.fn,
          bars: sec.bars,
          deltas: sec.deltas,
          vocal: sec.vocal,
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
    s.lyricsMode,
    // The compiled style names the arrangement (instrumental) and the
    // dominant voice (vocal), so it must recompile when sections change.
    sectionsKey,
  ]);

  return (
    <div class="bundle-canvas tf-scroll">
      <div class="bundle-inner">
        {/* ARRANGEMENT STRUCTURE */}
        <ArrangementEditor />

        {/* LYRICS (vocal sections only) */}
        {s.lyricsMode !== "strict_instrumental" && (
          <LyricsBlock style={stylePreview} />
        )}

        {/* SUNO PROMPT (collapsed by default) */}
        <PromptInspector
          style={stylePreview}
          charCount={charCount}
          activeCount={activeCount}
        />
      </div>
    </div>
  );
}
