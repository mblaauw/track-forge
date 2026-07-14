import { createContext } from "preact";
import { useContext, useState, useCallback } from "preact/hooks";

export interface SessionState {
  jobId: string | null;
  name: string;
  genreId: string;
  presetId: string;
  bpm: number | null;
  key: string;
  status: string;
  onForge: (() => void) | null;
  forgeLabel: string;
  forgeDisabled: boolean;
}

const DEFAULT: SessionState = {
  jobId: null, name: "", genreId: "", presetId: "",
  bpm: null, key: "", status: "idle",
  onForge: null, forgeLabel: "FORGE", forgeDisabled: true,
};

interface SessionCtx extends SessionState {
  setSession: (patch: Partial<SessionState>) => void;
  resetSession: () => void;
}

const Ctx = createContext<SessionCtx>({ ...DEFAULT, setSession: () => {}, resetSession: () => {} });

export function useSession(): SessionCtx {
  return useContext(Ctx);
}

export function SessionProvider({ children }: { children: preact.ComponentChildren }) {
  const [state, setState] = useState<SessionState>(DEFAULT);
  const setSession = useCallback((patch: Partial<SessionState>) => setState((s) => ({ ...s, ...patch })), []);
  const resetSession = useCallback(() => setState(DEFAULT), []);
  return <Ctx.Provider value={{ ...state, setSession, resetSession }}>{children}</Ctx.Provider>;
}
