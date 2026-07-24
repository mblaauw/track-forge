import { Router } from "./lib/router";
import { SessionProvider } from "./lib/session";
import { PlayerProvider } from "./lib/player";
import { ComposeShell } from "./components/compose/ComposeShell";

export function App() {
  return (
    <Router>
      <SessionProvider>
        <PlayerProvider>
          <ComposeShell />
        </PlayerProvider>
      </SessionProvider>
    </Router>
  );
}
