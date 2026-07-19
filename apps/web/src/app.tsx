import { Router } from "./lib/router";
import { SessionProvider } from "./lib/session";
import { ComposeShell } from "./components/compose/ComposeShell";

export function App() {
  return (
    <Router>
      <SessionProvider>
        <ComposeShell />
      </SessionProvider>
    </Router>
  );
}
