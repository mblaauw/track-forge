import { createContext } from "preact";
import { useContext, useState, useCallback } from "preact/hooks";
import type {
  Descriptor,
  Section,
  LyricsMode,
  LyricAngle,
  ArrangeSource,
  SetupCardsOpen,
  SetupCardId,
  Take,
} from "../components/compose/types";

export interface SessionState {
  jobId: string | null;
  name: string;
  title: string;
  genreId: string;
  presetId: string;
  presetIds: string[];
  presetLabels: string[];
  bpm: number | null;
  key: string;
  scale: "major" | "minor";
  status: string;
  reference: string;
  onForge: (() => void) | null;
  forgeLabel: string;
  forgeDisabled: boolean;
  lyricsMode: LyricsMode;
  lyricTopic: string;
  lyricAngle: LyricAngle;
  lyricThemes: string[];
  lyricLines: Record<string, string[]>;
  lyricsGenerated: boolean;
  tags: Descriptor[];
  sections: Section[];
  selSectionId: string | null;
  arrangeSource: ArrangeSource;
  takes: Take[];
  cards: SetupCardsOpen;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  libraryCollapsed: boolean;
  forgeRunning: boolean;
  forgeStageIdx: number;
  forgeStageLabel: string;
}

const DEFAULT: SessionState = {
  jobId: null,
  name: "",
  title: "",
  genreId: "edm",
  presetId: "",
  presetIds: [],
  presetLabels: [],
  bpm: 128,
  key: "C",
  scale: "minor",
  status: "idle",
  reference: "",
  onForge: null,
  forgeLabel: "Forge",
  forgeDisabled: true,
  lyricsMode: "strict_instrumental",
  lyricTopic: "",
  lyricAngle: "first_person",
  lyricThemes: [],
  lyricLines: {},
  lyricsGenerated: false,
  tags: [],
  sections: [],
  selSectionId: null,
  arrangeSource: "default",
  takes: [],
  cards: {
    genre: true,
    preset: false,
    tempo: false,
    lyrics: false,
    descriptors: false,
    reference: false,
  },
  leftCollapsed: false,
  rightCollapsed: false,
  libraryCollapsed: false,
  forgeRunning: false,
  forgeStageIdx: 0,
  forgeStageLabel: "",
};

interface SessionCtx extends SessionState {
  setSession: (patch: Partial<SessionState>) => void;
  resetSession: () => void;
  toggleCard: (id: SetupCardId) => void;
  togglePanel: (which: "left" | "right" | "library") => void;
}

const Ctx = createContext<SessionCtx>({
  ...DEFAULT,
  setSession: () => {},
  resetSession: () => {},
  toggleCard: () => {},
  togglePanel: () => {},
});

export function useSession(): SessionCtx {
  return useContext(Ctx);
}

export function SessionProvider({
  children,
}: {
  children: preact.ComponentChildren;
}) {
  const [state, setState] = useState<SessionState>(DEFAULT);
  const setSession = useCallback(
    (patch: Partial<SessionState>) => setState((s) => ({ ...s, ...patch })),
    [],
  );
  const resetSession = useCallback(() => setState(DEFAULT), []);
  const toggleCard = useCallback(
    (id: SetupCardId) =>
      setState((s) => ({ ...s, cards: { ...s.cards, [id]: !s.cards[id] } })),
    [],
  );
  const togglePanel = useCallback(
    (which: "left" | "right" | "library") =>
      setState((s) => ({
        ...s,
        [which === "left"
          ? "leftCollapsed"
          : which === "right"
            ? "rightCollapsed"
            : "libraryCollapsed"]:
          !s[
            which === "left"
              ? "leftCollapsed"
              : which === "right"
                ? "rightCollapsed"
                : "libraryCollapsed"
          ],
      })),
    [],
  );
  return (
    <Ctx.Provider
      value={{ ...state, setSession, resetSession, toggleCard, togglePanel }}
    >
      {children}
    </Ctx.Provider>
  );
}
