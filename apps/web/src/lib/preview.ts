import { useEffect, useRef, useState } from "preact/hooks";
import { previewStyle } from "../api";
import { useSession } from "./session";

export interface PromptPreview {
  /** The style prompt exactly as the pipeline will compile it. */
  style: string;
  /** Negative tags, including ones the server adds (vocals when instrumental). */
  exclusions: string[];
  /** True until the first response for the current inputs has arrived. */
  pending: boolean;
  /** Set when the preview could not be compiled. */
  error: boolean;
}

/**
 * Live preview of what a forge would send, recompiled (debounced) whenever
 * anything that feeds the style prompt changes. The server compiles it with
 * the same code the pipeline uses, so this is the real text, not a mock-up.
 */
export function usePromptPreview(): PromptPreview {
  const s = useSession();
  const [state, setState] = useState<PromptPreview>({
    style: "",
    exclusions: [],
    pending: true,
    error: false,
  });
  const requestId = useRef(0);

  const descriptors = s.tags
    .filter((t) => !t.muted)
    .map((t) => ({ label: t.label, cat: t.cat, weight: t.weight }));
  const descriptorsKey = descriptors
    .map((d) => `${d.label}:${d.weight}`)
    .join(",");
  const sectionsKey = s.sections
    .map(
      (sec) =>
        `${sec.name}:${sec.fn}:${sec.bars}:${sec.deltas.join("+")}:${sec.vocal?.type ?? ""}:${sec.vocal?.delivery ?? ""}`,
    )
    .join("|");

  useEffect(() => {
    if (!s.genreId) return;
    const id = ++requestId.current;
    const timer = setTimeout(() => {
      previewStyle({
        genreId: s.genreId,
        presetIds: s.presetIds,
        descriptors,
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
        excludedStyles: s.excludedStyles || undefined,
      })
        .then((result) => {
          // A slower, older request must not overwrite a newer answer.
          if (id !== requestId.current) return;
          setState({
            style: result.style,
            exclusions: result.exclusions ?? [],
            pending: false,
            error: false,
          });
        })
        .catch(() => {
          if (id !== requestId.current) return;
          setState((prev) => ({ ...prev, pending: false, error: true }));
        });
    }, 250);
    return () => clearTimeout(timer);
  }, [
    s.genreId,
    s.presetIds.join(","),
    descriptorsKey,
    sectionsKey,
    s.bpm,
    s.lyricsMode,
    s.excludedStyles,
  ]);

  return state;
}
