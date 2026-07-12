import { createContext } from "preact";
import { useContext, useState, useEffect } from "preact/hooks";

interface RouterCtx {
  path: string;
  navigate: (path: string) => void;
}

const RouterContext = createContext<RouterCtx>({ path: "/", navigate: () => {} });

export function useRouter(): RouterCtx {
  return useContext(RouterContext);
}

function getHashPath(): string {
  const hash = location.hash.replace(/^#/, "") || "/";
  return hash;
}

export function Router({ children }: { children: preact.ComponentChildren }) {
  const [path, setPath] = useState(getHashPath);

  useEffect(() => {
    const onHash = () => setPath(getHashPath());
    addEventListener("hashchange", onHash);
    return () => removeEventListener("hashchange", onHash);
  }, []);

  const navigate = (p: string) => {
    location.hash = p;
  };

  return (
    <RouterContext.Provider value={{ path, navigate }}>
      {children}
    </RouterContext.Provider>
  );
}

export interface RouteProps {
  path: string;
  component: () => preact.VNode;
}

function match(pattern: string, current: string): boolean {
  if (!pattern.includes(":")) return current === pattern;
  const patParts = pattern.split("/");
  const curParts = current.split("/");
  if (patParts.length !== curParts.length) return false;
  return patParts.every((p, i) => p.startsWith(":") || p === curParts[i]);
}

export function Route({ path, component }: RouteProps) {
  const { path: current } = useRouter();
  if (!match(path, current)) return null;
  return component();
}

// Simple link component
export function Link({ to, children }: { to: string; children: preact.ComponentChildren }) {
  const { navigate } = useRouter();
  return (
    <a
      href={`#${to}`}
      onClick={(e) => {
        e.preventDefault();
        navigate(to);
      }}
    >
      {children}
    </a>
  );
}
