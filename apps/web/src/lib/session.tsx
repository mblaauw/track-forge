import { createContext } from "preact";
import { randomTitle } from "../components/compose/arrangement";
import {
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "preact/hooks";
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

const STORAGE_KEY = "tf-session";

function loadPersistedSession(): SessionState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SessionState;
  } catch {
    return null;
  }
}

function persistSession(state: SessionState): void {
  try {
    // Don't persist forge-in-progress state (too transient)
    const persistable = { ...state, forgeRunning: false, status: "idle" };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persistable));
  } catch {
    // localStorage full or unavailable
  }
}

function clearPersistedSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

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
  // Preset's own 1-10 energy/complexity — drive the size of formula-based
  // arrangement sections (see buildSections in components/compose/arrangement.ts).
  energy: number;
  complexity: number;
  status: string;
  reference: string;
  excludedStyles: string;
  forgeLabel: string;
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
  promptInspectorOpen: boolean;
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
  energy: 5,
  complexity: 5,
  status: "idle",
  reference: "",
  excludedStyles: "",
  forgeLabel: "Forge",
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
    sound: true,
    descriptors: false,
    reference: false,
  },
  promptInspectorOpen: false,
  leftCollapsed: false,
  rightCollapsed: true,
  libraryCollapsed: true,
  forgeRunning: false,
  forgeStageIdx: 0,
  forgeStageLabel: "",
};

interface SessionCtx extends SessionState {
  setSession: (patch: Partial<SessionState>) => void;
  resetSession: () => void;
  toggleCard: (id: SetupCardId) => void;
  togglePanel: (which: "left" | "right" | "library") => void;
  expandPanel: (which: "left" | "right" | "library") => void;
}

const Ctx = createContext<SessionCtx>({
  ...DEFAULT,
  setSession: () => {},
  resetSession: () => {},
  toggleCard: () => {},
  togglePanel: () => {},
  expandPanel: () => {},
} as SessionCtx);

export function useSession(): SessionCtx {
  return useContext(Ctx);
}

export function SessionProvider({
  children,
}: {
  children: preact.ComponentChildren;
}) {
  // Initialize from localStorage if available
  const [state, setState] = useState<SessionState>(() => {
    const persisted = loadPersistedSession();
    if (persisted) return persisted;
    const title = randomTitle();
    return { ...DEFAULT, name: title, title };
  });
  const persistRef = useRef<ReturnType<typeof setTimeout>>();

  // Auto-persist on every state change (debounced)
  useEffect(() => {
    if (persistRef.current) clearTimeout(persistRef.current);
    persistRef.current = setTimeout(() => persistSession(state), 500);
    return () => {
      if (persistRef.current) clearTimeout(persistRef.current);
    };
  }, [state]);

  const setSession = useCallback(
    (patch: Partial<SessionState>) => setState((s) => ({ ...s, ...patch })),
    [],
  );
  const resetSession = useCallback(() => {
    clearPersistedSession();
    const title = randomTitle();
    setState({ ...DEFAULT, name: title, title });
  }, []);
  const toggleCard = useCallback(
    (id: SetupCardId) =>
      setState((s) => ({ ...s, cards: { ...s.cards, [id]: !s.cards[id] } })),
    [],
  );
  const togglePanel = useCallback(
    (which: "left" | "right" | "library") =>
      setState((s) => ({
        ...s,
        [`${which}Collapsed`]: !s[`${which}Collapsed`],
      })),
    [],
  );
  const expandPanel = useCallback(
    (which: "left" | "right" | "library") =>
      setState((s) =>
        s[`${which}Collapsed`] ? { ...s, [`${which}Collapsed`]: false } : s,
      ),
    [],
  );
  return (
    <Ctx.Provider
      value={{
        ...state,
        setSession,
        resetSession,
        toggleCard,
        togglePanel,
        expandPanel,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
