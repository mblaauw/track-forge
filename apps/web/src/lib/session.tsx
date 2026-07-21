import { createContext } from "preact";
import { randomSessionName } from "../components/compose/arrangement";
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
  status: string;
  reference: string;
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
}

const Ctx = createContext<SessionCtx>({
  ...DEFAULT,
  setSession: () => {},
  resetSession: () => {},
  toggleCard: () => {},
  togglePanel: () => {},
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
  const [state, setState] = useState<SessionState>(
    () => loadPersistedSession() ?? { ...DEFAULT, name: randomSessionName() },
  );
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
    setState({ ...DEFAULT, name: randomSessionName() });
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
  return (
    <Ctx.Provider
      value={{ ...state, setSession, resetSession, toggleCard, togglePanel }}
    >
      {children}
    </Ctx.Provider>
  );
}
