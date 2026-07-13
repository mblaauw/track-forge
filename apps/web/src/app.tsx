import { Router, Route } from "./lib/router";
import { AppShell } from "./components/AppShell";

export function App() {
  return (
    <Router>
      <AppShell />
    </Router>
  );
}
