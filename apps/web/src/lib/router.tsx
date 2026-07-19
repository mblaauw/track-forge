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
