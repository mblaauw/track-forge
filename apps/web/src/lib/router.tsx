import { createContext } from "preact";
import { useContext, useState, useEffect } from "preact/hooks";

interface RouterCtx {
  path: string;
  navigate: (path: string) => void;
}

const RouterContext = createContext<RouterCtx>({
  path: "/",
  navigate: () => {},
});

export function useRouter(): RouterCtx {
  return useContext(RouterContext);
}

function getHashPath(): string {
  return location.hash.replace(/^#/, "") || "/";
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

interface RouteMatch {
  matched: boolean;
  params: Record<string, string>;
}

function match(pattern: string, current: string): RouteMatch {
  if (!pattern.includes(":")) {
    return { matched: current === pattern, params: {} };
  }
  const patParts = pattern.split("/");
  const curParts = current.split("/");
  if (patParts.length !== curParts.length) {
    return { matched: false, params: {} };
  }
  const params: Record<string, string> = {};
  const matched = patParts.every((p, i) => {
    if (p.startsWith(":")) {
      params[p.slice(1)] = curParts[i]!;
      return true;
    }
    return p === curParts[i];
  });
  return { matched, params };
}

export function Route({
  path,
  component,
}: {
  path: string;
  component: (props: { params: Record<string, string> }) => preact.VNode;
}) {
  const { path: current } = useRouter();
  const result = match(path, current);
  if (!result.matched) return null;
  return component({ params: result.params });
}


