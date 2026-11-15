import { Router } from "./lib/router";
import { SessionProvider } from "./lib/session";
import { PlayerProvider } from "./lib/player";
import { Studio } from "./components/studio/Studio";

export function App() {
  return (
    <Router>
      <SessionProvider>
        <PlayerProvider>
          <Studio />
        </PlayerProvider>
      </SessionProvider>
    </Router>
  );
}
