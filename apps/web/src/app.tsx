import { Router } from "./lib/router";
import { SessionProvider } from "./lib/session";
import { AppShell } from "./components/AppShell";

export function App() {
  return (
    <Router>
      <SessionProvider>
        <AppShell />
      </SessionProvider>
    </Router>
  );
}
