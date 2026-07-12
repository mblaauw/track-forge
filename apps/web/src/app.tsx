import { Router, Route } from "./lib/router";
import { JobList } from "./pages/JobList";
import { CreateJob } from "./pages/CreateJob";
import { JobDetail } from "./pages/JobDetail";

export function App() {
  return (
    <Router>
      <div class="app-shell">
        <header class="app-header">
          <a href="#/" class="app-logo">
            Track Forge
          </a>
          <nav class="app-nav">
            <a href="#/">Jobs</a>
            <a href="#/create">New Job</a>
          </nav>
        </header>

        <main class="app-main">
          <Route path="/" component={JobList} />
          <Route path="/create" component={CreateJob} />
          <Route path="/job/:id" component={JobDetail} />
        </main>
      </div>
    </Router>
  );
}
