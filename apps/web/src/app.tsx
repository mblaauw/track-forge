import { Router, Route } from "./lib/router";
import { JobList } from "./pages/JobList";
import { CreateJob } from "./pages/CreateJob";
import { JobDetail } from "./pages/JobDetail";

export function App() {
  return (
    <Router>
      <Route path="/" component={JobList} />
      <Route path="/create" component={CreateJob} />
      <Route path="/job/:id" component={JobDetail} />
    </Router>
  );
}
