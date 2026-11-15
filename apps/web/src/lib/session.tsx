import { createContext } from "preact";
import {
  DEFAULT_SUNO_MODEL,
  DEFAULT_SUNO_VARIETY,
  type SunoRenderSettings,
} from "@track-forge/contracts";
import { randomTitle } from "../components/studio/arrangement";
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
  Take,
  Zone,
} from "../components/studio/types";

const STORAGE_KEY = "tf-session";

export interface SessionState {
  jobId: string | null;
  name: string;
  title: string;
  genreId: string;
  presetId: string;
  presetIds: string[];
  presetLabels: string[];
  bpm: number | null;
  // The preset's own 1–10 energy/complexity — they size formula-based
  // arrangement sections (see buildSections in components/studio/arrangement.ts).
  energy: number;
  complexity: number;
  status: string;
  /** Free-form notes kept with the session; never sent to Suno. */
  reference: string;
  excludedStyles: string;
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
  /** Suno v6 settings for the next take (model, variety, sliders). */
  render: SunoRenderSettings;
  /**
   * Which zone is in front when the window is too narrow to show all
   * three (Sound, Song, Output) side by side.
   */
  zone: Zone;
  forgeRunning: boolean;
  forgeStageIdx: number;
  forgeStageLabel: string;
  /** Why the last forge failed — shown while status is "failed". */
  forgeError: string;
  /** Set after each forge completes — refreshes the sessions list. */
  lastForgeTimestamp?: number;
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
  energy: 5,
  complexity: 5,
  status: "idle",
  reference: "",
  excludedStyles: "",
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
  render: { model: DEFAULT_SUNO_MODEL, variety: DEFAULT_SUNO_VARIETY },
  zone: "song",
  forgeRunning: false,
  forgeStageIdx: 0,
  forgeStageLabel: "",
  forgeError: "",
  lastForgeTimestamp: undefined,
};

function loadPersistedSession(): SessionState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    // Merge over the defaults so sessions saved before a field existed
    // (e.g. `render`, `zone`) still load with a complete state.
    const saved = JSON.parse(raw) as Partial<SessionState>;
    return {
      ...DEFAULT,
      ...saved,
      render: { ...DEFAULT.render, ...saved.render },
    };
  } catch {
    return null;
  }
}

function persistSession(state: SessionState): void {
  try {
    // Transient run state is not persisted: a reload is never mid-forge.
    const persistable = {
      ...state,
      forgeRunning: false,
      status: "idle",
      forgeError: "",
    };
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

interface SessionCtx extends SessionState {
  setSession: (patch: Partial<SessionState>) => void;
  resetSession: () => void;
}

const Ctx = createContext<SessionCtx>({
  ...DEFAULT,
  setSession: () => {},
  resetSession: () => {},
} as SessionCtx);

export function useSession(): SessionCtx {
  return useContext(Ctx);
}

export function SessionProvider({
  children,
}: {
  children: preact.ComponentChildren;
}) {
  const [state, setState] = useState<SessionState>(() => {
    const persisted = loadPersistedSession();
    if (persisted) return persisted;
    const title = randomTitle();
    return { ...DEFAULT, name: title, title };
  });
  const persistRef = useRef<ReturnType<typeof setTimeout>>();

  // Persist on every change (debounced).
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

  return (
    <Ctx.Provider value={{ ...state, setSession, resetSession }}>
      {children}
    </Ctx.Provider>
  );
}
